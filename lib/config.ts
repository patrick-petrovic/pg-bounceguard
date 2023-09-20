export type Action = 'warn' | 'error'
export type ActionOrNone = Action | 'none'

export interface OverrideConfig {
  prepare: ActionOrNone
  set: ActionOrNone
  listen: ActionOrNone
  cursorWithHold: ActionOrNone
  createTempTable: ActionOrNone
  load: ActionOrNone
  advisoryLock: ActionOrNone
}

export interface PGBounceGuardConfig {
  action: Action
  sampleRate: number
  overrides: Partial<OverrideConfig>
}
