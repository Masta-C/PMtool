'use client'
import { useState } from 'react'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import type { Role } from '@/types/user'

const ROLE_REDIRECT: Record<Role, string> = {
  admin: '/dashboard', supervisor: '/dashboard',
  operator: '/operator', qa: '/qa',
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const token = await cred.user.getIdTokenResult(true)
      const role = token.claims.role as Role
      const idToken = await cred.user.getIdToken()
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })
      window.location.replace(ROLE_REDIRECT[role] ?? '/dashboard')
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') setError('Incorrect email or password.')
      else if (code === 'auth/user-not-found') setError('No account found with this email.')
      else if (code === 'auth/too-many-requests') setError('Too many failed attempts. Try again later.')
      else setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email address first, then click Forgot password.')
      return
    }
    setResetLoading(true)
    setError(null)
    try {
      await sendPasswordResetEmail(auth, email)
      setResetSent(true)
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'auth/user-not-found') setError('No account found with this email.')
      else setError('Could not send reset email. Please try again.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at 15% 40%, rgba(67,97,238,0.13) 0%, transparent 55%), radial-gradient(ellipse at 85% 15%, rgba(139,92,246,0.10) 0%, transparent 55%), radial-gradient(ellipse at 50% 95%, rgba(34,197,94,0.08) 0%, transparent 55%), #eef0f7' }}>
      <div className="w-full max-w-sm rounded-xl p-8" style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.85)', boxShadow: '0 4px 24px rgba(67,97,238,0.08), 0 1px 3px rgba(0,0,0,0.05)' }}>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">PMtool</h1>
        <p className="text-sm text-gray-500 mb-6">Admin / Supervisor sign in</p>

        {resetSent ? (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            Password reset email sent to <span className="font-semibold">{email}</span>. Check your inbox.
          </div>
        ) : (
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
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
              >
                {resetLoading ? 'Sending…' : 'Forgot password?'}
              </button>
            </div>
          </form>
        )}

        <p className="text-xs text-gray-400 mt-4 text-center">
          Operator? Use the standard login page.
        </p>
      </div>
    </div>
  )
}
