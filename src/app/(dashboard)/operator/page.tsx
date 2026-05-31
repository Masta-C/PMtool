'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { doc, getDoc, collectionGroup, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/hooks/useAuth'
import { subscribeMachineStatuses, setMachineStatus, subscribeMeterQueue } from '@/lib/firebase/firestore'
import { stationLabel } from '@/lib/stages'
import { AddMeterModal } from '@/components/operator/AddMeterModal'
import type { MachineStatus } from '@/types/workstation'
import type { Meter } from '@/types/meter'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OperatorStatus = 'active' | 'break' | 'downtime'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maps ws_01 → stage_01 etc. (1-to-1 correspondence) */
function stationIdToStageId(stationId: string): string {
  return stationId.replace('ws_', 'stage_')
}

/** Maps operator status to MachineStatus value for Firestore */
function operatorStatusToMachineStatus(s: OperatorStatus): MachineStatus {
  if (s === 'active') return 'green'
  if (s === 'break') return 'yellow'
  return 'red'
}

/** Maps machineStatus from Firestore back to operator status */
function machineStatusToOperatorStatus(ms: MachineStatus | null): OperatorStatus | null {
  if (ms === 'green') return 'active'
  if (ms === 'yellow') return 'break'
  if (ms === 'red') return 'downtime'
  return null
}

/** Format elapsed seconds as "Xh Ym" or "Ym" */
function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** Get today's start timestamp at 00:00 local time */
function getTodayStart(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// ---------------------------------------------------------------------------
// Hook: subscribe to a single station's machine status
// Re-subscribes when stationId changes (unlike useMachineStatuses which
// is designed for a static list known at mount time).
// ---------------------------------------------------------------------------

function useStationMachineStatus(stationId: string | null): {
  machineStatus: MachineStatus | null
  setStatus: (status: MachineStatus | null) => Promise<void>
} {
  const [machineStatus, setMachineStatus_] = useState<MachineStatus | null>(null)

  useEffect(() => {
    if (!stationId) return
    const unsub = subscribeMachineStatuses([stationId], (statuses) => {
      setMachineStatus_(statuses[stationId] ?? null)
    })
    return unsub
  }, [stationId])

  const setStatus = useCallback(
    async (status: MachineStatus | null) => {
      if (!stationId) return
      setMachineStatus_(status)
      try {
        await setMachineStatus(stationId, status)
      } catch (err) {
        console.error('Failed to update machine status:', err)
      }
    },
    [stationId]
  )

  return { machineStatus, setStatus }
}

// ---------------------------------------------------------------------------
// Hook: load operator's assigned workstation from Firestore
// ---------------------------------------------------------------------------

function useOperatorStation(uid: string | undefined): {
  stationId: string | null
  stageId: string | null
  loading: boolean
} {
  const [stationId, setStationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setLoading(false)
      return
    }
    let cancelled = false
    getDoc(doc(db, 'users', uid)).then(snap => {
      if (cancelled) return
      const data = snap.data()
      const ids: string[] = data?.workstationIds ?? []
      setStationId(ids[0] ?? null)
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [uid])

  const stageId = stationId ? stationIdToStageId(stationId) : null
  return { stationId, stageId, loading }
}

// ---------------------------------------------------------------------------
// Hook: completed-today count from Firestore (collectionGroup)
// ---------------------------------------------------------------------------

function useCompletedToday(operatorId: string | undefined): number {
  const [completedToday, setCompletedToday] = useState(0)

  useEffect(() => {
    if (!operatorId) return
    const todayStart = getTodayStart().toISOString()
    const q = query(
      collectionGroup(db, 'stageHistory'),
      where('operatorId', '==', operatorId),
      where('submittedAt', '>=', todayStart)
    )
    return onSnapshot(q, snap => {
      setCompletedToday(snap.size)
    })
  }, [operatorId])

  return completedToday
}

// ---------------------------------------------------------------------------
// Queue hooks + components (inlined so home screen shows queue directly)
// ---------------------------------------------------------------------------

function safeToDate(value: unknown): Date {
  if (typeof value === 'string') return new Date(value)
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  if (value instanceof Date) return value
  return new Date()
}

function formatTimeAgo(value: unknown): string {
  const diffMs = Date.now() - safeToDate(value).getTime()
  const totalMinutes = Math.floor(diffMs / 60_000)
  if (totalMinutes < 1) return 'just now'
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h > 0) return `${h}h ${m}m ago`
  return `${m}m ago`
}

function useMeterQueue(stageId: string | null): Meter[] {
  const [meters, setMeters] = useState<Meter[]>([])
  useEffect(() => {
    if (!stageId) return
    return subscribeMeterQueue(stageId, ['queued', 'rework'], setMeters)
  }, [stageId])
  return meters
}

function TimeAgo({ isoString }: { isoString: string }) {
  const [label, setLabel] = useState(() => formatTimeAgo(isoString))
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    setLabel(formatTimeAgo(isoString))
    ref.current = setInterval(() => setLabel(formatTimeAgo(isoString)), 60_000)
    return () => { if (ref.current !== null) clearInterval(ref.current) }
  }, [isoString])
  return <span className="text-xs text-gray-400 whitespace-nowrap">{label}</span>
}

