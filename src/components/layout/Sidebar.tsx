'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { signOut } from '@/lib/auth/signOut'
import type { Role } from '@/types/user'
const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', roles: ['super_admin','admin','supervisor','operator','qa'] as Role[] },
  { label: 'Queue', href: '/queue', roles: ['super_admin','admin','supervisor','operator','qa'] as Role[] },
  { label: 'Rework', href: '/rework', roles: ['super_admin','admin','supervisor','qa'] as Role[] },
  { label: 'Reports', href: '/reports', roles: ['super_admin','admin','supervisor'] as Role[] },
  { label: 'Users', href: '/users', roles: ['super_admin','admin','supervisor'] as Role[] },
  { label: 'Workstations', href: '/workstations', roles: ['super_admin','admin','supervisor'] as Role[] },
  { label: 'Products', href: '/products', roles: ['super_admin','admin','supervisor'] as Role[] },
  { label: 'Workforce', href: '/workforce', roles: ['super_admin','admin','supervisor'] as Role[] },
  { label: 'Audit Log', href: '/audit-log', roles: ['super_admin','admin','supervisor'] as Role[] },
  { label: 'Settings', href: '/settings', roles: ['super_admin','admin','supervisor'] as Role[] },
]
const ROLE_COLOURS: Record<Role, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  supervisor: 'bg-blue-100 text-blue-700',
  operator: 'bg-green-100 text-green-700',
  qa: 'bg-orange-100 text-orange-700',
}
export function Sidebar() {
  const { user, role } = useAuth()
  const pathname = usePathname()
  const visibleItems = NAV_ITEMS.filter(item => role && item.roles.includes(role))
  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <p className="text-lg font-bold">PMtool</p>
        <p className="text-xs text-gray-400 mt-1 truncate">{user?.displayName ?? user?.email}</p>
        {role && <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLOURS[role]}`}>{role.replace('_', ' ')}</span>}
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {visibleItems.map(item => (
          <Link key={item.href} href={item.href} className={`block px-3 py-2 rounded-lg text-sm transition-colors ${pathname.startsWith(item.href) ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-700">
        <button onClick={() => signOut()} className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">Sign out</button>
      </div>
    </aside>
  )
}
