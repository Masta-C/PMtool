import type { StageDefinition } from '@/types/workstation'

export const STAGES: StageDefinition[] = [
  {
    stageId: 'stage_01',
    stationId: 'ws_01',
    name: 'Incoming Inspection / Stores',
    parameters: [
      { parameterId: 'relay_shunt', name: 'Relay & Shunt' },
      { parameterId: 'packaging_condition', name: 'Packaging Condition' },
      { parameterId: 'quantity_check', name: 'Quantity Check' },
      { parameterId: 'visual_inspection', name: 'Visual Inspection' },
      { parameterId: 'documentation', name: 'Documentation' },
    ],
  },
  {
    stageId: 'stage_02',
    stationId: 'ws_02',
    name: 'SMD, Through Hole Soldering & Testing / EMS',
    parameters: [
      { parameterId: 'smd_components', name: 'SMD Components' },
      { parameterId: 'smd_soldering', name: 'SMD Soldering' },
      { parameterId: 'aoi_testing', name: 'AOI Testing' },
      { parameterId: 'through_hole_soldering', name: 'Through Hole Soldering' },
      { parameterId: 'pcb_cleaning', name: 'PCB Cleaning' },
    ],
  },
  {
    stageId: 'stage_03',
    stationId: 'ws_03',
    name: 'PCBA Incoming / Store',
    parameters: [
      { parameterId: 'pcba_visual_inspection', name: 'PCBA Visual Inspection' },
      { parameterId: 'component_placement', name: 'Component Placement' },
      { parameterId: 'solder_joint_quality', name: 'Solder Joint Quality' },
      { parameterId: 'pcba_quantity_check', name: 'PCBA Quantity Check' },
    ],
  },
  {
    stageId: 'stage_04',
    stationId: 'ws_04',
    name: 'Base Assembly',
    parameters: [
      { parameterId: 'base_fitment', name: 'Base Fitment' },
      { parameterId: 'terminal_tightness', name: 'Terminal Tightness' },
      { parameterId: 'pcba_mounting', name: 'PCBA Mounting' },
      { parameterId: 'wiring_harness', name: 'Wiring Harness' },
    ],
  },
  {
    stageId: 'stage_05',
    stationId: 'ws_05',
    name: 'Functional Testing',
    parameters: [
      { parameterId: 'power_on_test', name: 'Power On Test' },
      { parameterId: 'display_check', name: 'Display Check' },
      { parameterId: 'communication_test', name: 'Communication Test' },
      { parameterId: 'accuracy_test', name: 'Accuracy Test' },
      { parameterId: 'lcd_display', name: 'LCD Display' },
    ],
  },
  {
    stageId: 'stage_06',
    stationId: 'ws_06',
    name: 'Cover Assembly',
    parameters: [
      { parameterId: 'cover_fitment', name: 'Cover Fitment' },
      { parameterId: 'screw_tightness', name: 'Screw Tightness' },
      { parameterId: 'terminal_cover', name: 'Terminal Cover' },
      { parameterId: 'gasket_seal', name: 'Gasket Seal' },
    ],
  },
  {
    stageId: 'stage_07',
    stationId: 'ws_07',
    name: 'Error Compensation',
    parameters: [
      { parameterId: 'calibration_check', name: 'Calibration Check' },
      { parameterId: 'error_at_full_load', name: 'Error at Full Load' },
      { parameterId: 'error_at_half_load', name: 'Error at Half Load' },
      { parameterId: 'error_at_light_load', name: 'Error at Light Load' },
      { parameterId: 'ct_ratio_check', name: 'CT Ratio Check' },
    ],
  },
  {
    stageId: 'stage_08',
    stationId: 'ws_08',
    name: 'Tamper Test',
    isTamperTestStage: true,
    parameters: [
      { parameterId: 'magnetic_tamper', name: 'Magnetic Tamper' },
      { parameterId: 'neutral_tamper', name: 'Neutral Tamper' },
      { parameterId: 'cover_open_tamper', name: 'Cover Open Tamper' },
      { parameterId: 'reverse_connection', name: 'Reverse Connection' },
      { parameterId: 'earth_tamper', name: 'Earth Tamper' },
    ],
  },
  {
    stageId: 'stage_09',
    stationId: 'ws_09',
    name: 'HV-IR Test',
    parameters: [
      { parameterId: 'ac_high_voltage', name: 'AC High Voltage Test' },
      { parameterId: 'insulation_resistance', name: 'Insulation Resistance Test' },
      { parameterId: 'impulse_voltage', name: 'Impulse Voltage Test' },
    ],
  },
  {
    stageId: 'stage_10',
    stationId: 'ws_10',
    name: 'Soaking Test',
    parameters: [
      { parameterId: 'soaking_duration', name: 'Soaking Duration' },
      { parameterId: 'soaking_accuracy', name: 'Soaking Accuracy' },
      { parameterId: 'temperature_check', name: 'Temperature Check' },
    ],
  },
  {
    stageId: 'stage_11',
    stationId: 'ws_11',
    name: 'Final Testing',
    parameters: [
      { parameterId: 'final_accuracy', name: 'Final Accuracy' },
      { parameterId: 'display_final', name: 'Display Final Check' },
      { parameterId: 'communication_final', name: 'Communication Final Check' },
      { parameterId: 'sealing_check', name: 'Sealing Check' },
      { parameterId: 'label_check', name: 'Label Check' },
    ],
  },
  {
    stageId: 'stage_12',
    stationId: 'ws_12',
    name: 'Sealing',
    parameters: [
      { parameterId: 'terminal_block_sealing', name: 'Terminal Block Sealing' },
      { parameterId: 'meter_cover_sealing', name: 'Meter Cover Sealing' },
      { parameterId: 'seal_wire_check', name: 'Seal Wire Check' },
    ],
  },
  {
    stageId: 'stage_13',
    stationId: 'ws_13',
    name: 'Packing',
    parameters: [
      { parameterId: 'packing_material', name: 'Packing Material' },
      { parameterId: 'quantity_verification', name: 'Quantity Verification' },
      { parameterId: 'carton_labelling', name: 'Carton Labelling' },
      { parameterId: 'dispatch_document', name: 'Dispatch Document' },
    ],
  },
]

export function getStageByIndex(index: number): StageDefinition {
  return STAGES[index]
}

export function getStageById(stageId: string): StageDefinition | undefined {
  return STAGES.find((s) => s.stageId === stageId)
}

export function getNextStageId(currentStageId: string): string | null {
  const index = STAGES.findIndex((s) => s.stageId === currentStageId)
  if (index === -1 || index === STAGES.length - 1) return null
  return STAGES[index + 1].stageId
}

export function getPreviousStageIds(currentStageId: string): string[] {
  const index = STAGES.findIndex((s) => s.stageId === currentStageId)
  if (index <= 0) return []
  return STAGES.slice(0, index).map((s) => s.stageId)
}

/**
 * Returns the station name with its WS-number prefix derived from the stage's
 * 1-based position in the STAGES order constant.
 *
 * Example: stationLabel('stage_09') → '[WS9] HV-IR Test'
 *
 * Falls back to the bare name if the stageId is not found.
 */
export function stationLabel(stageId: string): string {
  const index = STAGES.findIndex((s) => s.stageId === stageId)
  if (index === -1) return stageId
  const stage = STAGES[index]
  return `[WS${index + 1}] ${stage.name}`
}
