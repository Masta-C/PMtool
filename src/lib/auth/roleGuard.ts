import type { Role } from '@/types/user'
const OPERATOR_PATHS = ['/dashboard', '/queue', '/workstations']
const QA_PATHS = ['/dashboard', '/queue', '/rework', '/workstations']
export function canAccess(role: Role, pathname: string): boolean {
  if (role === 'super_admin' || role === 'admin' || role === 'supervisor') return true
  const allowed = role === 'qa' ? QA_PATHS : OPERATOR_PATHS
  return allowed.some(p => pathname === p || pathname.startsWith(p + '/'))
}
