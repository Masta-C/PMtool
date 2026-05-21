import { createRemoteJWKSet, jwtVerify } from 'jose'

const PROJECT_ID = 'pmtool-3f8db'
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`
const JWKS_URI = new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
)

// Singleton — created once per process, caches keys and respects
// Cache-Control from Google (typically max-age=21600, i.e. 6 hours).
// When a token arrives with an unknown kid, jose auto-refetches.
// timeoutDuration: fail fast on cold-start JWKS fetch instead of hanging forever.
const FIREBASE_JWKS = createRemoteJWKSet(JWKS_URI, { timeoutDuration: 10_000 })

export interface FirebaseTokenPayload {
  uid: string
  email?: string
  role?: string
  [key: string]: unknown
}

/**
 * Returns true when running against the local Firebase emulator.
 * Emulator-issued tokens are not signed with real Google keys, so we
 * skip cryptographic verification and just decode the payload.
 *
 * NEVER set these env vars to true/non-empty in production.
 */
function isEmulatorMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_USE_EMULATOR === 'true' ||
    !!process.env.FIREBASE_AUTH_EMULATOR_HOST
  )
}

/**
 * Verifies a Firebase ID token.
 *
 * In production: fetches Google's public JWKS and verifies the RS256
 * signature, expiry, issuer, and audience — no Admin SDK or service
 * account credentials required.
 *
 * In emulator mode: decodes the JWT payload without signature verification
 * (emulator tokens use a local key, not Google's real keys).
 *
 * Throws on any verification failure.
 */
export async function verifyFirebaseToken(idToken: string): Promise<FirebaseTokenPayload> {
  if (isEmulatorMode()) {
    const parts = idToken.split('.')
    if (parts.length < 2) throw new Error('Malformed JWT')
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
    const uid = (payload.sub ?? payload.user_id) as string
    if (!uid) throw new Error('Emulator token missing sub/user_id')
    return { ...payload, uid, role: payload.role as string | undefined }
  }

  const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
    issuer: ISSUER,
    audience: PROJECT_ID,
    algorithms: ['RS256'],
  })

  const uid = (payload.sub ?? payload['user_id']) as string
  if (!uid) throw new Error('Token missing sub/user_id')

  return {
    ...payload,
    uid,
    role: payload['role'] as string | undefined,
  }
}
