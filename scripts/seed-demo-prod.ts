/**
 * PRODUCTION DEMO DATA SEED
 * Seeds realistic demo meters + stageHistory into production Firestore.
 * Safe to run multiple times — uses fixed document IDs so it overwrites, not duplicates.
 *
 * Run:
 *   npx ts-node --esm scripts/seed-demo-prod.ts
 *
 * Prereqs: GOOGLE_APPLICATION_CREDENTIALS must point to a service account with
 * Firestore write access, OR run on a machine already authenticated via
 * `firebase login` with application-default credentials.
 */
export {}

import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app'
import { getFirestore, Timestamp, WriteBatch } from 'firebase-admin/firestore'

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
if (!getApps().length) {
  try {
    initializeApp({ credential: applicationDefault(), projectId: 'pmtool-3f8db' })
  } catch {
    initializeApp({ projectId: 'pmtool-3f8db' })
  }
}
const db = getFirestore()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function daysAgo(n: number, hoursOffset = 0): Timestamp {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(d.getHours() - hoursOffset)
  return Timestamp.fromDate(d)
}
function hoursAgo(n: number): Timestamp {
  const d = new Date()
  d.setHours(d.getHours() - n)
  return Timestamp.fromDate(d)
}
function minsAgo(n: number): Timestamp {
  const d = new Date()
  d.setMinutes(d.getMinutes() - n)
  return Timestamp.fromDate(d)
}

// Demo operators — realistic names for the demo floor
const OPERATORS = [
  { uid: 'demo-op-amit',   name: 'Amit Kumar' },
  { uid: 'demo-op-satish', name: 'Satish Nikam' },
  { uid: 'demo-op-priya',  name: 'Priya Patel' },
  { uid: 'demo-op-rajesh', name: 'Rajesh Sharma' },
]

const METER_TYPES = ['Single Phase 5-30A', 'Three Phase 10-60A', 'Single Phase 10-60A']

// Stage definitions (mirrors src/lib/stages.ts)
const STAGES = [
  { stageId: 'stage_01', stationId: 'ws_01', name: 'Incoming Inspection / Stores',
    params: ['relay_shunt|Relay & Shunt', 'packaging_condition|Packaging Condition', 'quantity_check|Quantity Check', 'visual_inspection|Visual Inspection', 'documentation|Documentation'] },
  { stageId: 'stage_02', stationId: 'ws_02', name: 'SMD, Through Hole Soldering & Testing / EMS',
    params: ['smd_components|SMD Components', 'smd_soldering|SMD Soldering', 'aoi_testing|AOI Testing', 'through_hole_soldering|Through Hole Soldering', 'pcb_cleaning|PCB Cleaning'] },
  { stageId: 'stage_03', stationId: 'ws_03', name: 'PCBA Incoming / Store',
    params: ['pcba_visual_inspection|PCBA Visual Inspection', 'component_placement|Component Placement', 'solder_joint_quality|Solder Joint Quality', 'pcba_quantity_check|PCBA Quantity Check'] },
  { stageId: 'stage_04', stationId: 'ws_04', name: 'Base Assembly',
    params: ['base_fitment|Base Fitment', 'terminal_tightness|Terminal Tightness', 'pcba_mounting|PCBA Mounting', 'wiring_harness|Wiring Harness'] },
  { stageId: 'stage_05', stationId: 'ws_05', name: 'Functional Testing',
    params: ['power_on_test|Power On Test', 'display_check|Display Check', 'communication_test|Communication Test', 'accuracy_test|Accuracy Test', 'lcd_display|LCD Display'] },
  { stageId: 'stage_06', stationId: 'ws_06', name: 'Cover Assembly',
    params: ['cover_fitment|Cover Fitment', 'screw_tightness|Screw Tightness', 'terminal_cover|Terminal Cover', 'gasket_seal|Gasket Seal'] },
  { stageId: 'stage_07', stationId: 'ws_07', name: 'Error Compensation',
    params: ['calibration_check|Calibration Check', 'error_at_full_load|Error at Full Load', 'error_at_half_load|Error at Half Load', 'error_at_light_load|Error at Light Load', 'ct_ratio_check|CT Ratio Check'] },
  { stageId: 'stage_08', stationId: 'ws_08', name: 'Tamper Test',
    params: ['magnetic_tamper|Magnetic Tamper', 'neutral_tamper|Neutral Tamper', 'cover_open_tamper|Cover Open Tamper', 'reverse_connection|Reverse Connection', 'earth_tamper|Earth Tamper'] },
  { stageId: 'stage_09', stationId: 'ws_09', name: 'HV-IR Test',
    params: ['ac_high_voltage|AC High Voltage Test', 'insulation_resistance|Insulation Resistance Test', 'impulse_voltage|Impulse Voltage Test'] },
  { stageId: 'stage_10', stationId: 'ws_10', name: 'Soaking Test',
    params: ['soaking_duration|Soaking Duration', 'soaking_accuracy|Soaking Accuracy', 'temperature_check|Temperature Check'] },
  { stageId: 'stage_11', stationId: 'ws_11', name: 'Final Testing',
    params: ['final_accuracy|Final Accuracy', 'display_final|Display Final Check', 'communication_final|Communication Final Check', 'sealing_check|Sealing Check', 'label_check|Label Check'] },
  { stageId: 'stage_12', stationId: 'ws_12', name: 'Sealing',
    params: ['terminal_block_sealing|Terminal Block Sealing', 'meter_cover_sealing|Meter Cover Sealing', 'seal_wire_check|Seal Wire Check'] },
  { stageId: 'stage_13', stationId: 'ws_13', name: 'Packing',
    params: ['packing_material|Packing Material', 'quantity_verification|Quantity Verification', 'carton_labelling|Carton Labelling', 'dispatch_document|Dispatch Document'] },
]

