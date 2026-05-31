'use client'
import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase/client'
import type { Role } from '@/types/user'
const ROLE_REDIRECT: Record<Role, string> = {
  admin: '/dashboard', supervisor: '/dashboard',
  operator: '/operator', qa: '/qa',
}
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    console.log('[login] submitting with email:', email)
    setError(null)
    setLoading(true)
    try {
      console.log('[login] calling signInWithEmailAndPassword...')
      const cred = await signInWithEmailAndPassword(auth, email, password)
      console.log('[login] signed in, uid:', cred.user.uid)
      const token = await cred.user.getIdTokenResult(true)
      const role = token.claims.role as Role
      console.log('[login] role from token:', role)
      const idToken = await cred.user.getIdToken()
      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })
      console.log('[login] session API status:', sessionRes.status)
      // Use full browser navigation (not Next.js RSC fetch) so the
      // __session cookie set by the session API is guaranteed to
      // be included in the request the middleware sees.
      window.location.replace(ROLE_REDIRECT[role] ?? '/dashboard')
    } catch (err: unknown) {
      console.error('[login] error:', err)
      const code = (err as { code?: string }).code
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') setError('Incorrect email or password.')
      else if (code === 'auth/user-not-found') setError('No account found with this email.')
      else if (code === 'auth/too-many-requests') setError('Too many failed attempts. Try again later.')
      else setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at 15% 40%, rgba(67,97,238,0.13) 0%, transparent 55%), radial-gradient(ellipse at 85% 15%, rgba(139,92,246,0.10) 0%, transparent 55%), radial-gradient(ellipse at 50% 95%, rgba(34,197,94,0.08) 0%, transparent 55%), #eef0f7' }}>
      <div className="w-full max-w-sm rounded-xl p-8" style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.85)', boxShadow: '0 4px 24px rgba(67,97,238,0.08), 0 1px 3px rgba(0,0,0,0.05)' }}>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">PMtool</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in to your account</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
            <p className="text-center text-xs text-gray-400">
              Forgot your password? Contact your administrator to reset it.
            </p>
          </form>
        <p className="text-xs text-gray-400 mt-4 text-center">Contact your administrator if you need access.</p>
      </div>
    </div>
  )
}
