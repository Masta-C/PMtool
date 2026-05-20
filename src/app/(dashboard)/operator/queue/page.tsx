'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/hooks/useAuth'
import { subscribeMeterQueue, subscribeStageHistory } from '@/lib/firebase/firestore'
import { stationLabel } from '@/lib/stages'
import { AddMeterModal } from '@/components/operator/AddMeterModal'
import type { Meter, StageHistoryEntry } from '@/types/meter'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maps ws_01 → stage_01 etc. */
function stationIdToStageId(stationId: string): string {
  return stationId.replace('ws_', 'stage_')
}

/** Format a createdAt ISO string as "Xh Ym ago", "Ym ago", or "just now" */
function formatTimeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const totalMinutes = Math.floor(diffMs / 60_000)
  if (totalMinutes < 1) return 'just now'
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h > 0) return `${h}h ${m}m ago`
  return `${m}m ago`
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
    getDoc(doc(db, 'users', uid))
      .then((snap) => {
        if (cancelled) return
        const data = snap.data()
        const ids: string[] = data?.workstationIds ?? []
        setStationId(ids[0] ?? null)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [uid])

  const stageId = stationId ? stationIdToStageId(stationId) : null
  return { stationId, stageId, loading }
}

// ---------------------------------------------------------------------------
// Hook: subscribe to meter queue
// ---------------------------------------------------------------------------

function useMeterQueue(stageId: string | null): Meter[] {
  const [meters, setMeters] = useState<Meter[]>([])

  useEffect(() => {
    if (!stageId) return
    const unsub = subscribeMeterQueue(stageId, ['queued', 'rework'], setMeters)
    return unsub
  }, [stageId])

  return meters
}

// ---------------------------------------------------------------------------
// Hook: load deduplicated failed parameter names from stageHistory
// ---------------------------------------------------------------------------

function useMeterFailures(meterId: string): string[] {
  const [failedNames, setFailedNames] = useState<string[]>([])

  useEffect(() => {
    const unsub = subscribeStageHistory(meterId, (entries: StageHistoryEntry[]) => {
      // Collect all failed parameters across all history entries,
      // deduplicate by parameterId, return display names
      const seen = new Set<string>()
      const names: string[] = []
      for (const entry of entries) {
        for (const param of entry.parameters) {
          if (!param.passed && !seen.has(param.parameterId)) {
            seen.add(param.parameterId)
            names.push(param.name)
          }
        }
      }
      setFailedNames(names)
    })
    return unsub
  }, [meterId])

  return failedNames
}

// ---------------------------------------------------------------------------
// QueueCardFailures — lazy-loaded failed parameter tags
// ---------------------------------------------------------------------------

