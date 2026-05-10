import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { canAccess } from '@/lib/auth/roleGuard'
import type { Role } from '@/types/user'
const PUBLIC_PATHS = ['/login', '/_next', '/favicon.ico', '/api/health', '/api/auth']
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()
  const session = request.cookies.get('pmtool-session')
  if (!session?.value) return NextResponse.redirect(new URL('/login', request.url))
  try {
    const parts = session.value.split('.')
    if (parts.length < 2) throw new Error('invalid')
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    const role = payload.role as Role
    if (!role || !canAccess(role, pathname)) return NextResponse.redirect(new URL('/dashboard', request.url))
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
