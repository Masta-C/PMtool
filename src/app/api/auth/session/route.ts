import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import { initAdminApp } from '@/lib/firebase/admin'
initAdminApp()
export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json()
    // verifyIdToken works with both emulator and production
    const decoded = await getAuth().verifyIdToken(idToken)
    const role = (decoded.role as string) ?? ''
    const res = NextResponse.json({ ok: true, role })
    // Store the ID token as the session cookie — works in both emulator and prod
    // In production this refreshes on each login (ID token is valid for 1h, re-login refreshes it)
    res.cookies.set('pmtool-session', idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour, matches Firebase ID token expiry
      path: '/',
    })
    return res
  } catch (err) {
    console.error('[session] token verification failed:', err)
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('pmtool-session')
  return res
}
