import type { Role } from '@/types/user'
const OPERATOR_PATHS = ['/dashboard']
const QA_PATHS = ['/dashboard']
export function canAccess(role: Role, pathname: string): boolean {
  if (role === 'admin' || role === 'supervisor') return true
  const allowed = role === 'qa' ? QA_PATHS : OPERATOR_PATHS
  return allowed.some(p => pathname === p || pathname.startsWith(p + '/'))
}
