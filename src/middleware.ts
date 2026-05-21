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

// Prevent Firebase Hosting CDN from ever caching auth redirect responses.
// Without this, an early unauthenticated 307 for /dashboard can be cached
// and served to all subsequent requests, bypassing Cloud Run entirely.
function noCache(res: NextResponse): NextResponse {
  res.headers.set('Cache-Control', 'no-store, private')
  return res
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()

  const session = request.cookies.get('pmtool-session')

  // If already authenticated, redirect away from login to the right home screen
  if (pathname === '/login') {
    if (session?.value) {
      const role = getSessionRole(session.value)
      if (role === 'operator') return noCache(NextResponse.redirect(new URL('/operator', request.url)))
      if (role === 'qa') return noCache(NextResponse.redirect(new URL('/qa', request.url)))
      if (role) return noCache(NextResponse.redirect(new URL('/dashboard', request.url)))
    }
    return NextResponse.next()
  }

  // Protected route — require a valid session cookie
  if (!session?.value) return noCache(NextResponse.redirect(new URL('/login', request.url)))

  const role = getSessionRole(session.value)
  if (!role || !canAccess(role, pathname)) {
    const home = role === 'operator' ? '/operator' : role === 'qa' ? '/qa' : '/dashboard'
    return noCache(NextResponse.redirect(new URL(home, request.url)))
  }

  return noCache(NextResponse.next())
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
