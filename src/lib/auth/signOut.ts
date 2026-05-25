import { signOut as firebaseSignOut } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import type { Role } from '@/types/user'

const ADMIN_ROLES: Role[] = ['admin', 'supervisor']

export async function signOut(role?: Role | null) {
  await fetch('/api/auth/session', { method: 'DELETE' })
  await firebaseSignOut(auth)
  window.location.href = role && ADMIN_ROLES.includes(role) ? '/admin/login' : '/login'
}
