/**
 * One-time data cleanup: enforce 1-operator-per-station invariant
 *
 * Bug: handleSaveOperator used arrayUnion which accumulated multiple workstationIds
 * per user instead of replacing. This script finds any operator with >1 station and
 * trims them to zero (unassigned), so the admin can reassign cleanly.
 *
 * Run against emulator:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 npx ts-node --esm scripts/fix-operator-assignments.ts
 *
 * Run against production (requires service account):
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/sa.json npx ts-node --esm scripts/fix-operator-assignments.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST

if (!getApps().length) {
  if (isEmulator) {
    initializeApp({ projectId: 'pmtool-3f8db' })
  } else {
    initializeApp() // uses GOOGLE_APPLICATION_CREDENTIALS
  }
}

const db = getFirestore()

async function main() {
  console.log(`\n🔍 Scanning users for multi-station assignments...`)
  console.log(`   Mode: ${isEmulator ? 'EMULATOR' : 'PRODUCTION'}\n`)

  const snapshot = await db.collection('users').get()
  const violations: { uid: string; displayName: string; workstationIds: string[] }[] = []

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data()
    const workstationIds: string[] = data.workstationIds ?? []
    if (workstationIds.length > 1) {
      violations.push({ uid: docSnap.id, displayName: data.displayName, workstationIds })
    }
  }

  if (violations.length === 0) {
    console.log('✓ No violations found — all operators have ≤1 station. Nothing to fix.\n')
    return
  }

  console.log(`⚠️  Found ${violations.length} operator(s) with multiple station assignments:\n`)
  for (const v of violations) {
    console.log(`   ${v.displayName} (${v.uid})`)
    console.log(`     workstationIds: ${JSON.stringify(v.workstationIds)}`)
    console.log(`     → will be reset to [] (unassigned)\n`)
  }

  console.log('Applying fix...')
  const batch = db.batch()
  for (const v of violations) {
    batch.update(db.collection('users').doc(v.uid), { workstationIds: [] })
  }
  await batch.commit()

  console.log(`✓ Fixed ${violations.length} user(s). Reassign them from the Workstations page.\n`)
}

main().catch(err => {
  console.error('Script failed:', err)
  process.exit(1)
})
