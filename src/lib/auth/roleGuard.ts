import type { Role } from '@/types/user'
const OPERATOR_PATHS = ['/operator']
const QA_PATHS = ['/qa']
export function canAccess(role: Role, pathname: string): boolean {
  if (role === 'admin' || role === 'supervisor') return true
  const allowed = role === 'qa' ? QA_PATHS : OPERATOR_PATHS
  return allowed.some(p => pathname === p || pathname.startsWith(p + '/'))
}
