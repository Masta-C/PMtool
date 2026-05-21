import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json()
    const decoded = await verifyFirebaseToken(idToken)
    const role = decoded.role ?? ''

    // Store only the claims the middleware needs — not the raw JWT.
    // Storing the full JWT requires base64url decoding in the Edge Runtime
    // middleware which is fragile (atob padding issues). Simple JSON is reliable.
    const sessionPayload = JSON.stringify({
      uid: decoded.uid,
      role,
      exp: decoded.exp, // keep expiry so middleware can check it if needed
    })

    const res = NextResponse.json({ ok: true, role })
    res.cookies.set('pmtool-session', sessionPayload, {
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