function QueueCardFailures({ meterId }: { meterId: string }) {
  const failedNames = useMeterFailures(meterId)

  if (failedNames.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {failedNames.map((name) => (
        <span
          key={name}
          className="px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ background: '#f3f4f6', color: '#4b5563' }}
        >
          {name}
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TimeAgo — updates every minute
// ---------------------------------------------------------------------------

function TimeAgo({ isoString }: { isoString: string }) {
  const [label, setLabel] = useState(() => formatTimeAgo(isoString))
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setLabel(formatTimeAgo(isoString))
    intervalRef.current = setInterval(() => {
      setLabel(formatTimeAgo(isoString))
    }, 60_000)
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current)
    }
  }, [isoString])

  return (
    <span className="text-xs text-gray-400 whitespace-nowrap">{label}</span>
  )
}

// ---------------------------------------------------------------------------
// QueueCard
// ---------------------------------------------------------------------------

interface QueueCardProps {
  meter: Meter
  onClick: (meterId: string) => void
}

function QueueCard({ meter, onClick }: QueueCardProps) {
  const isRework = meter.status === 'rework'
  const attemptNumber = meter.reworkCount + 1

  return (
    <button
      onClick={() => onClick(meter.id)}
      className="w-full text-left rounded-2xl shadow-sm transition-all active:scale-[0.99]"
      style={{
        background: 'var(--color-card-bg)',
        border: '1px solid var(--color-card-border)',
        minHeight: '76px',
      }}
    >
      <div className="px-4 py-4 flex items-start gap-3">
        {/* Main info */}
        <div className="flex-1 min-w-0">
          {/* Row 1: serial number + rework badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-gray-900 leading-tight">
              {meter.serialNumber}
            </span>
            {isRework && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
                REWORK
                <span className="font-normal opacity-90">· Attempt {attemptNumber}</span>
              </span>
            )}
          </div>

          {/* Row 2: meter type */}
          <p className="text-sm text-gray-500 mt-0.5 leading-snug">{meter.meterType}</p>

          {/* Row 3: prior failed parameter tags (lazy-loaded) */}
          <QueueCardFailures meterId={meter.id} />
        </div>

        {/* Right: time + chevron */}
        <div className="flex flex-col items-end gap-2 shrink-0 pt-0.5">
          <TimeAgo isoString={meter.createdAt} />
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="text-5xl mb-4" aria-hidden="true">
        ✅
      </div>
      <p className="text-lg font-semibold text-gray-700">All clear — no meters in queue</p>
      <p className="text-sm text-gray-400 mt-1">New meters will appear here automatically.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main QueuePage
// ---------------------------------------------------------------------------

export default function QueuePage() {
  const router = useRouter()
  const { user, role, loading: authLoading } = useAuth()
  const { stageId, loading: stationLoading } = useOperatorStation(user?.uid)

  const meters = useMeterQueue(stageId)

  const [addModalOpen, setAddModalOpen] = useState(false)

  // Redirect non-operators away
  useEffect(() => {
    if (!authLoading && role && role !== 'operator' && role !== 'qa') {
      router.replace('/dashboard')
    }
  }, [authLoading, role, router])

  const handleCardClick = useCallback(
    (meterId: string) => {
      router.push(`/operator/queue/${meterId}`)
    },
    [router]
  )

  const handleAddSuccess = useCallback((_meterId: string) => {
    setAddModalOpen(false)
    // New meter appears automatically via onSnapshot
  }, [])

  // Loading state
  if (authLoading || stationLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--color-content-bg)' }}
      >
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    )
  }

  // Gate: only operator/qa can see this page
  if (role && role !== 'operator' && role !== 'qa') {
    return null
  }

  const headerTitle = stageId ? stationLabel(stageId) : 'Queue'
  const isStage01 = stageId === 'stage_01'

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--color-content-bg)' }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="sticky top-0 z-40 px-4 flex items-center gap-3 border-b"
        style={{
          background: 'var(--color-card-bg)',
          borderColor: 'var(--color-card-border)',
          minHeight: '56px',
        }}
      >
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
          style={{ width: '44px', height: '44px' }}
          aria-label="Back"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <h1 className="flex-1 text-base font-semibold text-gray-900 truncate">
          {headerTitle}
        </h1>

        {/* Queue count badge */}
        {meters.length > 0 && (
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{
              background: 'var(--color-primary)',
              color: '#fff',
            }}
          >
            {meters.length}
          </span>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Body                                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex flex-col px-4 py-4 gap-3 max-w-2xl mx-auto w-full">
        {meters.length === 0 ? (
          <EmptyState />
        ) : (
          meters.map((meter) => (
            <QueueCard key={meter.id} meter={meter} onClick={handleCardClick} />
          ))
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* FAB — only at stage_01                                              */}
      {/* ------------------------------------------------------------------ */}
      {isStage01 && (
        <button
          onClick={() => setAddModalOpen(true)}
          className="fixed bottom-6 right-6 z-30 flex items-center justify-center rounded-full shadow-lg transition-all active:scale-95"
          style={{
            width: '56px',
            height: '56px',
            background: 'var(--color-primary)',
            color: '#fff',
          }}
          aria-label="Add meter"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Add Meter Modal (stage_01 only)                                     */}
      {/* ------------------------------------------------------------------ */}
      <AddMeterModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleAddSuccess}
      />
    </div>
  )
}
