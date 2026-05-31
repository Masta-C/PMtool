import { signOut as firebaseSignOut } from 'firebase/auth'
import { getDoc, doc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { setMachineStatus } from '@/lib/firebase/firestore'
import type { Role } from '@/types/user'

const ADMIN_ROLES: Role[] = ['admin', 'supervisor']

export async function signOut(role?: Role | null) {
  // If operator, clear their station's machine status before signing out
  // so the next operator (or the same one tomorrow) starts with a clean slate
  if (role === 'operator') {
    try {
      const uid = auth.currentUser?.uid
      if (uid) {
        const userSnap = await getDoc(doc(db, 'users', uid))
        const stationId: string | undefined = userSnap.data()?.workstationIds?.[0]
        if (stationId) {
          await setMachineStatus(stationId, null)
        }
      }
    } catch {
      // Best-effort — never block sign out due to a status clear failure
    }
  }

  await fetch('/api/auth/session', { method: 'DELETE' })
  await firebaseSignOut(auth)
  window.location.href = role && ADMIN_ROLES.includes(role) ? '/admin/login' : '/login'
}
