'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Sidebar } from '@/components/layout/Sidebar'
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])
  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-content-bg)' }}><div className="text-gray-400 text-sm">Loading...</div></div>
  if (!user) return null
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-content-bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
