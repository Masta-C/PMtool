// TEMPORARY DIAGNOSTIC ENDPOINT — DELETE AFTER LOGIN IS CONFIRMED WORKING
// Shows what the server actually reads from the __session cookie.
// Usage: after logging in, open a new tab and visit /api/debug/cookie
import { NextRequest, NextResponse } from 'next/server'

const VALID_ROLES = ['admin', 'supervisor', 'operator', 'qa']

export async function GET(req: NextRequest) {
  const session = req.cookies.get('__session')
  const allCookies = Object.fromEntries(
    req.cookies.getAll().map(c => [c.name, c.value.substring(0, 80)])
  )
  return NextResponse.json({
    present: !!session,
    value: session?.value ?? null,
    isValidRole: VALID_ROLES.includes(session?.value ?? ''),
    valueLength: session?.value?.length ?? 0,
    allCookieNames: Object.keys(allCookies),
    // Show first 80 chars of each cookie (safe for httpOnly — server-side only)
    allCookies,
  })
}
