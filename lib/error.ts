import type { QueryConfig } from 'pg'
import type { OverrideConfig } from './config'

export class PGBounceGuardError extends Error {
  readonly query: QueryConfig

  constructor(query: string | QueryConfig, type: keyof OverrideConfig, hint?: string) {
    let msg = `pgBounceGuard: ${PGBounceGuardError.humanReadable[type]} detected`
    if (hint) {
      msg += `\npgBounceGuard: hint: ${hint}`
    }
    super(msg)
    this.query = typeof query === 'string' ? { text: query } : query
  }

  private static readonly humanReadable: { [key in keyof OverrideConfig]: string } = {
    prepare: 'PREPARE/DEALLOCATE statement',
    set: 'SET/RESET statement',
    listen: 'LISTEN statement',
    cursorWithHold: 'CURSOR WITH HOLD statement',
    createTempTable: 'CREATE TEMP TABLE statement',
    load: 'LOAD statement',
    advisoryLock: 'pg_advisory_lock call',
  }
}
