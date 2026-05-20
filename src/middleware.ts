import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { canAccess } from '@/lib/auth/roleGuard'
import type { Role } from '@/types/user'
const PUBLIC_PATHS = ['/_next', '/favicon.ico', '/api/health', '/api/auth']
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()

  // If already authenticated, redirect away from login to dashboard
  if (pathname === '/login') {
    const session = request.cookies.get('pmtool-session')
    if (session?.value) {
      try {
        const parts = session.value.split('.')
        if (parts.length >= 2) {
          const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
          const payload = JSON.parse(atob(b64))
          if (payload.role === 'operator') return NextResponse.redirect(new URL('/operator', request.url))
          if (payload.role === 'qa') return NextResponse.redirect(new URL('/qa', request.url))
          if (payload.role) return NextResponse.redirect(new URL('/dashboard', request.url))
        }
      } catch { /* invalid token, let them see login */ }
    }
    return NextResponse.next()
  }
  const session = request.cookies.get('pmtool-session')
  if (!session?.value) return NextResponse.redirect(new URL('/login', request.url))
  try {
    const parts = session.value.split('.')
    if (parts.length < 2) throw new Error('invalid')
    // atob is the correct Web API for Edge Runtime; JWT uses base64url so convert first
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(b64))
    const role = payload.role as Role
    if (!role || !canAccess(role, pathname)) {
      const home = role === 'operator' ? '/operator' : role === 'qa' ? '/qa' : '/dashboard'
      return NextResponse.redirect(new URL(home, request.url))
    }
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
