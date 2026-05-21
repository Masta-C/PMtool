export {}
/**
 * Wipe Demo Data Script
 * Run before go-live to remove all isDemoData: true documents and Auth users.
 * Workstations are preserved (isDemoData: false).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json npm run wipe:demo
 *
 * What gets deleted:
 *   - Firestore: users, meters (+ stageHistory subcollections), workOrders where isDemoData=true
 *   - Firebase Auth: users with @pmtool.demo emails
 *
 * What is KEPT:
 *   - Your admin account
 *   - All 13 workstations (isDemoData: false)
 *   - Any real data you've created since bootstrap
 */

// ─── Preflight ────────────────────────────────────────────────────────────────
const saKeyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!saKeyPath) {
  console.error('❌  Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json')
  process.exit(1)
}

// ─── Firebase init ────────────────────────────────────────────────────────────
const { readFileSync } = await import('fs')
const { initializeApp, cert } = await import('firebase-admin/app')
const { getAuth } = await import('firebase-admin/auth')
const { getFirestore } = await import('firebase-admin/firestore')

const serviceAccount = JSON.parse(readFileSync(saKeyPath, 'utf8'))
initializeApp({ credential: cert(serviceAccount) })

const auth = getAuth()
const db = getFirestore()

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function deleteDemoCollection(collectionName: string) {
  const snap = await db.collection(collectionName).where('isDemoData', '==', true).get()
  if (snap.empty) {
    console.log(`  ℹ️  ${collectionName}: nothing to delete`)
    return 0
  }

  // For meters, delete stageHistory subcollections first
  if (collectionName === 'meters') {
    for (const doc of snap.docs) {
      const historySnap = await doc.ref.collection('stageHistory').get()
      if (!historySnap.empty) {
        const batch = db.batch()
        historySnap.docs.forEach((h) => batch.delete(h.ref))
        await batch.commit()
      }
    }
  }

  // Delete the top-level docs in batches of 400
  const chunks = []
  for (let i = 0; i < snap.docs.length; i += 400) {
    chunks.push(snap.docs.slice(i, i + 400))
  }
  for (const chunk of chunks) {
    const batch = db.batch()
    chunk.forEach((doc) => batch.delete(doc.ref))
    await batch.commit()
  }

  console.log(`  ✓ ${collectionName}: deleted ${snap.docs.length} doc(s)`)
  return snap.docs.length
}

async function deleteDemoAuthUsers() {
  // Demo users all have @pmtool.demo emails
  const result = await auth.listUsers()
  const demoUsers = result.users.filter((u) => u.email?.endsWith('@pmtool.demo'))
  if (demoUsers.length === 0) {
    console.log('  ℹ️  Auth: no @pmtool.demo users found')
    return
  }
  await auth.deleteUsers(demoUsers.map((u) => u.uid))
  console.log(`  ✓ Auth: deleted ${demoUsers.length} demo user(s)`)
  demoUsers.forEach((u) => console.log(`       – ${u.email}`))
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function wipe() {
  console.log('\n🧹 PMtool — Wipe Demo Data')
  console.log('   Project: pmtool-3f8db\n')
  console.log('Firestore:')
  await deleteDemoCollection('users')
  await deleteDemoCollection('meters')
  await deleteDemoCollection('workOrders')

  console.log('\nFirebase Auth:')
  await deleteDemoAuthUsers()

  console.log(`
═══════════════════════════════════════════════════
  Demo data wiped.
═══════════════════════════════════════════════════

  Preserved:
    ✓ Your admin account
    ✓ All 13 workstations (real config)
    ✓ Any real users/meters created since bootstrap

  The app is now clean for real operators.
═══════════════════════════════════════════════════
`)
}

wipe().catch((err) => {
  console.error('\n❌ Wipe failed:', err.message ?? err)
  process.exit(1)
})
