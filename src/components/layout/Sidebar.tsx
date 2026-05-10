'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { signOut } from '@/lib/auth/signOut'
import type { Role } from '@/types/user'

const NAV_ITEMS = [
  { label: 'Dashboard',   href: '/dashboard',   roles: ['super_admin','admin','supervisor','operator','qa'] as Role[] },
  { label: 'Queue',       href: '/queue',        roles: ['super_admin','admin','supervisor','operator','qa'] as Role[] },
  { label: 'Rework',      href: '/rework',       roles: ['super_admin','admin','supervisor','qa'] as Role[] },
  { label: 'Reports',     href: '/reports',      roles: ['super_admin','admin','supervisor'] as Role[] },
  { label: 'Users',       href: '/users',        roles: ['super_admin','admin','supervisor'] as Role[] },
  { label: 'Workstations',href: '/workstations', roles: ['super_admin','admin','supervisor'] as Role[] },
  { label: 'Products',    href: '/products',     roles: ['super_admin','admin','supervisor'] as Role[] },
  { label: 'Workforce',   href: '/workforce',    roles: ['super_admin','admin','supervisor'] as Role[] },
  { label: 'Audit Log',   href: '/audit-log',    roles: ['super_admin','admin','supervisor'] as Role[] },
  { label: 'Settings',    href: '/settings',     roles: ['super_admin','admin','supervisor'] as Role[] },
]

const ROLE_BADGE: Record<Role, string> = {
  super_admin: 'bg-purple-500/20 text-purple-300',
  admin:       'bg-blue-500/20 text-blue-300',
  supervisor:  'bg-blue-500/20 text-blue-300',
  operator:    'bg-green-500/20 text-green-300',
  qa:          'bg-orange-500/20 text-orange-300',
}

export function Sidebar() {
  const { user, role } = useAuth()
  const pathname = usePathname()
  const visibleItems = NAV_ITEMS.filter(item => role && item.roles.includes(role))

  return (
    <aside className="w-56 min-h-screen flex flex-col" style={{ background: 'var(--color-sidebar-bg)' }}>
      {/* Brand */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--color-sidebar-border)' }}>
        <p className="text-white text-base font-bold tracking-wide">PMtool</p>
        <p className="text-xs mt-1 truncate" style={{ color: 'var(--color-sidebar-text)' }}>
          {user?.displayName ?? user?.email}
        </p>
        {role && (
          <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[role]}`}>
            {role.replace('_', ' ')}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visibleItems.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
              style={
                isActive
                  ? {
                      background: 'var(--color-primary)',
                      color: '#ffffff',
                    }
                  : {
                      color: 'var(--color-sidebar-text)',
                    }
              }
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--color-sidebar-hover)'
              }}
              onMouseLeave={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--color-sidebar-border)' }}>
        <button
          onClick={() => signOut()}
          className="w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-150"
          style={{ color: 'var(--color-sidebar-text)' }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.background = 'var(--color-sidebar-hover)'
            ;(e.currentTarget as HTMLElement).style.color = '#ffffff'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--color-sidebar-text)'
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
