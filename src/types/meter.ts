// Parameter result stored in stageHistory
export interface ParameterResult {
  parameterId: string
  name: string
  numericValue: string // stored as string to preserve exact input
  passed: boolean
}

// Draft saved mid-form
export interface ParameterDraft {
  stageId: string
  parameters: {
    parameterId: string
    numericValue: string
    passed: boolean | null // null = not yet toggled
  }[]
  savedAt: string // ISO timestamp
}

// A single submission attempt at one stage
export interface StageHistoryEntry {
  id: string // Firestore doc ID
  stageId: string
  stageName: string
  operatorId: string
  operatorName: string
  attemptNumber: number // 1 = first, 2 = rework attempt, etc.
  parameters: ParameterResult[]
  failedCount: number
  totalCount: number
  overallResult: 'PASSED' | 'FAILED_ACCEPTED' | 'REWORK'
  reworkTargetStageId?: string // set when overallResult === 'REWORK'
  comment: string
  startedAt: string
  submittedAt: string
}

// Top-level meter document
export interface Meter {
  id: string // Firestore doc ID
  serialNumber: string
  meterType: string
  status: 'queued' | 'in_progress' | 'rework' | 'done'
  currentStageId: string // e.g. 'stage_05'
  assignedOperatorId: string | null
  draftResults: ParameterDraft | null
  createdAt: string
  completedAt: string | null
  reworkCount: number
  lastFailedParams?: string[] // names of params that failed in the most recent stage submission
  taggedFromStageId: string | null
  note?: string // for ad-hoc meters created at WS1
}
