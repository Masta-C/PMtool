export {}
/**
 * Production Bootstrap Script
 * Run once on day zero to create your admin account + seed initial data.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   ADMIN_EMAIL=you@yourcompany.com \
 *   ADMIN_PASSWORD=YourSecurePass123! \
 *   ADMIN_NAME="Your Name" \
 *   npm run bootstrap:prod
 *
 * What this does:
 *   1. Creates your admin account in Firebase Auth + Firestore
 *   2. Seeds 13 workstations with real names (isDemoData: false — survives wipe)
 *   3. Seeds 4 demo users (supervisor, 2 operators, 1 QA) — isDemoData: true
 *   4. Seeds 3 demo work orders — isDemoData: true
 *   5. Seeds 15 demo meters spread across all stages — isDemoData: true
 *
 * To wipe demo data later (before go-live): npm run wipe:demo
 */

// ─── Preflight checks ─────────────────────────────────────────────────────────
const saKeyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
const adminEmail = process.env.ADMIN_EMAIL
const adminPassword = process.env.ADMIN_PASSWORD
const adminName = process.env.ADMIN_NAME ?? 'Admin'

if (!saKeyPath) {
  console.error('❌  Missing GOOGLE_APPLICATION_CREDENTIALS — point it at your service account JSON')
  process.exit(1)
}
if (!adminEmail || !adminPassword) {
  console.error('❌  Set ADMIN_EMAIL and ADMIN_PASSWORD env vars')
  process.exit(1)
}
if (adminPassword.length < 8) {
  console.error('❌  ADMIN_PASSWORD must be at least 8 characters')
  process.exit(1)
}

// ─── Firebase init ────────────────────────────────────────────────────────────
const { readFileSync } = await import('fs')
const { initializeApp, cert } = await import('firebase-admin/app')
const { getAuth } = await import('firebase-admin/auth')
const { getFirestore, FieldValue, Timestamp } = await import('firebase-admin/firestore')

const serviceAccount = JSON.parse(readFileSync(saKeyPath, 'utf8'))
initializeApp({ credential: cert(serviceAccount) })

const auth = getAuth()
const db = getFirestore()

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return Timestamp.fromDate(d)
}
function hoursAgo(n: number) {
  const d = new Date()
  d.setHours(d.getHours() - n)
  return Timestamp.fromDate(d)
}

