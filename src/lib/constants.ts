// TODO Phase 1 — constants
export const ROLES = {
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
