export {}
// Set emulator env vars BEFORE any firebase-admin module loads
// Dynamic imports below ensure this runs first
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'

if (process.env.NEXT_PUBLIC_USE_EMULATOR !== 'true') {
  console.error('SEED ABORTED: Not running against emulator. Set NEXT_PUBLIC_USE_EMULATOR=true')
  process.exit(1)
}

const { initializeApp } = await import('firebase-admin/app')
const { getFirestore, FieldValue } = await import('firebase-admin/firestore')

initializeApp({ projectId: 'pmtool-3f8db' })
const db = getFirestore()

async function seed() {
  // Seed 13 workstations
  const wsBatch = db.batch()
  for (let i = 1; i <= 13; i++) {
    const wsId = `ws_${String(i).padStart(2, '0')}`
    const name = `Workstation ${String(i).padStart(2, '0')} [TBD]`
    wsBatch.set(db.collection('workstations').doc(wsId), {
      wsId,
      name,
      processOrder: i,
      passRules: [],
      assignedOperatorIds: [],
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
    })
  }
  await wsBatch.commit()
  console.log('✓ Seeded 13 workstations')

  // Seed 5 test users
  const users = [
    { uid: 'test-super-admin', displayName: 'Super Admin Test', email: 'superadmin@pmtool.dev', role: 'super_admin', workstationIds: [] },
    { uid: 'test-admin', displayName: 'Admin Test', email: 'admin@pmtool.dev', role: 'admin', workstationIds: [] },
    { uid: 'test-supervisor', displayName: 'Supervisor Test', email: 'supervisor@pmtool.dev', role: 'supervisor', workstationIds: [] },
    { uid: 'test-operator', displayName: 'Operator Test', email: 'operator@pmtool.dev', role: 'operator', workstationIds: ['ws_01'] },
    { uid: 'test-qa', displayName: 'QA Test', email: 'qa@pmtool.dev', role: 'qa', workstationIds: [] },
  ]
  const userBatch = db.batch()
  for (const user of users) {
    userBatch.set(db.collection('users').doc(user.uid), {
      ...user,
      shiftId: null,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
    })
  }
  await userBatch.commit()
  console.log('✓ Seeded 5 test users')

  // Seed 3 sample work orders
  const orders = [
    { id: 'WO-2026-00001', status: 'pending', productId: 'prod_placeholder', currentWsId: 'ws_01', assignedOperatorId: null, reworkCount: 0, priority: 'normal' },
    { id: 'WO-2026-00002', status: 'in_progress', productId: 'prod_placeholder', currentWsId: 'ws_01', assignedOperatorId: 'test-operator', reworkCount: 0, priority: 'normal' },
    { id: 'WO-2026-00003', status: 'rework', productId: 'prod_placeholder', currentWsId: 'ws_02', assignedOperatorId: null, reworkCount: 1, priority: 'normal' },
  ]
  const orderBatch = db.batch()
  for (const order of orders) {
    const { id, ...data } = order
    orderBatch.set(db.collection('workOrders').doc(id), {
      ...data,
      createdAt: FieldValue.serverTimestamp(),
    })
  }
  await orderBatch.commit()
  console.log('✓ Seeded 3 sample work orders')

  // Seed 5 test meters spread across different stages
  const now = new Date()
  function daysAgo(n: number) {
    const d = new Date(now)
    d.setDate(d.getDate() - n)
    return d.toISOString()
  }
  function hoursAgo(n: number) {
    const d = new Date(now)
    d.setHours(d.getHours() - n)
    return d.toISOString()
  }

  // Meter 1 — stage_01, queued (just arrived)
  const meter1Ref = db.collection('meters').doc('meter-test-001')
  await meter1Ref.set({
    serialNumber: 'SN-2026-00001',
    meterType: 'Single Phase 5-30A',
    status: 'queued',
    currentStageId: 'stage_01',
    assignedOperatorId: null,
    draftResults: null,
    createdAt: hoursAgo(2),
    completedAt: null,
    reworkCount: 0,
    taggedFromStageId: null,
  })
  console.log('✓ Seeded meter-test-001 (stage_01, queued)')

  // Meter 6 — stage_01, queued (arrived 45 min ago)
  const meter6Ref = db.collection('meters').doc('meter-test-006')
  await meter6Ref.set({
    serialNumber: 'SN-2026-00006',
    meterType: 'Three Phase 10-60A',
    status: 'queued',
    currentStageId: 'stage_01',
    assignedOperatorId: null,
    draftResults: null,
    createdAt: hoursAgo(1),
    completedAt: null,
    reworkCount: 0,
    taggedFromStageId: null,
  })
  console.log('✓ Seeded meter-test-006 (stage_01, queued)')

  // Meter 7 — stage_01, queued (arrived 15 min ago)
  const meter7Ref = db.collection('meters').doc('meter-test-007')
  await meter7Ref.set({
    serialNumber: 'SN-2026-00007',
    meterType: 'Single Phase 5-30A',
    status: 'queued',
    currentStageId: 'stage_01',
    assignedOperatorId: null,
    draftResults: null,
    createdAt: hoursAgo(0),
    completedAt: null,
    reworkCount: 0,
    taggedFromStageId: null,
  })
  console.log('✓ Seeded meter-test-007 (stage_01, queued)')

  // Meter 2 — stage_05, queued (passed WS1–WS4 cleanly)
  const meter2Ref = db.collection('meters').doc('meter-test-002')
  await meter2Ref.set({
    serialNumber: 'SN-2026-00002',
    meterType: 'Three Phase 10-60A',
    status: 'queued',
    currentStageId: 'stage_05',
    assignedOperatorId: null,
    draftResults: null,
    createdAt: daysAgo(2),
    completedAt: null,
    reworkCount: 0,
    taggedFromStageId: null,
  })
  // Add 2 stageHistory entries showing it passed WS1–WS2 (representative)
  const m2h1Ref = meter2Ref.collection('stageHistory').doc()
  await m2h1Ref.set({
    stageId: 'stage_01',
    stageName: 'Incoming Inspection / Stores',
    operatorId: 'test-operator',
    operatorName: 'Operator Test',
    attemptNumber: 1,
    parameters: [
      { parameterId: 'relay_shunt', name: 'Relay & Shunt', numericValue: '1', passed: true },
      { parameterId: 'packaging_condition', name: 'Packaging Condition', numericValue: '1', passed: true },
      { parameterId: 'quantity_check', name: 'Quantity Check', numericValue: '50', passed: true },
      { parameterId: 'visual_inspection', name: 'Visual Inspection', numericValue: '1', passed: true },
      { parameterId: 'documentation', name: 'Documentation', numericValue: '1', passed: true },
    ],
    failedCount: 0,
    totalCount: 5,
    overallResult: 'PASSED',
    comment: 'All checks passed on arrival',
    startedAt: daysAgo(2),
    submittedAt: daysAgo(2),
  })
  const m2h2Ref = meter2Ref.collection('stageHistory').doc()
  await m2h2Ref.set({
    stageId: 'stage_02',
    stageName: 'SMD, Through Hole Soldering & Testing / EMS',
    operatorId: 'test-operator',
    operatorName: 'Operator Test',
    attemptNumber: 1,
    parameters: [
      { parameterId: 'smd_components', name: 'SMD Components', numericValue: '1', passed: true },
      { parameterId: 'smd_soldering', name: 'SMD Soldering', numericValue: '1', passed: true },
      { parameterId: 'aoi_testing', name: 'AOI Testing', numericValue: '1', passed: true },
      { parameterId: 'through_hole_soldering', name: 'Through Hole Soldering', numericValue: '1', passed: true },
      { parameterId: 'pcb_cleaning', name: 'PCB Cleaning', numericValue: '1', passed: true },
    ],
    failedCount: 0,
    totalCount: 5,
    overallResult: 'PASSED',
    comment: '',
    startedAt: daysAgo(1),
    submittedAt: daysAgo(1),
  })
  console.log('✓ Seeded meter-test-002 (stage_05, queued, 2 history entries)')

  // Meter 3 — stage_05, rework (reworkCount=1, prior failure at stage_05)
  const meter3Ref = db.collection('meters').doc('meter-test-003')
  await meter3Ref.set({
    serialNumber: 'SN-2026-00003',
    meterType: 'Single Phase 5-30A',
    status: 'rework',
    currentStageId: 'stage_05',
    assignedOperatorId: null,
    draftResults: null,
    createdAt: daysAgo(3),
    completedAt: null,
    reworkCount: 1,
    taggedFromStageId: 'stage_05',
  })
  // stageHistory: one failure entry
  const m3h1Ref = meter3Ref.collection('stageHistory').doc()
  await m3h1Ref.set({
    stageId: 'stage_05',
    stageName: 'Functional Testing',
    operatorId: 'test-operator',
    operatorName: 'Operator Test',
    attemptNumber: 1,
    parameters: [
      { parameterId: 'power_on_test', name: 'Power On Test', numericValue: '1', passed: true },
      { parameterId: 'display_check', name: 'Display Check', numericValue: '1', passed: false },
      { parameterId: 'communication_test', name: 'Communication Test', numericValue: '1', passed: true },
      { parameterId: 'accuracy_test', name: 'Accuracy Test', numericValue: '0.95', passed: false },
      { parameterId: 'lcd_display', name: 'LCD Display', numericValue: '1', passed: true },
    ],
    failedCount: 2,
    totalCount: 5,
    overallResult: 'REWORK',
    reworkTargetStageId: 'stage_05',
    comment: 'Display and accuracy failed — rework needed',
    startedAt: hoursAgo(6),
    submittedAt: hoursAgo(5),
  })
  console.log('✓ Seeded meter-test-003 (stage_05, rework, reworkCount=1)')

  // Meter 4 — stage_09, queued (clean history, no stageHistory entries needed)
  const meter4Ref = db.collection('meters').doc('meter-test-004')
  await meter4Ref.set({
    serialNumber: 'SN-2026-00004',
    meterType: 'Three Phase 10-60A',
    status: 'queued',
    currentStageId: 'stage_09',
    assignedOperatorId: null,
    draftResults: null,
    createdAt: daysAgo(5),
    completedAt: null,
    reworkCount: 0,
    taggedFromStageId: null,
  })
  console.log('✓ Seeded meter-test-004 (stage_09, queued)')

  // Meter 5 — done (completed all 13 stages, status='done')
  const meter5Ref = db.collection('meters').doc('meter-test-005')
  await meter5Ref.set({
    serialNumber: 'SN-2026-00005',
    meterType: 'Single Phase 5-30A',
    status: 'done',
    currentStageId: 'stage_13',
    assignedOperatorId: null,
    draftResults: null,
    createdAt: daysAgo(7),
    completedAt: hoursAgo(1),
    reworkCount: 0,
    taggedFromStageId: null,
  })
  // Add a representative final stageHistory entry (stage_13)
  const m5h1Ref = meter5Ref.collection('stageHistory').doc()
  await m5h1Ref.set({
    stageId: 'stage_13',
    stageName: 'Packing',
    operatorId: 'test-operator',
    operatorName: 'Operator Test',
    attemptNumber: 1,
    parameters: [
      { parameterId: 'packing_material', name: 'Packing Material', numericValue: '1', passed: true },
      { parameterId: 'quantity_verification', name: 'Quantity Verification', numericValue: '50', passed: true },
      { parameterId: 'carton_labelling', name: 'Carton Labelling', numericValue: '1', passed: true },
      { parameterId: 'dispatch_document', name: 'Dispatch Document', numericValue: '1', passed: true },
    ],
    failedCount: 0,
    totalCount: 4,
    overallResult: 'PASSED',
    comment: 'Ready for dispatch',
    startedAt: hoursAgo(3),
    submittedAt: hoursAgo(1),
  })
  console.log('✓ Seeded meter-test-005 (stage_13, done, full history)')

  console.log('Seed complete. Open localhost:4000 to verify in Emulator UI')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
