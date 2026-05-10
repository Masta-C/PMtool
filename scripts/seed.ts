import * as admin from 'firebase-admin'

if (process.env.NEXT_PUBLIC_USE_EMULATOR !== 'true') {
  console.error('SEED ABORTED: Not running against emulator. Set NEXT_PUBLIC_USE_EMULATOR=true')
  process.exit(1)
}

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'

admin.initializeApp({ projectId: 'pmtool-3f8db' })
const db = admin.firestore()

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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  }
  await userBatch.commit()
  console.log('✓ Seeded 5 test users')

  // Seed 3 sample work orders
  const orders = [
    {
      id: 'WO-2026-00001',
      status: 'pending',
      productId: 'prod_placeholder',
      currentWsId: 'ws_01',
      assignedOperatorId: null,
      reworkCount: 0,
      priority: 'normal',
    },
    {
      id: 'WO-2026-00002',
      status: 'in_progress',
      productId: 'prod_placeholder',
      currentWsId: 'ws_01',
      assignedOperatorId: 'test-operator',
      reworkCount: 0,
      priority: 'normal',
    },
    {
      id: 'WO-2026-00003',
      status: 'rework',
      productId: 'prod_placeholder',
      currentWsId: 'ws_02',
      assignedOperatorId: null,
      reworkCount: 1,
      priority: 'normal',
    },
  ]
  const orderBatch = db.batch()
  for (const order of orders) {
    const { id, ...data } = order
    orderBatch.set(db.collection('workOrders').doc(id), {
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  }
  await orderBatch.commit()
  console.log('✓ Seeded 3 sample work orders')

  console.log('Seed complete. Open localhost:4000 to verify in Emulator UI')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
