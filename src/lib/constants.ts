// TODO Phase 1 — constants
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  OPERATOR: 'operator',
  QA: 'qa',
} as const

export const ORDER_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  REWORK: 'rework',
  QA_REVIEW: 'qa_review',
  REASSIGNED: 'reassigned',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
} as const

export const WS_COUNT = 13
export const MAX_USERS = 50
export const APP_NAME = 'PMtool'

export const METER_STATUS = {
  QUEUED: 'queued',
  IN_PROGRESS: 'in_progress',
  REWORK: 'rework',
  DONE: 'done',
} as const

export const STAGE_RESULT = {
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  OVERRIDDEN: 'OVERRIDDEN',
} as const

export const PARAMETER_RESULT = {
  OK: 'OK',
  NOT_OK: 'NOT OK',
  REMARK: 'REMARK',
} as const

export const FIRST_STAGE_ID = 'stage_01'
export const LAST_STAGE_ID = 'stage_13'
