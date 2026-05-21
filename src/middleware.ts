import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { canAccess } from '@/lib/auth/roleGuard'
import type { Role } from '@/types/user'

const PUBLIC_PATHS = ['/_next', '/favicon.ico', '/api/health', '/api/auth']

function getSessionRole(cookieValue: string): Role | null {
  // Cookie stores the role string directly ("admin", "supervisor", etc).
  // Plain ASCII — never percent-encoded by Next.js cookies.set().
  const role = cookieValue as Role
  return role || null
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()

  const session = request.cookies.get('pmtool-session')

  // If already authenticated, redirect away from login to the right home screen
  if (pathname === '/login') {
    if (session?.value) {
      const role = getSessionRole(session.value)
      if (role === 'operator') return NextResponse.redirect(new URL('/operator', request.url))
      if (role === 'qa') return NextResponse.redirect(new URL('/qa', request.url))
      if (role) return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // Protected route — require a valid session cookie
  if (!session?.value) return NextResponse.redirect(new URL('/login', request.url))

  const role = getSessionRole(session.value)
  if (!role || !canAccess(role, pathname)) {
    const home = role === 'operator' ? '/operator' : role === 'qa' ? '/qa' : '/dashboard'
    return NextResponse.redirect(new URL(home, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
