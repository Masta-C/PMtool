'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { signOut } from '@/lib/auth/signOut'
import type { Role } from '@/types/user'

const NAV_ITEMS = [
  {
    label: 'Dashboard', href: '/dashboard', roles: ['admin','supervisor'] as Role[],
    icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  },
  {
    label: 'QA Dashboard', href: '/qa', roles: ['qa'] as Role[],
    icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  },
  {
    label: 'Home', href: '/operator', roles: ['operator'] as Role[],
    icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
  },
  {
    label: 'Workstations', href: '/workstations', roles: ['admin','supervisor'] as Role[],
    icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>,
  },
  {
    label: 'Team', href: '/team', roles: ['admin','supervisor'] as Role[],
    icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  },
  {
    label: 'Reports', href: '/reports', roles: ['admin','supervisor'] as Role[],
    icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
  },
  {
    label: 'Audit Log', href: '/audit-log', roles: ['admin','supervisor'] as Role[],
    icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
  },
]

const ROLE_BADGE: Record<Role, string> = {
  admin:      'bg-blue-500/20 text-blue-300',
  supervisor: 'bg-blue-500/20 text-blue-300',
  operator:   'bg-green-500/20 text-green-300',
  qa:         'bg-orange-500/20 text-orange-300',
}

export function Sidebar() {
  const { user, role } = useAuth()
  const pathname = usePathname()
  const visibleItems = NAV_ITEMS.filter(item => role && item.roles.includes(role))

  return (
    <aside className="w-56 h-screen flex flex-col flex-shrink-0" style={{ background: 'var(--color-sidebar-bg)' }}>
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
        {visibleItems.map((item, idx) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const prevItem = visibleItems[idx - 1]
          const showDivider =
            (role === 'admin' || role === 'supervisor') &&
            item.href === '/team' &&
            prevItem?.href === '/workstations'
          return (
            <div key={item.href}>
              {showDivider && (
                <div className="my-2 border-t opacity-20" style={{ borderColor: 'var(--color-sidebar-border)' }} />
              )}
              <Link
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
                {item.icon}
                <span>{item.label}</span>
              </Link>
            </div>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--color-sidebar-border)' }}>
        <button
          onClick={() => signOut(role)}
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
