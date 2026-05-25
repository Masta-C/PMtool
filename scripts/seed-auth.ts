// Seeds Auth emulator with users matching the Firestore seed UIDs
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'

const { initializeApp, getApps } = await import('firebase-admin/app')
const { getAuth } = await import('firebase-admin/auth')

if (!getApps().length) initializeApp({ projectId: 'pmtool-3f8db' })

const auth = getAuth()

const users = [
  { uid: 'test-admin-2',     email: 'admin2@pmtool.dev',      password: 'Test1234!', displayName: 'Admin Test 2',      role: 'admin' },
  { uid: 'test-admin',       email: 'admin@pmtool.dev',      password: 'Test1234!', displayName: 'Admin Test',       role: 'admin' },
  { uid: 'test-supervisor',  email: 'supervisor@pmtool.dev', password: 'Test1234!', displayName: 'Supervisor Test',  role: 'supervisor' },
  { uid: 'test-operator',    email: 'operator@pmtool.dev',   password: 'Test1234!', displayName: 'Operator Test',    role: 'operator' },
  { uid: 'test-qa',          email: 'qa@pmtool.dev',         password: 'Test1234!', displayName: 'QA Test',          role: 'qa' },
]

for (const user of users) {
  try {
    // Delete if already exists (wrong UID from earlier)
    try {
      const existing = await auth.getUserByEmail(user.email)
      await auth.deleteUser(existing.uid)
      console.log(`  Deleted old user: ${user.email} (uid: ${existing.uid})`)
    } catch {
      // User didn't exist, that's fine
    }

    // Create with correct UID
    await auth.createUser({
      uid: user.uid,
      email: user.email,
      password: user.password,
      displayName: user.displayName,
      emailVerified: true,
    })

    // Set custom claim (role)
    await auth.setCustomUserClaims(user.uid, { role: user.role })

    console.log(`✓ Created ${user.role}: ${user.email} (uid: ${user.uid})`)
  } catch (err: unknown) {
    console.error(`✗ Failed ${user.email}:`, (err as Error).message)
  }
}

console.log('\nAuth seed complete. You can now log in at localhost:3000')