function passEntry(stage: typeof STAGES[0], op: typeof OPERATORS[0], submittedAt: Timestamp, startedAt: Timestamp, attempt = 1) {
  const parameters = stage.params.map(p => {
    const [parameterId, name] = p.split('|')
    return { parameterId, name, numericValue: '1', passed: true }
  })
  return {
    stageId: stage.stageId, stageName: stage.name,
    operatorId: op.uid, operatorName: op.name,
    attemptNumber: attempt,
    parameters,
    failedCount: 0, totalCount: parameters.length,
    overallResult: 'PASSED',
    comment: '',
    startedAt, submittedAt,
  }
}

function failEntry(stage: typeof STAGES[0], op: typeof OPERATORS[0], submittedAt: Timestamp, startedAt: Timestamp, failedIds: string[], comment: string, reworkTarget?: string) {
  const parameters = stage.params.map(p => {
    const [parameterId, name] = p.split('|')
    return { parameterId, name, numericValue: failedIds.includes(parameterId) ? '0' : '1', passed: !failedIds.includes(parameterId) }
  })
  return {
    stageId: stage.stageId, stageName: stage.name,
    operatorId: op.uid, operatorName: op.name,
    attemptNumber: 1,
    parameters,
    failedCount: failedIds.length, totalCount: parameters.length,
    overallResult: 'REWORK',
    reworkTargetStageId: reworkTarget ?? stage.stageId,
    comment,
    startedAt, submittedAt,
  }
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
async function seed() {
  console.log('🌱  Seeding demo data to production pmtool-3f8db...\n')

  // --------------------------------------------------------------------------
  // 1. COMPLETED METERS (10) — these populate the Reports page
  // --------------------------------------------------------------------------
  const completed = [
    { id: 'demo-meter-c01', sn: 'SNE-2026-00101', type: 'Single Phase 5-30A',   createdDaysAgo: 7, completedHoursAgo: 48 },
    { id: 'demo-meter-c02', sn: 'SNE-2026-00102', type: 'Three Phase 10-60A',   createdDaysAgo: 6, completedHoursAgo: 36 },
    { id: 'demo-meter-c03', sn: 'SNE-2026-00103', type: 'Single Phase 5-30A',   createdDaysAgo: 6, completedHoursAgo: 30 },
    { id: 'demo-meter-c04', sn: 'SNE-2026-00104', type: 'Single Phase 10-60A',  createdDaysAgo: 5, completedHoursAgo: 24 },
    { id: 'demo-meter-c05', sn: 'SNE-2026-00105', type: 'Three Phase 10-60A',   createdDaysAgo: 5, completedHoursAgo: 20 },
    { id: 'demo-meter-c06', sn: 'SNE-2026-00106', type: 'Single Phase 5-30A',   createdDaysAgo: 4, completedHoursAgo: 14 },
    { id: 'demo-meter-c07', sn: 'SNE-2026-00107', type: 'Single Phase 10-60A',  createdDaysAgo: 3, completedHoursAgo: 10 },
    { id: 'demo-meter-c08', sn: 'SNE-2026-00108', type: 'Three Phase 10-60A',   createdDaysAgo: 2, completedHoursAgo: 6  },
    { id: 'demo-meter-c09', sn: 'SNE-2026-00109', type: 'Single Phase 5-30A',   createdDaysAgo: 1, completedHoursAgo: 3  },
    { id: 'demo-meter-c10', sn: 'SNE-2026-00110', type: 'Single Phase 5-30A',   createdDaysAgo: 1, completedHoursAgo: 1  },
  ]

  for (const m of completed) {
    const mRef = db.collection('meters').doc(m.id)
    await mRef.set({
      serialNumber: m.sn,
      meterType: m.type,
      status: 'done',
      currentStageId: 'stage_13',
      assignedOperatorId: null,
      draftResults: null,
      createdAt: daysAgo(m.createdDaysAgo),
      completedAt: hoursAgo(m.completedHoursAgo),
      reworkCount: 0,
      taggedFromStageId: null,
    })

    // Full 13-stage pass history
    for (let i = 0; i < STAGES.length; i++) {
      const stage = STAGES[i]
      const op = OPERATORS[i % OPERATORS.length]
      const t = daysAgo(m.createdDaysAgo - i * 0.4, i)
      await mRef.collection('stageHistory').doc(`${m.id}-s${String(i+1).padStart(2,'0')}`).set(
        passEntry(stage, op, t, t)
      )
    }
    console.log(`  ✓ ${m.sn} — done (13 stages)`)
  }

  // --------------------------------------------------------------------------
  // 2. METERS WITH FAILURES/REWORK (5) — populates Failure History report
  // --------------------------------------------------------------------------

  // Rework at Functional Testing (stage_05)
  const r01Ref = db.collection('meters').doc('demo-meter-r01')
  await r01Ref.set({
    serialNumber: 'SNE-2026-00201', meterType: 'Single Phase 5-30A',
    status: 'rework', currentStageId: 'stage_05',
    assignedOperatorId: null, draftResults: null,
    createdAt: daysAgo(3), completedAt: null, reworkCount: 1,
    taggedFromStageId: 'stage_05',
  })
  for (let i = 0; i < 4; i++) {
    const stage = STAGES[i], op = OPERATORS[i % OPERATORS.length]
    await r01Ref.collection('stageHistory').doc(`r01-s${i+1}`).set(passEntry(stage, op, daysAgo(3 - i * 0.5), daysAgo(3 - i * 0.5)))
  }
  await r01Ref.collection('stageHistory').doc('r01-s5-fail').set(
    failEntry(STAGES[4], OPERATORS[1], hoursAgo(8), hoursAgo(9), ['display_check', 'accuracy_test'],
      'Display flickering, accuracy outside ±1% tolerance', 'stage_05')
  )
  console.log('  ✓ SNE-2026-00201 — rework at Functional Testing')

  // Rework at Error Compensation (stage_07)
  const r02Ref = db.collection('meters').doc('demo-meter-r02')
  await r02Ref.set({
    serialNumber: 'SNE-2026-00202', meterType: 'Three Phase 10-60A',
    status: 'rework', currentStageId: 'stage_07',
    assignedOperatorId: null, draftResults: null,
    createdAt: daysAgo(4), completedAt: null, reworkCount: 1,
    taggedFromStageId: 'stage_07',
  })
  for (let i = 0; i < 6; i++) {
    const stage = STAGES[i], op = OPERATORS[i % OPERATORS.length]
    await r02Ref.collection('stageHistory').doc(`r02-s${i+1}`).set(passEntry(stage, op, daysAgo(4 - i * 0.3), daysAgo(4 - i * 0.3)))
  }
  await r02Ref.collection('stageHistory').doc('r02-s7-fail').set(
    failEntry(STAGES[6], OPERATORS[2], hoursAgo(12), hoursAgo(13), ['error_at_full_load', 'ct_ratio_check'],
      'Full load error exceeds limit, CT ratio mismatch', 'stage_07')
  )
  console.log('  ✓ SNE-2026-00202 — rework at Error Compensation')

  // Rework at Tamper Test (stage_08)
  const r03Ref = db.collection('meters').doc('demo-meter-r03')
  await r03Ref.set({
    serialNumber: 'SNE-2026-00203', meterType: 'Single Phase 10-60A',
    status: 'rework', currentStageId: 'stage_08',
    assignedOperatorId: null, draftResults: null,
    createdAt: daysAgo(2), completedAt: null, reworkCount: 1,
    taggedFromStageId: 'stage_08',
  })
  for (let i = 0; i < 7; i++) {
    const stage = STAGES[i], op = OPERATORS[i % OPERATORS.length]
    await r03Ref.collection('stageHistory').doc(`r03-s${i+1}`).set(passEntry(stage, op, daysAgo(2 - i * 0.2), daysAgo(2 - i * 0.2)))
  }
  await r03Ref.collection('stageHistory').doc('r03-s8-fail').set(
    failEntry(STAGES[7], OPERATORS[0], hoursAgo(5), hoursAgo(6), ['magnetic_tamper', 'neutral_tamper'],
      'Magnetic and neutral tamper seals not holding', 'stage_08')
  )
  console.log('  ✓ SNE-2026-00203 — rework at Tamper Test')

  // Completed after rework at stage_05 — shows reworkCount=1 in reports
  const r04Ref = db.collection('meters').doc('demo-meter-r04')
  await r04Ref.set({
    serialNumber: 'SNE-2026-00204', meterType: 'Three Phase 10-60A',
    status: 'done', currentStageId: 'stage_13',
    assignedOperatorId: null, draftResults: null,
    createdAt: daysAgo(5), completedAt: hoursAgo(18), reworkCount: 1,
    taggedFromStageId: null,
  })
  for (let i = 0; i < 4; i++) {
    const stage = STAGES[i], op = OPERATORS[i % OPERATORS.length]
    await r04Ref.collection('stageHistory').doc(`r04-s${i+1}`).set(passEntry(stage, op, daysAgo(5 - i * 0.4), daysAgo(5 - i * 0.4)))
  }
  // Fail on attempt 1
  await r04Ref.collection('stageHistory').doc('r04-s5-fail').set(
    failEntry(STAGES[4], OPERATORS[3], daysAgo(3, 2), daysAgo(3, 3), ['accuracy_test'],
      'Accuracy slightly off — recalibrated', 'stage_05')
  )
  // Pass on attempt 2
  await r04Ref.collection('stageHistory').doc('r04-s5-pass').set(
    passEntry(STAGES[4], OPERATORS[3], daysAgo(3), daysAgo(3, 1), 2)
  )
  for (let i = 5; i < STAGES.length; i++) {
    const stage = STAGES[i], op = OPERATORS[i % OPERATORS.length]
    const t = daysAgo(3 - (i - 5) * 0.3)
    await r04Ref.collection('stageHistory').doc(`r04-s${i+1}`).set(passEntry(stage, op, t, t))
  }
  console.log('  ✓ SNE-2026-00204 — done after rework (reworkCount=1)')

  // Completed after tamper rework
  const r05Ref = db.collection('meters').doc('demo-meter-r05')
  await r05Ref.set({
    serialNumber: 'SNE-2026-00205', meterType: 'Single Phase 5-30A',
    status: 'done', currentStageId: 'stage_13',
    assignedOperatorId: null, draftResults: null,
    createdAt: daysAgo(6), completedAt: hoursAgo(22), reworkCount: 1,
    taggedFromStageId: null,
  })
  for (let i = 0; i < 7; i++) {
    const stage = STAGES[i], op = OPERATORS[i % OPERATORS.length]
    await r05Ref.collection('stageHistory').doc(`r05-s${i+1}`).set(passEntry(stage, op, daysAgo(6 - i * 0.3), daysAgo(6 - i * 0.3)))
  }
  await r05Ref.collection('stageHistory').doc('r05-s8-fail').set(
    failEntry(STAGES[7], OPERATORS[2], daysAgo(2, 4), daysAgo(2, 5), ['earth_tamper'],
      'Earth tamper seal failure — re-sealed', 'stage_08')
  )
  await r05Ref.collection('stageHistory').doc('r05-s8-pass').set(
    passEntry(STAGES[7], OPERATORS[2], daysAgo(2, 2), daysAgo(2, 3), 2)
  )
  for (let i = 8; i < STAGES.length; i++) {
    const stage = STAGES[i], op = OPERATORS[i % OPERATORS.length]
    const t = daysAgo(2 - (i - 8) * 0.2)
    await r05Ref.collection('stageHistory').doc(`r05-s${i+1}`).set(passEntry(stage, op, t, t))
  }
  console.log('  ✓ SNE-2026-00205 — done after tamper rework (reworkCount=1)')

  // --------------------------------------------------------------------------
  // 3. IN-PROGRESS METERS (12) — populates Workstation queue + Dashboard
  // --------------------------------------------------------------------------
  const inProgress = [
    { id: 'demo-meter-p01', sn: 'SNE-2026-00301', type: 'Single Phase 5-30A',  stageIdx: 0, minsAgoCreated: 45  },
    { id: 'demo-meter-p02', sn: 'SNE-2026-00302', type: 'Three Phase 10-60A',  stageIdx: 0, minsAgoCreated: 30  },
    { id: 'demo-meter-p03', sn: 'SNE-2026-00303', type: 'Single Phase 10-60A', stageIdx: 1, minsAgoCreated: 180 },
    { id: 'demo-meter-p04', sn: 'SNE-2026-00304', type: 'Single Phase 5-30A',  stageIdx: 2, minsAgoCreated: 300 },
    { id: 'demo-meter-p05', sn: 'SNE-2026-00305', type: 'Three Phase 10-60A',  stageIdx: 3, minsAgoCreated: 480 },
    { id: 'demo-meter-p06', sn: 'SNE-2026-00306', type: 'Single Phase 5-30A',  stageIdx: 4, minsAgoCreated: 600 },
    { id: 'demo-meter-p07', sn: 'SNE-2026-00307', type: 'Three Phase 10-60A',  stageIdx: 5, minsAgoCreated: 720 },
    { id: 'demo-meter-p08', sn: 'SNE-2026-00308', type: 'Single Phase 10-60A', stageIdx: 6, minsAgoCreated: 840 },
    { id: 'demo-meter-p09', sn: 'SNE-2026-00309', type: 'Single Phase 5-30A',  stageIdx: 7, minsAgoCreated: 960 },
    { id: 'demo-meter-p10', sn: 'SNE-2026-00310', type: 'Three Phase 10-60A',  stageIdx: 8, minsAgoCreated: 1200 },
    { id: 'demo-meter-p11', sn: 'SNE-2026-00311', type: 'Single Phase 5-30A',  stageIdx: 10, minsAgoCreated: 1440 },
    { id: 'demo-meter-p12', sn: 'SNE-2026-00312', type: 'Single Phase 10-60A', stageIdx: 11, minsAgoCreated: 1560 },
  ]

  for (const m of inProgress) {
    const stage = STAGES[m.stageIdx]
    const mRef = db.collection('meters').doc(m.id)
    await mRef.set({
      serialNumber: m.sn,
      meterType: m.type,
      status: 'queued',
      currentStageId: stage.stageId,
      assignedOperatorId: null,
      draftResults: null,
      createdAt: minsAgo(m.minsAgoCreated),
      completedAt: null,
      reworkCount: 0,
      taggedFromStageId: null,
    })

    // Add pass history for all stages before the current one
    for (let i = 0; i < m.stageIdx; i++) {
      const s = STAGES[i]
      const op = OPERATORS[i % OPERATORS.length]
      const t = minsAgo(m.minsAgoCreated - i * 60)
      await mRef.collection('stageHistory').doc(`${m.id}-s${i+1}`).set(passEntry(s, op, t, t))
    }

    console.log(`  ✓ ${m.sn} — queued at ${stage.name}`)
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log(`
═══════════════════════════════════════════════
  Demo seed complete ✓
═══════════════════════════════════════════════

  Completed meters (reports):      15  (10 clean + 5 with rework history)
  In-progress meters (workstations): 12  (across WS1–WS12)
  Rework meters:                    3   (at WS5, WS7, WS8)

  Serial numbers: SNE-2026-00101 to 00312

  Reports you can demo:
    Production Report  — filter by date range, see throughput
    Failure History    — filter by stage or date
    Tamper Test        — SNE-2026-00203 and 00205 show tamper failures

  Dashboard will show:
    ~27 meters in progress across all stages
═══════════════════════════════════════════════
`)
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
