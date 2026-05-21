import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json()
    const decoded = await verifyFirebaseToken(idToken)
    const role = decoded.role ?? ''

    // Store only the role string — no JSON, no encoding issues.
    // Next.js cookies.set() percent-encodes values; JSON strings become
    // %7B%22uid%22... which JSON.parse() cannot read in the middleware.
    // A plain role string ("admin", "operator", etc.) contains only ASCII
    // letters and is never encoded, so request.cookies.get().value is always
    // the exact string the middleware needs.
    const res = NextResponse.json({ ok: true, role })
    res.cookies.set('pmtool-session', role, {
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
