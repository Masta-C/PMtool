'use client'
import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import { useAuthStore } from '@/store/authStore'
import type { Role } from '@/types/user'
export function useAuth() {
  const { user, role, loading, setUser, clear } = useAuthStore()
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdTokenResult(true)
          const userRole = (token.claims.role as Role) ?? null
          setUser(firebaseUser, userRole)
        } catch {
          // Token invalid (e.g. emulator restarted) — sign out cleanly
          await import('firebase/auth').then(({ signOut }) => signOut(auth))
          clear()
        }
      } else {
        clear()
      }
    })
    return unsubscribe
  }, [setUser, clear])
  return { user, role, loading }
}
