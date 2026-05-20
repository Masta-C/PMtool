'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/hooks/useAuth'
import { subscribeMachineStatuses, setMachineStatus } from '@/lib/firebase/firestore'
import { stationLabel } from '@/lib/stages'
import type { MachineStatus } from '@/types/workstation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OperatorStatus = 'active' | 'break' | 'downtime'

interface StatCounts {
  completedToday: number
  pendingInQueue: number
  reworksAssigned: number
}

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
// Hook: real-time stat counts from Firestore
// ---------------------------------------------------------------------------

function useOperatorStats(
  stageId: string | null,
  operatorId: string | undefined
): StatCounts {
  const [counts, setCounts] = useState<StatCounts>({
    completedToday: 0,
    pendingInQueue: 0,
    reworksAssigned: 0,
  })

  // Pending in queue: meters at this stage with status 'queued'
  useEffect(() => {
    if (!stageId) return
    const q = query(
      collection(db, 'meters'),
      where('currentStageId', '==', stageId),
      where('status', 'in', ['queued'])
    )
    return onSnapshot(q, snap => {
      setCounts(prev => ({ ...prev, pendingInQueue: snap.size }))
    })
  }, [stageId])

  // Reworks assigned: meters at this stage with status 'rework'
  useEffect(() => {
    if (!stageId) return
    const q = query(
      collection(db, 'meters'),
      where('currentStageId', '==', stageId),
      where('status', '==', 'rework')
    )
    return onSnapshot(q, snap => {
      setCounts(prev => ({ ...prev, reworksAssigned: snap.size }))
    })
  }, [stageId])

  // Completed today: stageHistory entries submitted by this operator today.
  // TODO: Replace with collectionGroup('stageHistory') query once composite
  // index (operatorId + submittedAt + overallResult) is deployed.
  // Stub: keeps count at 0 until Firestore indexes are ready.
  useEffect(() => {
    if (!operatorId || !stageId) return
    // intentional no-op stub — avoids unused-var lint errors
    void getTodayStart()
    setCounts(prev => ({ ...prev, completedToday: 0 }))
  }, [operatorId, stageId])

  return counts
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

function StatCard({
  label,
  value,
  accentColor,
}: {
  label: string
  value: number
  accentColor: string
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1 shadow-sm flex-1"
      style={{
        background: 'var(--color-card-bg)',
        border: '1px solid var(--color-card-border)',
      }}
    >
      <span className="text-2xl font-bold" style={{ color: accentColor }}>
        {value}
      </span>
      <span className="text-xs font-medium text-gray-600 leading-snug">{label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StationCard component
// ---------------------------------------------------------------------------

function StationCard({
  stageId,
  pending,
  reworks,
  isInteractive,
  onClick,
}: {
  stageId: string
  pending: number
  reworks: number
  isInteractive: boolean
  onClick: () => void
}) {
  const label = stationLabel(stageId)

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-sm transition-all"
      style={{
        background: 'var(--color-card-bg)',
        border: '1px solid var(--color-card-border)',
        opacity: isInteractive ? 1 : 0.5,
      }}
    >
      <button
        onClick={onClick}
        disabled={!isInteractive}
        className="w-full p-5 flex items-center gap-4 text-left transition-colors"
        style={{
          cursor: isInteractive ? 'pointer' : 'not-allowed',
          minHeight: '80px',
          background: 'transparent',
        }}
      >
        {/* Station info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-base leading-snug truncate">{label}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {pending} pending · {reworks} rework
          </p>
        </div>

        {/* Chevron */}
        <svg
          className="w-5 h-5 text-gray-400 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {!isInteractive && (
        <p className="px-5 pb-4 text-xs text-gray-400">
          Set status to Active to process meters
        </p>
      )}
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

  const stats = useOperatorStats(stageId, user?.uid)

  const handleStatusChange = useCallback(
    async (newStatus: OperatorStatus) => {
      if (!stationId) return
      const ms = operatorStatusToMachineStatus(newStatus)
      setStatusSetAt(new Date())
      setElapsedSeconds(0)
      await setStatus(ms)
    },
    [stationId, setStatus]
  )

  const handleStationCardClick = useCallback(() => {
    router.push('/operator/queue')
  }, [router])

  // Loading states
  if (authLoading || stationLoading) {
    return (
      <div className="p-10 text-gray-400 text-sm">Loading…</div>
    )
  }

  // Gate: only operator can see this page
  if (role && role !== 'operator') {
    return null
  }

  const isActive = operatorStatus === 'active'
  const hasStatus = operatorStatus !== null
  const isGated = !hasStatus

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--color-content-bg)' }}
    >
      {/* 1. Persistent status header */}
      <StatusHeader
        currentStatus={operatorStatus}
        elapsedSeconds={elapsedSeconds}
        onStatusChange={handleStatusChange}
      />

      {/* Body */}
      <div className="flex-1 px-4 py-5 flex flex-col gap-5 max-w-2xl mx-auto w-full">

        {/* 2. Status gate message */}
        {isGated && (
          <div
            className="rounded-xl px-5 py-4 text-center text-sm font-medium text-gray-500"
            style={{
              background: 'var(--color-card-bg)',
              border: '1px solid var(--color-card-border)',
            }}
          >
            Select a status above to begin your shift
          </div>
        )}

        {/* Gated content */}
        <div
          className="flex flex-col gap-5 transition-all"
          style={{
            opacity: isGated ? 0.4 : 1,
            pointerEvents: (isGated ? 'none' : 'auto') as React.CSSProperties['pointerEvents'],
          }}
        >
          {/* 3. Stat cards */}
          <div className="flex gap-3">
            <StatCard
              label="Completed Today"
              value={stats.completedToday}
              accentColor="#22c55e"
            />
            <StatCard
              label="Pending in Queue"
              value={stats.pendingInQueue}
              accentColor="var(--color-primary)"
            />
            <StatCard
              label="Reworks Assigned"
              value={stats.reworksAssigned}
              accentColor="#f59e0b"
            />
          </div>

          {/* 4. Station card */}
          {stageId ? (
            <StationCard
              stageId={stageId}
              pending={stats.pendingInQueue}
              reworks={stats.reworksAssigned}
              isInteractive={isActive}
              onClick={handleStationCardClick}
            />
          ) : (
            <div
              className="rounded-2xl p-5 text-sm text-gray-500 text-center"
              style={{
                background: 'var(--color-card-bg)',
                border: '1px solid var(--color-card-border)',
              }}
            >
              No station assigned — contact your supervisor
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
