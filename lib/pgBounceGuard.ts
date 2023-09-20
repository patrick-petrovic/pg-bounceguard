import { parse } from 'pgsql-parser'
import type { OneOfFuncCall, RawStmt } from './libpgQuery'
import type { QueryConfig, QueryResult, Client, Pool } from 'pg'
import type { PGBounceGuardConfig, OverrideConfig } from './config'
import { PGBounceGuardError } from './error'

type QueryConfigOrString = string | QueryConfig

export class PGBounceGuard {
  private readonly config: PGBounceGuardConfig

  static wrap(client: Client, config?: Partial<PGBounceGuardConfig>): Client
  static wrap(client: Pool, config?: Partial<PGBounceGuardConfig>): Pool
  static wrap(client: Client | Pool, config: Partial<PGBounceGuardConfig> = {}) {
    const instance = new PGBounceGuard(config)
    // TODO improve stack trace?
    return new Proxy(client, {
      get(target, prop, receiver) {
        if (prop === 'query') {
          // TODO support submittable?
          return async function (conf: any, maybeCb1: any, maybeCb2: any) {
            let cb: ((err: Error, result: QueryResult | null) => void) | null = null
            if (typeof maybeCb2 === 'function') {
              cb = maybeCb2
            } else if (typeof maybeCb1 === 'function') {
              cb = maybeCb1
            }

            if (cb == null) {
              return await instance
                .handleQuery(conf)
                .catch((err: Error) => {
                  Error.captureStackTrace(err)
                  return Promise.reject(err)
                })
                .then(() => target.query(conf))
            }

            instance
              .handleQuery(conf)
              .then(() => {
                ;(target.query as any)(conf, maybeCb1, maybeCb2)
              })
              .catch((err: Error) => {
                cb!(err, null)
              })
          }
        }

        if (typeof (target as any)[prop] !== 'function') {
          return (target as any)[prop]
        }

        return (target as any)[prop].bind(target)
      },
    })
  }

  constructor(config: Partial<PGBounceGuardConfig> = {}) {
    this.config = {
      action: 'error',
      sampleRate: 1,
      overrides: {},
      ...config,
    }
  }

  checkQuery(q: QueryConfigOrString) {
    this.checkNamedQuery(q)
    const parsed = this.parseQuery(q)

    for (const st of parsed) {
      this.checkRawStatement(st.RawStmt.stmt, q)
    }
  }

  private async handleQuery(q: QueryConfigOrString) {
    if (Math.random() > this.config.sampleRate) {
      return
    }

    this.checkQuery(q)
  }

  private static readonly checkMap = {
    prepare: 'checkPrepareStmt',
    set: 'checkVariableSetStmt',
    listen: 'checkListenStmt',
    cursorWithHold: 'checkCursorWithHoldStmt',
    createTempTable: 'checkTemporaryTableStmt',
    load: 'checkLoadStmt',
    advisoryLock: 'checkAdvisoryLocCall',
  } as const

  private checkRawStatement(st: RawStmt['stmt'], q: QueryConfigOrString) {
    for (const [k, method] of Object.entries(PGBounceGuard.checkMap)) {
      const key = k as keyof typeof PGBounceGuard.checkMap
      if (this.config.overrides[key] === 'none') {
        continue
      }
      this[method](st, q)
    }
  }

  private checkNamedQuery(q: QueryConfigOrString) {
    if (typeof q === 'string') {
      return
    }

    if (!q.name) {
      return
    }

    this.handleError('prepare', q, 'remove name from query')
  }

  private checkVariableSetStmt(rawSt: RawStmt['stmt'], q: QueryConfigOrString) {
    if (!('VariableSetStmt' in rawSt)) {
      return
    }

    if (rawSt.VariableSetStmt.is_local) {
      return
    }

    this.handleError('set', q)
  }

  private checkListenStmt(rawSt: RawStmt['stmt'], q: QueryConfigOrString) {
    if (!('ListenStmt' in rawSt)) {
      return
    }

    this.handleError('listen', q)
  }

  private checkPrepareStmt(rawSt: RawStmt['stmt'], q: QueryConfigOrString) {
    if (!('PrepareStmt' in rawSt) && !('DeallocateStmt' in rawSt)) {
      return
    }

    this.handleError('prepare', q)
  }

  private checkCursorWithHoldStmt(rawSt: RawStmt['stmt'], q: QueryConfigOrString) {
    if (!('DeclareCursorStmt' in rawSt)) {
      return
    }

    const isWithHold = rawSt.DeclareCursorStmt.options & 0x10
    if (isWithHold === 0) {
      return
    }

    this.handleError('cursorWithHold', q, 'remove WITH HOLD from cursor declaration')
  }

  private checkTemporaryTableStmt(rawSt: RawStmt['stmt'], q: QueryConfigOrString) {
    if (!('CreateStmt' in rawSt)) {
      return
    }

    const isTemp = rawSt.CreateStmt.relation.relpersistence === 't'
    if (!isTemp) {
      return
    }

    if (rawSt.CreateStmt.oncommit === 'ONCOMMIT_DROP') {
      return
    }

    this.handleError('createTempTable', q, 'use ON COMMIT DROP for temporary tables')
  }

  private checkLoadStmt(rawSt: RawStmt['stmt'], q: QueryConfigOrString) {
    if (!('LoadStmt' in rawSt)) {
      return
    }

    this.handleError('load', q)
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  private checkAdvisoryLocCall(rawSt: RawStmt['stmt'] | OneOfFuncCall | {}, q: QueryConfigOrString) {
    if (typeof rawSt !== 'object') {
      return
    }

    if (Array.isArray(rawSt)) {
      for (const v of rawSt) {
        this.checkAdvisoryLocCall(v, q)
      }
      return
    }

    if (!('FuncCall' in rawSt)) {
      for (const v of Object.values(rawSt)) {
        this.checkAdvisoryLocCall(v, q)
      }
      return
    }

    const isAdvisoryLockFn = rawSt.FuncCall.funcname[0].String.str.includes('advisory_lock')
    if (!isAdvisoryLockFn) {
      return
    }

    this.handleError('advisoryLock', q)
  }

  private handleError(type: keyof OverrideConfig, q: QueryConfigOrString, hint?: string) {
    const action = this.config.overrides[type] ?? this.config.action
    if (action === 'none') {
      return
    }

    if (action === 'warn') {
      console.warn(new PGBounceGuardError(q, type, hint))
      return
    }

    throw new PGBounceGuardError(q, type, hint)
  }

  private parseQuery(q: QueryConfigOrString): Array<{ RawStmt: RawStmt }> {
    if (typeof q === 'string') {
      return parse(q)
    }
    return parse(q.text)
  }
}
