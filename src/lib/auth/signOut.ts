import { signOut as firebaseSignOut } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
export async function signOut() {
  await fetch('/api/auth/session', { method: 'DELETE' })
  await firebaseSignOut(auth)
  window.location.href = '/login'
}