function QueueCard({ meter, isInteractive, onClick }: { meter: Meter; isInteractive: boolean; onClick: (id: string) => void }) {
  const isRework = meter.status === 'rework'
  return (
    <button
      onClick={() => isInteractive && onClick(meter.id)}
      className="w-full text-left rounded-2xl shadow-sm transition-all"
      style={{
        background: 'var(--color-card-bg)',
        border: '1px solid var(--color-card-border)',
        minHeight: '76px',
        opacity: isInteractive ? 1 : 0.6,
        cursor: isInteractive ? 'pointer' : 'not-allowed',
      }}
    >
      <div className="px-4 py-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-gray-900 leading-tight">{meter.serialNumber}</span>
            {isRework && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
                REWORK <span className="font-normal opacity-90">· Attempt {meter.reworkCount + 1}</span>
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5 leading-snug">{meter.meterType}</p>
          {meter.lastFailedParams && meter.lastFailedParams.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {meter.lastFailedParams.map(name => (
                <span key={name} className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#f3f4f6', color: '#4b5563' }}>
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0 pt-0.5">
          <TimeAgo isoString={meter.createdAt} />
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// StatusHeader component
// ---------------------------------------------------------------------------

interface StatusHeaderProps {
  currentStatus: OperatorStatus | null
  elapsedSeconds: number
  onStatusChange: (s: OperatorStatus) => void
}

const STATUS_OPTIONS: {
  value: OperatorStatus
  label: string
  activeColor: string
  textColor: string
}[] = [
  { value: 'active',   label: 'Active',   activeColor: '#22c55e', textColor: '#fff' },
  { value: 'break',    label: 'Break',    activeColor: '#f59e0b', textColor: '#fff' },
  { value: 'downtime', label: 'Downtime', activeColor: '#ef4444', textColor: '#fff' },
]

function StatusHeader({ currentStatus, elapsedSeconds, onStatusChange }: StatusHeaderProps) {
  return (
    <div
      className="sticky top-0 z-40 px-4 py-3 border-b"
      style={{
        background: 'var(--color-card-bg)',
        borderColor: 'var(--color-card-border)',
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_OPTIONS.map(opt => {
          const isActive = currentStatus === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => onStatusChange(opt.value)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all"
              style={
                isActive
                  ? {
                      background: opt.activeColor,
                      color: opt.textColor,
                      borderColor: opt.activeColor,
                      minHeight: '44px',
                    }
                  : {
                      background: 'transparent',
                      color: '#6b7280',
                      borderColor: '#d1d5db',
                      minHeight: '44px',
                    }
              }
            >
              {isActive && (
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: '#fff' }}
                />
              )}
              {opt.label}
              {isActive && (
                <span className="font-normal text-xs opacity-90 ml-1">
                  · {formatElapsed(elapsedSeconds)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StatCard component
// ---------------------------------------------------------------------------

function StatCard({ label, value, accentColor, small }: {
  label: string
  value: number | string
  accentColor: string
  small?: boolean
}) {
  return (
    <div className="rounded-xl p-3 flex flex-col gap-0.5 shadow-sm flex-1" style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}>
      <span className={`font-bold leading-tight truncate ${small ? 'text-sm' : 'text-xl'}`} style={{ color: accentColor }}>{value}</span>
      <span className="text-xs font-medium text-gray-500 leading-snug">{label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main OperatorPage
// ---------------------------------------------------------------------------

export default function OperatorPage() {
  const router = useRouter()
  const { user, role, loading: authLoading } = useAuth()

  // Redirect non-operators away
  useEffect(() => {
    if (!authLoading && role && role !== 'operator') {
      router.replace('/dashboard')
    }
  }, [authLoading, role, router])

  const { stationId, stageId, loading: stationLoading } = useOperatorStation(user?.uid)

  // Machine status — re-subscribes when stationId resolves
  const { machineStatus, setStatus } = useStationMachineStatus(stationId)
  const operatorStatus = machineStatusToOperatorStatus(machineStatus)

  // Elapsed time since status was set
  const [statusSetAt, setStatusSetAt] = useState<Date | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // When machineStatus changes (including on initial Firestore load), reset timer
  useEffect(() => {
    if (machineStatus !== null) {
      setStatusSetAt(new Date())
      setElapsedSeconds(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineStatus])

  // Tick elapsed timer every second
  useEffect(() => {
    if (!statusSetAt) return
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - statusSetAt.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [statusSetAt])

  const meters = useMeterQueue(stageId)
  const pendingInQueue = meters.filter(m => m.status === 'queued').length
  const reworksAssigned = meters.filter(m => m.status === 'rework').length
  const completedToday = useCompletedToday(user?.uid)
  const [addModalOpen, setAddModalOpen] = useState(false)

  const handleStatusChange = useCallback(async (newStatus: OperatorStatus) => {
    if (!stationId) return
    setStatusSetAt(new Date())
    setElapsedSeconds(0)
    await setStatus(operatorStatusToMachineStatus(newStatus))
  }, [stationId, setStatus])

  const handleMeterClick = useCallback((meterId: string) => {
    router.push(`/operator/queue/${meterId}`)
  }, [router])

  if (authLoading || stationLoading) return <div className="p-10 text-gray-400 text-sm">Loading…</div>
  if (role && role !== 'operator') return null

  // No station assigned — show a clear full-page message, skip everything else
  if (!stationLoading && !stationId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-content-bg)' }}>
        <div className="max-w-sm w-full mx-4 rounded-2xl p-8 text-center flex flex-col items-center gap-4"
          style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(107,114,128,0.1)' }}>
            <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          </div>
          <div>
            <p className="text-base font-bold text-gray-800">No station assigned</p>
            <p className="text-sm text-gray-500 mt-1">You have not been assigned to a workstation yet. Contact your supervisor to get assigned before starting your shift.</p>
          </div>
        </div>
      </div>
    )
  }

  const isActive = operatorStatus === 'active'
  const isGated = operatorStatus === null
  const wsLabel = stageId ? stationLabel(stageId) : null

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-content-bg)' }}>
      {/* Status header */}
      <StatusHeader currentStatus={operatorStatus} elapsedSeconds={elapsedSeconds} onStatusChange={handleStatusChange} />

      {/* Gate message */}
      {isGated && (
        <div className="mx-4 mt-4 rounded-xl px-5 py-3 text-center text-sm font-medium text-gray-500 max-w-2xl mx-auto w-full"
          style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}>
          Select a status above to begin your shift
        </div>
      )}

      {/* Body */}
      <div className="flex-1 px-4 pt-4 pb-8 flex flex-col gap-4 max-w-2xl mx-auto w-full"
        style={{ opacity: isGated ? 0.4 : 1, pointerEvents: (isGated ? 'none' : 'auto') as React.CSSProperties['pointerEvents'] }}>

        {/* 4 stat cards — 2×2 grid */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Completed Today" value={completedToday} accentColor="#22c55e" />
          <StatCard label="Pending in Queue" value={pendingInQueue} accentColor="var(--color-primary)" />
          <StatCard label="Reworks Assigned" value={reworksAssigned} accentColor="#f59e0b" />
          <StatCard label="Station Assigned" value={wsLabel ?? '—'} accentColor="#8b5cf6" small />
        </div>

        {/* Queue section */}
        {!stageId ? (
          <div className="rounded-2xl p-5 text-sm text-gray-500 text-center"
            style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}>
            No station assigned — contact your supervisor
          </div>
        ) : (
          <>
            {/* Queue header */}
            <div className="flex items-center justify-between px-1">
              <p className="text-sm font-semibold text-gray-700">Queue · {wsLabel}</p>
              {meters.length > 0 && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-white" style={{ background: 'var(--color-primary)' }}>
                  {meters.length}
                </span>
              )}
            </div>

            {/* Queue list */}
            {meters.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <svg className="w-12 h-12 text-gray-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-gray-400">Queue is clear</p>
                <p className="text-xs text-gray-300 mt-1">No meters waiting at this station</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {meters.map(meter => (
                  <QueueCard key={meter.id} meter={meter} isInteractive={isActive} onClick={handleMeterClick} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB — add meter, stage_01 only */}
      {stageId === 'stage_01' && !isGated && (
        <button
          onClick={() => setAddModalOpen(true)}
          className="fixed bottom-6 right-6 z-30 flex items-center justify-center rounded-full shadow-lg transition-all active:scale-95"
          style={{ width: '56px', height: '56px', background: 'var(--color-primary)', color: '#fff' }}
          aria-label="Add meter"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      <AddMeterModal open={addModalOpen} onClose={() => setAddModalOpen(false)} onSuccess={() => setAddModalOpen(false)} />
    </div>
  )
}
