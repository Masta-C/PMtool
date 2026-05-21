import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json()
    const decoded = await verifyFirebaseToken(idToken)
    const role = decoded.role ?? ''
    const res = NextResponse.json({ ok: true, role })
    res.cookies.set('pmtool-session', idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour — matches Firebase ID token expiry
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
