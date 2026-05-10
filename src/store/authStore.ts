import { create } from 'zustand'
import type { User } from 'firebase/auth'
import type { Role } from '@/types/user'
interface AuthState {
  user: User | null
  role: Role | null
  loading: boolean
  setUser: (user: User | null, role: Role | null) => void
  setLoading: (loading: boolean) => void
  clear: () => void
}
export const useAuthStore = create<AuthState>((set) => ({
  user: null, role: null, loading: true,
  setUser: (user, role) => set({ user, role, loading: false }),
  setLoading: (loading) => set({ loading }),
  clear: () => set({ user: null, role: null, loading: false }),
}))