// ─── 1. Admin user ────────────────────────────────────────────────────────────
async function createAdminUser(): Promise<string> {
  let uid: string
  try {
    const existing = await auth.getUserByEmail(adminEmail!)
    uid = existing.uid
    console.log(`ℹ️  Admin ${adminEmail} already exists (${uid}) — updating claims`)
  } catch {
    const user = await auth.createUser({
      email: adminEmail,
      password: adminPassword,
      displayName: adminName,
    })
    uid = user.uid
    console.log(`✓ Created admin in Firebase Auth (${uid})`)
  }

  await auth.setCustomUserClaims(uid, { role: 'admin' })
  await db.collection('users').doc(uid).set(
    {
      uid,
      email: adminEmail,
      displayName: adminName,
      role: 'admin',
      workstationIds: [],
      shiftId: null,
      isActive: true,
      isDemoData: false,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  console.log(`✓ Admin Firestore doc ready  role=admin  isDemoData=false`)
  return uid
}

// ─── 2. Workstations ──────────────────────────────────────────────────────────
const WORKSTATIONS = [
  { wsId: 'ws_01', name: 'Incoming Inspection / Stores' },
  { wsId: 'ws_02', name: 'SMD, Through Hole Soldering & Testing / EMS' },
  { wsId: 'ws_03', name: 'PCBA Incoming / Store' },
  { wsId: 'ws_04', name: 'Base Assembly' },
  { wsId: 'ws_05', name: 'Functional Testing' },
  { wsId: 'ws_06', name: 'Cover Assembly' },
  { wsId: 'ws_07', name: 'Error Compensation' },
  { wsId: 'ws_08', name: 'Tamper Test' },
  { wsId: 'ws_09', name: 'HV-IR Test' },
  { wsId: 'ws_10', name: 'Soaking Test' },
  { wsId: 'ws_11', name: 'Final Testing' },
  { wsId: 'ws_12', name: 'Sealing' },
  { wsId: 'ws_13', name: 'Packing' },
]

async function seedWorkstations() {
  const batch = db.batch()
  WORKSTATIONS.forEach((ws, i) => {
    batch.set(
      db.collection('workstations').doc(ws.wsId),
      {
        ...ws,
        stageId: `stage_${String(i + 1).padStart(2, '0')}`,
        processOrder: i + 1,
        passRules: [],
        assignedOperatorIds: [],
        isActive: true,
        isDemoData: false, // workstations are real config — survives wipe
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  })
  await batch.commit()
  console.log('✓ Seeded 13 workstations  isDemoData=false')
}

// ─── 3. Demo users ────────────────────────────────────────────────────────────
const DEMO_USERS = [
  {
    email: 'rajesh.sharma@pmtool.demo',
    displayName: 'Rajesh Sharma',
    role: 'supervisor',
    workstationIds: [],
  },
  {
    email: 'priya.patel@pmtool.demo',
    displayName: 'Priya Patel',
    role: 'operator',
    workstationIds: ['ws_01', 'ws_02'],
  },
  {
    email: 'amit.kumar@pmtool.demo',
    displayName: 'Amit Kumar',
    role: 'operator',
    workstationIds: ['ws_05', 'ws_07'],
  },
  {
    email: 'sneha.reddy@pmtool.demo',
    displayName: 'Sneha Reddy',
    role: 'qa',
    workstationIds: [],
  },
]

const DEMO_PASSWORD = 'Demo1234!'

async function seedDemoUsers(): Promise<Record<string, string>> {
  const emailToUid: Record<string, string> = {}
  for (const u of DEMO_USERS) {
    let uid: string
    try {
      const existing = await auth.getUserByEmail(u.email)
      uid = existing.uid
      console.log(`ℹ️  Demo user ${u.email} already exists`)
    } catch {
      const created = await auth.createUser({
        email: u.email,
        password: DEMO_PASSWORD,
        displayName: u.displayName,
      })
      uid = created.uid
    }
    await auth.setCustomUserClaims(uid, { role: u.role })
    await db.collection('users').doc(uid).set(
      {
        uid,
        ...u,
        shiftId: null,
        isActive: true,
        isDemoData: true,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    emailToUid[u.email] = uid
    console.log(`✓ Demo user: ${u.displayName.padEnd(18)} role=${u.role}`)
  }
  return emailToUid
}

// ─── 4. Demo work orders ─────────────────────────────────────────────────────
async function seedDemoWorkOrders() {
  const orders = [
    {
      id: 'WO-2026-D001',
      status: 'in_progress',
      currentWsId: 'ws_01',
      priority: 'normal',
      quantity: 50,
    },
    {
      id: 'WO-2026-D002',
      status: 'in_progress',
      currentWsId: 'ws_05',
      priority: 'high',
      quantity: 30,
    },
    {
      id: 'WO-2026-D003',
      status: 'in_progress',
      currentWsId: 'ws_09',
      priority: 'normal',
      quantity: 20,
    },
  ]
  const batch = db.batch()
  orders.forEach((o) => {
    const { id, ...data } = o
    batch.set(db.collection('workOrders').doc(id), {
      ...data,
      productId: 'prod_placeholder',
      assignedOperatorId: null,
      reworkCount: 0,
      isDemoData: true,
      createdAt: FieldValue.serverTimestamp(),
    })
  })
  await batch.commit()
  console.log('✓ Seeded 3 demo work orders')
}

// ─── 5. Demo meters ───────────────────────────────────────────────────────────
// passResult helpers — generate realistic pass entries for common stages
function passEntry(
  stageId: string,
  stageName: string,
  params: { parameterId: string; name: string }[],
  operatorId: string,
  operatorName: string,
  submittedAt: FirebaseFirestore.Timestamp,
  attemptNumber = 1,
) {
  return {
    stageId,
    stageName,
    operatorId,
    operatorName,
    attemptNumber,
    parameters: params.map((p) => ({ ...p, numericValue: '1', passed: true })),
    failedCount: 0,
    totalCount: params.length,
    overallResult: 'PASSED',
    comment: '',
    startedAt: submittedAt,
    submittedAt,
  }
}

async function seedDemoMeters(uids: Record<string, string>) {
  const priya = uids['priya.patel@pmtool.demo'] ?? 'demo-operator-1'
  const amit = uids['amit.kumar@pmtool.demo'] ?? 'demo-operator-2'

  // Inline stage param map (keep script self-contained)
  const stageParams: Record<string, { parameterId: string; name: string }[]> = {
    stage_01: [
      { parameterId: 'relay_shunt', name: 'Relay & Shunt' },
      { parameterId: 'packaging_condition', name: 'Packaging Condition' },
      { parameterId: 'quantity_check', name: 'Quantity Check' },
      { parameterId: 'visual_inspection', name: 'Visual Inspection' },
      { parameterId: 'documentation', name: 'Documentation' },
    ],
    stage_02: [
      { parameterId: 'smd_components', name: 'SMD Components' },
      { parameterId: 'smd_soldering', name: 'SMD Soldering' },
      { parameterId: 'aoi_testing', name: 'AOI Testing' },
      { parameterId: 'through_hole_soldering', name: 'Through Hole Soldering' },
      { parameterId: 'pcb_cleaning', name: 'PCB Cleaning' },
    ],
    stage_03: [
      { parameterId: 'pcba_visual_inspection', name: 'PCBA Visual Inspection' },
      { parameterId: 'component_placement', name: 'Component Placement' },
      { parameterId: 'solder_joint_quality', name: 'Solder Joint Quality' },
      { parameterId: 'pcba_quantity_check', name: 'PCBA Quantity Check' },
    ],
    stage_04: [
      { parameterId: 'base_fitment', name: 'Base Fitment' },
      { parameterId: 'terminal_tightness', name: 'Terminal Tightness' },
      { parameterId: 'pcba_mounting', name: 'PCBA Mounting' },
      { parameterId: 'wiring_harness', name: 'Wiring Harness' },
    ],
    stage_05: [
      { parameterId: 'power_on_test', name: 'Power On Test' },
      { parameterId: 'display_check', name: 'Display Check' },
      { parameterId: 'communication_test', name: 'Communication Test' },
      { parameterId: 'accuracy_test', name: 'Accuracy Test' },
      { parameterId: 'lcd_display', name: 'LCD Display' },
    ],
    stage_06: [
      { parameterId: 'cover_fitment', name: 'Cover Fitment' },
      { parameterId: 'screw_tightness', name: 'Screw Tightness' },
      { parameterId: 'terminal_cover', name: 'Terminal Cover' },
      { parameterId: 'gasket_seal', name: 'Gasket Seal' },
    ],
    stage_07: [
      { parameterId: 'calibration_check', name: 'Calibration Check' },
      { parameterId: 'error_at_full_load', name: 'Error at Full Load' },
      { parameterId: 'error_at_half_load', name: 'Error at Half Load' },
      { parameterId: 'error_at_light_load', name: 'Error at Light Load' },
      { parameterId: 'ct_ratio_check', name: 'CT Ratio Check' },
    ],
    stage_08: [
      { parameterId: 'magnetic_tamper', name: 'Magnetic Tamper' },
      { parameterId: 'neutral_tamper', name: 'Neutral Tamper' },
      { parameterId: 'cover_open_tamper', name: 'Cover Open Tamper' },
      { parameterId: 'reverse_connection', name: 'Reverse Connection' },
      { parameterId: 'earth_tamper', name: 'Earth Tamper' },
    ],
    stage_09: [
      { parameterId: 'ac_high_voltage', name: 'AC High Voltage Test' },
      { parameterId: 'insulation_resistance', name: 'Insulation Resistance Test' },
      { parameterId: 'impulse_voltage', name: 'Impulse Voltage Test' },
    ],
    stage_10: [
      { parameterId: 'soaking_duration', name: 'Soaking Duration' },
      { parameterId: 'soaking_accuracy', name: 'Soaking Accuracy' },
      { parameterId: 'temperature_check', name: 'Temperature Check' },
    ],
    stage_11: [
      { parameterId: 'final_accuracy', name: 'Final Accuracy' },
      { parameterId: 'display_final', name: 'Display Final Check' },
      { parameterId: 'communication_final', name: 'Communication Final Check' },
      { parameterId: 'sealing_check', name: 'Sealing Check' },
      { parameterId: 'label_check', name: 'Label Check' },
    ],
    stage_12: [
      { parameterId: 'terminal_block_sealing', name: 'Terminal Block Sealing' },
      { parameterId: 'meter_cover_sealing', name: 'Meter Cover Sealing' },
      { parameterId: 'seal_wire_check', name: 'Seal Wire Check' },
    ],
    stage_13: [
      { parameterId: 'packing_material', name: 'Packing Material' },
      { parameterId: 'quantity_verification', name: 'Quantity Verification' },
      { parameterId: 'carton_labelling', name: 'Carton Labelling' },
      { parameterId: 'dispatch_document', name: 'Dispatch Document' },
    ],
  }

  const stageNames: Record<string, string> = {
    stage_01: 'Incoming Inspection / Stores',
    stage_02: 'SMD, Through Hole Soldering & Testing / EMS',
    stage_03: 'PCBA Incoming / Store',
    stage_04: 'Base Assembly',
    stage_05: 'Functional Testing',
    stage_06: 'Cover Assembly',
    stage_07: 'Error Compensation',
    stage_08: 'Tamper Test',
    stage_09: 'HV-IR Test',
    stage_10: 'Soaking Test',
    stage_11: 'Final Testing',
    stage_12: 'Sealing',
    stage_13: 'Packing',
  }

  type MeterDef = {
    id: string
    serialNumber: string
    meterType: string
    status: string
    currentStageId: string
    workOrderId: string
    reworkCount: number
    completedAt: FirebaseFirestore.Timestamp | null
    createdAt: FirebaseFirestore.Timestamp
    history: { stageId: string; operatorId: string; operatorName: string; submittedAt: FirebaseFirestore.Timestamp }[]
  }

  const meters: MeterDef[] = [
    // ── Stage 01 — just arrived, no history ──────────────────────────────────
    {
      id: 'meter-d-001', serialNumber: 'SN-D2026-001', meterType: 'Single Phase 5-30A',
      status: 'queued', currentStageId: 'stage_01', workOrderId: 'WO-2026-D001',
      reworkCount: 0, completedAt: null, createdAt: hoursAgo(3), history: [],
    },
    {
      id: 'meter-d-002', serialNumber: 'SN-D2026-002', meterType: 'Single Phase 5-30A',
      status: 'queued', currentStageId: 'stage_01', workOrderId: 'WO-2026-D001',
      reworkCount: 0, completedAt: null, createdAt: hoursAgo(2), history: [],
    },
    {
      id: 'meter-d-003', serialNumber: 'SN-D2026-003', meterType: 'Three Phase 10-60A',
      status: 'queued', currentStageId: 'stage_01', workOrderId: 'WO-2026-D001',
      reworkCount: 0, completedAt: null, createdAt: hoursAgo(1), history: [],
    },
    // ── Stage 04 — passed stages 1–3 ─────────────────────────────────────────
    {
      id: 'meter-d-004', serialNumber: 'SN-D2026-004', meterType: 'Single Phase 5-30A',
      status: 'queued', currentStageId: 'stage_04', workOrderId: 'WO-2026-D001',
      reworkCount: 0, completedAt: null, createdAt: daysAgo(2),
      history: [
        { stageId: 'stage_01', operatorId: priya, operatorName: 'Priya Patel', submittedAt: daysAgo(2) },
        { stageId: 'stage_02', operatorId: priya, operatorName: 'Priya Patel', submittedAt: daysAgo(1) },
        { stageId: 'stage_03', operatorId: priya, operatorName: 'Priya Patel', submittedAt: hoursAgo(6) },
      ],
    },
    {
      id: 'meter-d-005', serialNumber: 'SN-D2026-005', meterType: 'Three Phase 10-60A',
      status: 'queued', currentStageId: 'stage_04', workOrderId: 'WO-2026-D001',
      reworkCount: 0, completedAt: null, createdAt: daysAgo(2),
      history: [
        { stageId: 'stage_01', operatorId: priya, operatorName: 'Priya Patel', submittedAt: daysAgo(2) },
        { stageId: 'stage_02', operatorId: priya, operatorName: 'Priya Patel', submittedAt: daysAgo(1) },
        { stageId: 'stage_03', operatorId: priya, operatorName: 'Priya Patel', submittedAt: hoursAgo(8) },
      ],
    },
    // ── Stage 05 — queued (passed 1–4) ───────────────────────────────────────
    {
      id: 'meter-d-006', serialNumber: 'SN-D2026-006', meterType: 'Single Phase 5-30A',
      status: 'queued', currentStageId: 'stage_05', workOrderId: 'WO-2026-D002',
      reworkCount: 0, completedAt: null, createdAt: daysAgo(3),
      history: [
        { stageId: 'stage_03', operatorId: priya, operatorName: 'Priya Patel', submittedAt: daysAgo(2) },
        { stageId: 'stage_04', operatorId: priya, operatorName: 'Priya Patel', submittedAt: daysAgo(1) },
      ],
    },
    // ── Stage 05 — rework ────────────────────────────────────────────────────
    {
      id: 'meter-d-007', serialNumber: 'SN-D2026-007', meterType: 'Three Phase 10-60A',
      status: 'rework', currentStageId: 'stage_05', workOrderId: 'WO-2026-D002',
      reworkCount: 1, completedAt: null, createdAt: daysAgo(4),
      history: [
        { stageId: 'stage_04', operatorId: priya, operatorName: 'Priya Patel', submittedAt: daysAgo(2) },
      ],
    },
    // ── Stage 08 — passed 1–7 ────────────────────────────────────────────────
    {
      id: 'meter-d-008', serialNumber: 'SN-D2026-008', meterType: 'Single Phase 5-30A',
      status: 'queued', currentStageId: 'stage_08', workOrderId: 'WO-2026-D002',
      reworkCount: 0, completedAt: null, createdAt: daysAgo(5),
      history: [
        { stageId: 'stage_06', operatorId: amit, operatorName: 'Amit Kumar', submittedAt: daysAgo(3) },
        { stageId: 'stage_07', operatorId: amit, operatorName: 'Amit Kumar', submittedAt: daysAgo(2) },
      ],
    },
    {
      id: 'meter-d-009', serialNumber: 'SN-D2026-009', meterType: 'Three Phase 10-60A',
      status: 'queued', currentStageId: 'stage_08', workOrderId: 'WO-2026-D002',
      reworkCount: 0, completedAt: null, createdAt: daysAgo(5),
      history: [
        { stageId: 'stage_06', operatorId: amit, operatorName: 'Amit Kumar', submittedAt: daysAgo(3) },
        { stageId: 'stage_07', operatorId: amit, operatorName: 'Amit Kumar', submittedAt: daysAgo(2) },
      ],
    },
    // ── Stage 10 — passed 1–9 ────────────────────────────────────────────────
    {
      id: 'meter-d-010', serialNumber: 'SN-D2026-010', meterType: 'Single Phase 5-30A',
      status: 'queued', currentStageId: 'stage_10', workOrderId: 'WO-2026-D003',
      reworkCount: 0, completedAt: null, createdAt: daysAgo(7),
      history: [
        { stageId: 'stage_08', operatorId: amit, operatorName: 'Amit Kumar', submittedAt: daysAgo(4) },
        { stageId: 'stage_09', operatorId: amit, operatorName: 'Amit Kumar', submittedAt: daysAgo(3) },
      ],
    },
    {
      id: 'meter-d-011', serialNumber: 'SN-D2026-011', meterType: 'Three Phase 10-60A',
      status: 'queued', currentStageId: 'stage_10', workOrderId: 'WO-2026-D003',
      reworkCount: 0, completedAt: null, createdAt: daysAgo(7),
      history: [
        { stageId: 'stage_08', operatorId: amit, operatorName: 'Amit Kumar', submittedAt: daysAgo(4) },
        { stageId: 'stage_09', operatorId: amit, operatorName: 'Amit Kumar', submittedAt: daysAgo(3) },
      ],
    },
    // ── Stage 12 — passed 1–11 ───────────────────────────────────────────────
    {
      id: 'meter-d-012', serialNumber: 'SN-D2026-012', meterType: 'Single Phase 5-30A',
      status: 'queued', currentStageId: 'stage_12', workOrderId: 'WO-2026-D003',
      reworkCount: 0, completedAt: null, createdAt: daysAgo(10),
      history: [
        { stageId: 'stage_10', operatorId: amit, operatorName: 'Amit Kumar', submittedAt: daysAgo(5) },
        { stageId: 'stage_11', operatorId: amit, operatorName: 'Amit Kumar', submittedAt: daysAgo(3) },
      ],
    },
    {
      id: 'meter-d-013', serialNumber: 'SN-D2026-013', meterType: 'Three Phase 10-60A',
      status: 'queued', currentStageId: 'stage_12', workOrderId: 'WO-2026-D003',
      reworkCount: 0, completedAt: null, createdAt: daysAgo(10),
      history: [
        { stageId: 'stage_10', operatorId: amit, operatorName: 'Amit Kumar', submittedAt: daysAgo(5) },
        { stageId: 'stage_11', operatorId: amit, operatorName: 'Amit Kumar', submittedAt: daysAgo(3) },
      ],
    },
    // ── Stage 13 — queued (almost done) ─────────────────────────────────────
    {
      id: 'meter-d-014', serialNumber: 'SN-D2026-014', meterType: 'Single Phase 5-30A',
      status: 'queued', currentStageId: 'stage_13', workOrderId: 'WO-2026-D003',
      reworkCount: 0, completedAt: null, createdAt: daysAgo(12),
      history: [
        { stageId: 'stage_11', operatorId: amit, operatorName: 'Amit Kumar', submittedAt: daysAgo(4) },
        { stageId: 'stage_12', operatorId: amit, operatorName: 'Amit Kumar', submittedAt: daysAgo(2) },
      ],
    },
    // ── Done meter ───────────────────────────────────────────────────────────
    {
      id: 'meter-d-015', serialNumber: 'SN-D2026-015', meterType: 'Single Phase 5-30A',
      status: 'done', currentStageId: 'stage_13', workOrderId: 'WO-2026-D003',
      reworkCount: 0, completedAt: hoursAgo(4), createdAt: daysAgo(14),
      history: [
        { stageId: 'stage_11', operatorId: amit, operatorName: 'Amit Kumar', submittedAt: daysAgo(5) },
        { stageId: 'stage_12', operatorId: amit, operatorName: 'Amit Kumar', submittedAt: daysAgo(3) },
        { stageId: 'stage_13', operatorId: amit, operatorName: 'Amit Kumar', submittedAt: hoursAgo(4) },
      ],
    },
  ]

  for (const m of meters) {
    const meterRef = db.collection('meters').doc(m.id)
    await meterRef.set({
      serialNumber: m.serialNumber,
      meterType: m.meterType,
      status: m.status,
      currentStageId: m.currentStageId,
      workOrderId: m.workOrderId,
      assignedOperatorId: null,
      draftResults: null,
      reworkCount: m.reworkCount,
      taggedFromStageId: m.status === 'rework' ? m.currentStageId : null,
      completedAt: m.completedAt,
      createdAt: m.createdAt,
      isDemoData: true,
    })

    // Write stage history entries
    for (const h of m.history) {
      const params = stageParams[h.stageId] ?? []
      const stageName = stageNames[h.stageId] ?? h.stageId
      const entry = passEntry(h.stageId, stageName, params, h.operatorId, h.operatorName, h.submittedAt)
      await meterRef.collection('stageHistory').add(entry)
    }

    // Special case: rework meter gets a fail entry for its current stage
    if (m.status === 'rework') {
      const params = stageParams[m.currentStageId] ?? []
      const stageName = stageNames[m.currentStageId] ?? m.currentStageId
      await meterRef.collection('stageHistory').add({
        stageId: m.currentStageId,
        stageName,
        operatorId: priya,
        operatorName: 'Priya Patel',
        attemptNumber: 1,
        parameters: params.map((p, i) => ({
          ...p,
          numericValue: i % 2 === 0 ? '1' : '0',
          passed: i % 2 === 0,
        })),
        failedCount: Math.floor(params.length / 2),
        totalCount: params.length,
        overallResult: 'REWORK',
        reworkTargetStageId: m.currentStageId,
        comment: 'Failed checks — sent for rework',
        startedAt: hoursAgo(8),
        submittedAt: hoursAgo(6),
      })
    }
  }

  console.log(`✓ Seeded 15 demo meters across all stages  isDemoData=true`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function bootstrap() {
  console.log('\n🚀 PMtool Production Bootstrap')
  console.log('   Project: pmtool-3f8db')
  console.log(`   Admin:   ${adminEmail}\n`)

  await createAdminUser()
  await seedWorkstations()
  const uids = await seedDemoUsers()
  await seedDemoWorkOrders()
  await seedDemoMeters(uids)

  console.log(`
═══════════════════════════════════════════════════
  Bootstrap complete!
═══════════════════════════════════════════════════

  Login now:  https://pmtool-3f8db.web.app
  Email:      ${adminEmail}
  Password:   (what you set in ADMIN_PASSWORD)

  Demo accounts (password: Demo1234!)
    rajesh.sharma@pmtool.demo   — supervisor
    priya.patel@pmtool.demo     — operator
    amit.kumar@pmtool.demo      — operator
    sneha.reddy@pmtool.demo     — qa

  Next steps:
    1. Log in as admin → go to /team to create real users
    2. Go to /workstations to assign operators to stations
    3. When ready to go live: npm run wipe:demo
═══════════════════════════════════════════════════
`)
}

bootstrap().catch((err) => {
  console.error('\n❌ Bootstrap failed:', err.message ?? err)
  process.exit(1)
})
