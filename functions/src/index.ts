import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

if (!getApps().length) initializeApp()

const ADMIN_ROLES = ['admin', 'supervisor']
const VALID_ROLES = ['admin', 'supervisor', 'operator', 'qa']

export const setUserRole = onCall({ region: 'asia-south1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in')
  const callerRole = request.auth.token.role as string
  const { targetUid, role } = request.data
  if (!ADMIN_ROLES.includes(callerRole)) throw new HttpsError('permission-denied', 'Insufficient role')
  if (!VALID_ROLES.includes(role)) throw new HttpsError('invalid-argument', 'Invalid role')
  await getAuth().setCustomUserClaims(targetUid, { role })
  await getFirestore().collection('users').doc(targetUid).update({ role })
  return { success: true }
})

export const createUser = onCall({ region: 'asia-south1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in')
  const callerRole = request.auth.token.role as string
  if (!ADMIN_ROLES.includes(callerRole)) throw new HttpsError('permission-denied', 'Insufficient role')
  const { email, password, displayName, role, workstationIds = [] } = request.data
  if (!VALID_ROLES.includes(role)) throw new HttpsError('invalid-argument', 'Invalid role')
  const userRecord = await getAuth().createUser({ email, password, displayName })
  await getAuth().setCustomUserClaims(userRecord.uid, { role })
  await getFirestore().collection('users').doc(userRecord.uid).set({
    uid: userRecord.uid, email, displayName, role, workstationIds,
    shiftId: null, isActive: true,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: request.auth.uid,
  })
  return { uid: userRecord.uid }
})

export const deleteUser = onCall({ region: 'asia-south1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in')
  const callerRole = request.auth.token.role as string
  if (!ADMIN_ROLES.includes(callerRole)) throw new HttpsError('permission-denied', 'Insufficient role')
  const { targetUid } = request.data
  if (targetUid === request.auth.uid) throw new HttpsError('invalid-argument', 'Cannot delete your own account')
  await getAuth().deleteUser(targetUid)
  await getFirestore().collection('users').doc(targetUid).delete()
  return { success: true }
})

export const deleteWorkstation = onCall({ region: 'asia-south1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in')
  const callerRole = request.auth.token.role as string
  if (!ADMIN_ROLES.includes(callerRole)) throw new HttpsError('permission-denied', 'Insufficient role')
  const { wsId } = request.data
  const snap = await getFirestore().collection('workstations').count().get()
  if (snap.data().count <= 1) throw new HttpsError('failed-precondition', 'Cannot delete the last workstation')
  await getFirestore().collection('workstations').doc(wsId).delete()
  return { success: true }
})

export const resetUserPassword = onCall({ region: 'asia-south1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in')
  const callerRole = request.auth.token.role as string
  if (!ADMIN_ROLES.includes(callerRole)) throw new HttpsError('permission-denied', 'Insufficient role')
  const { targetUid, newPassword } = request.data
  if (!targetUid || typeof targetUid !== 'string') throw new HttpsError('invalid-argument', 'targetUid required')
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) throw new HttpsError('invalid-argument', 'newPassword must be at least 6 characters')
  if (targetUid === request.auth.uid) throw new HttpsError('invalid-argument', 'Cannot reset your own password this way — use Firebase Auth directly')
  await getAuth().updateUser(targetUid, { password: newPassword })
  return { success: true }
})

export const healthCheck = onCall({ region: 'asia-south1' }, async () => {
  return { status: 'ok', project: 'pmtool-3f8db', phase: 1 }
})
