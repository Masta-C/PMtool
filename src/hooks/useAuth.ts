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
          // No force-refresh — login already forced a fresh token with role claims.
          // Force-refreshing here makes every page load hit the emulator and can
          // intermittently fail, which incorrectly signs the user out.
          const token = await firebaseUser.getIdTokenResult()
          const userRole = (token.claims.role as Role) ?? null
          setUser(firebaseUser, userRole)
        } catch {
          // Couldn't read claims — clear local state but don't call signOut,
          // which would also wipe the server session cookie unexpectedly.
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
