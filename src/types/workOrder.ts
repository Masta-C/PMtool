export type ParameterResult = 'OK' | 'NOT OK' | 'REMARK'

export interface Parameter {
  parameterId: string       // e.g. 'smd_components'
  name: string              // e.g. 'SMD Components'
  value: string             // alphanumeric text input
  result: ParameterResult
}

export interface DraftResults {
  parameters: Partial<Record<string, Pick<Parameter, 'value' | 'result'>>>
  savedAt: string           // ISO timestamp
}

export type MeterStatus = 'queued' | 'in_progress' | 'rework' | 'done'

export interface Meter {
  id: string                // Firestore doc ID = serialNumber
  serialNumber: string
  meterType: string
  status: MeterStatus
  currentStageId: string    // e.g. 'stage_01'
  assignedOperatorId: string | null
  draftResults: DraftResults | null
  createdAt: string
  completedAt: string | null
}

export type StageOverallResult = 'PASSED' | 'FAILED' | 'OVERRIDDEN'

export interface StageHistoryEntry {
  stageId: string           // e.g. 'stage_01'
  stageName: string
  operatorId: string
  parameters: Parameter[]
  overallResult: StageOverallResult
  overrideComment: string | null
  overriddenBy: string | null
  startedAt: string
  submittedAt: string
}

export interface AuditLogEntry {
  id: string
  action: string
  actorUid: string
  actorRole: string
  targetMeterId: string | null
  stageId: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  timestamp: string
}

export interface DailySession {
  date: string              // YYYY-MM-DD
  dayStarted: boolean
  committedCount: number
  stationAssignments: Record<string, string>  // stationId → operatorId
}
