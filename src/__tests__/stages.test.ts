import { STAGES, getNextStageId, getPreviousStageIds } from '@/lib/stages'

describe('STAGES', () => {
  it('has exactly 13 entries', () => {
    expect(STAGES).toHaveLength(13)
  })

  it('each stage has at least 1 parameter', () => {
    for (const stage of STAGES) {
      expect(stage.parameters.length).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('getNextStageId', () => {
  it('returns null for stage_13', () => {
    expect(getNextStageId('stage_13')).toBeNull()
  })

  it('returns stage_02 for stage_01', () => {
    expect(getNextStageId('stage_01')).toBe('stage_02')
  })
})

describe('getPreviousStageIds', () => {
  it('returns [] for stage_01', () => {
    expect(getPreviousStageIds('stage_01')).toEqual([])
  })

  it('returns stage_01 through stage_04 for stage_05', () => {
    expect(getPreviousStageIds('stage_05')).toEqual([
      'stage_01',
      'stage_02',
      'stage_03',
      'stage_04',
    ])
  })
})

describe('stage_08', () => {
  it('has isTamperTestStage === true', () => {
    const stage08 = STAGES.find((s) => s.stageId === 'stage_08')
    expect(stage08?.isTamperTestStage).toBe(true)
  })
})
