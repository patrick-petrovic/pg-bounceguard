import { PGBounceGuardError } from "./error";

export type Action = 'warn' | 'error'
export type ActionOrIgnore = Action | 'ignore'

export interface OverrideConfig {
  prepare: ActionOrIgnore
  set: ActionOrIgnore
  listen: ActionOrIgnore
  cursorWithHold: ActionOrIgnore
  createTempTable: ActionOrIgnore
  load: ActionOrIgnore
  advisoryLock: ActionOrIgnore
}

export interface PGBounceGuardConfig {
  action: Action
  sampleRate: number
  overrides: Partial<OverrideConfig>
  logFn: (err: PGBounceGuardError) => unknown
}
