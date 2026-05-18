export interface StageParameter {
  parameterId: string
  name: string
}

export interface StageDefinition {
  stageId: string           // 'stage_01' … 'stage_13'
  stationId: string         // 'ws_01' … 'ws_13'
  name: string
  parameters: StageParameter[]
  isTamperTestStage?: boolean  // true for stage_08 only
}
