import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import { initAdminApp } from '@/lib/firebase/admin'
initAdminApp()
export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json()
    const decoded = await getAuth().verifyIdToken(idToken)
    const role = (decoded.role as string) ?? ''
    const expiresIn = 7 * 24 * 60 * 60 * 1000
    const sessionCookie = await getAuth().createSessionCookie(idToken, { expiresIn })
    const res = NextResponse.json({ ok: true, role })
    res.cookies.set('pmtool-session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('pmtool-session')
  return res
}
