'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { stationLabel } from '@/lib/stages'

// ---------------------------------------------------------------------------
// Types — will be merged from the foundation branch when available
// ---------------------------------------------------------------------------

interface ReworkItem {
  meterId: string
  serialNumber: string
  meterType: string
  taggedFromStageId: string
  taggedFromStageName: string
  taggedByOperatorId: string
  taggedAt: string         // ISO timestamp
  overrideComment: string  // The reason given when tagging
  targetStageId: string    // This station's stage
}

// ---------------------------------------------------------------------------
// Mock data — replaced by Firestore query in Phase 2
// ---------------------------------------------------------------------------

const MOCK_REWORK_ITEMS: ReworkItem[] = [
  {
    meterId: 'WO-2026-00005',
    serialNumber: 'WO-2026-00005',
    meterType: 'EM-400',
    taggedFromStageId: 'stage_05',
    taggedFromStageName: 'Functional Testing',
    taggedByOperatorId: 'OP-003',
    taggedAt: new Date(Date.now() - 2700000).toISOString(),
    overrideComment: 'Relay test failed — measured 0.23V, expected > 0.5V',
    targetStageId: 'stage_04',
  },
  {
    meterId: 'WO-2026-00007',
    serialNumber: 'WO-2026-00007',
    meterType: 'EM-500',
    taggedFromStageId: 'stage_03',
    taggedFromStageName: 'PCBA Incoming / Store',
    taggedByOperatorId: 'OP-001',
    taggedAt: new Date(Date.now() - 7200000).toISOString(),
    overrideComment: 'Power supply test shows irregular reading',
    targetStageId: 'stage_04',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(isoTimestamp: string): string {
  const diffMs = Date.now() - new Date(isoTimestamp).getTime()
  const diffSeconds = Math.floor(diffMs / 1000)

  if (diffSeconds < 60) return 'just now'
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes} min ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return diffHours === 1 ? '1 hr ago' : `${diffHours} hrs ago`
  const diffDays = Math.floor(diffHours / 24)
  return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`
}

// ---------------------------------------------------------------------------
// Confirmation modal
// ---------------------------------------------------------------------------

interface ConfirmModalProps {
  item: ReworkItem
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmModal({ item, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl p-6"
        style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
      >
        <h2 className="text-lg font-bold text-gray-900 mb-2">Accept rework item?</h2>
        <p className="text-sm text-gray-600 mb-1">
          Serial:{' '}
          <span className="font-semibold text-gray-900">{item.serialNumber}</span>
        </p>
        <p className="text-sm text-gray-600 mb-6">
          This will move the meter to your active queue.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
            style={{ background: '#d97706' }}
          >
            Confirm — Accept &amp; Begin
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl text-sm font-semibold transition-colors"
            style={{
              background: 'var(--color-content-bg)',
              color: '#374151',
              border: '1px solid var(--color-card-border)',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Success banner
// ---------------------------------------------------------------------------

function SuccessBanner({ serial, onDismiss }: { serial: string; onDismiss: () => void }) {
  return (
    <div
      className="rounded-xl p-4 flex items-start gap-3 mb-4"
      style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
    >
      <span className="text-green-500 text-xl leading-none mt-0.5">&#10003;</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-green-800">Meter accepted</p>
        <p className="text-sm text-green-700">
          <span className="font-medium">{serial}</span> has been moved to your active queue.
          Open the Queue page to begin processing.
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="text-green-600 hover:text-green-800 text-lg leading-none font-bold"
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rework card
// ---------------------------------------------------------------------------

interface ReworkCardProps {
  item: ReworkItem
  onAccept: (item: ReworkItem) => void
}

function ReworkCard({ item, onAccept }: ReworkCardProps) {
  return (
    <div
      className="rounded-xl shadow-sm overflow-hidden"
      style={{
        background: 'var(--color-card-bg)',
        border: '1px solid var(--color-card-border)',
        borderLeft: '4px solid #f59e0b',
      }}
    >
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-yellow-400 text-base leading-none">&#11044;</span>
          <span className="text-base font-bold text-gray-900">{item.serialNumber}</span>
          <span
            className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: '#fef3c7', color: '#92400e' }}
          >
            {item.meterType}
          </span>
        </div>

        {/* Tagged from */}
        <p className="text-sm text-gray-500 mb-1">
          Tagged from:{' '}
          <span className="font-medium text-gray-700">
            {stationLabel(item.taggedFromStageId)}
          </span>
        </p>

        {/* Tagged by + time */}
        <p className="text-sm text-gray-500 mb-3">
          Tagged by:{' '}
          <span className="font-medium text-gray-700">{item.taggedByOperatorId}</span>
          <span className="mx-1.5 text-gray-300">·</span>
          <span>{formatTimeAgo(item.taggedAt)}</span>
        </p>

        {/* Reason */}
        <p
          className="text-sm italic mb-5 leading-relaxed"
          style={{ color: '#b45309' }}
        >
          &ldquo;{item.overrideComment}&rdquo;
        </p>

        {/* Accept button */}
        <button
          onClick={() => onAccept(item)}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 sm:w-auto sm:px-8"
          style={{ background: '#d97706' }}
        >
          Accept &amp; Begin
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div
      className="rounded-xl p-12 flex flex-col items-center justify-center text-center"
      style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
    >
      <span className="text-4xl mb-4 block" aria-hidden="true">&#10003;</span>
      <p className="text-base font-semibold text-gray-700">No rework items</p>
      <p className="text-sm text-gray-400 mt-1">Your queue is clear</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReworkPage() {
  // useAuth is called to ensure the hook fires (access control & future filtering)
  const { role } = useAuth()

  const [items, setItems] = useState<ReworkItem[]>(MOCK_REWORK_ITEMS)
  const [pendingAccept, setPendingAccept] = useState<ReworkItem | null>(null)
  const [acceptedSerials, setAcceptedSerials] = useState<string[]>([])

  // Access control — all authenticated roles may see this page per spec
  // (operator, supervisor, qa, admin)
  // role is available here for future per-role filtering
  void role

  function handleAcceptClick(item: ReworkItem) {
    setPendingAccept(item)
  }

  function handleConfirm() {
    if (!pendingAccept) return
    // Local state update — real implementation calls tagMeterForRework()
    setItems(prev => prev.filter(i => i.meterId !== pendingAccept.meterId))
    setAcceptedSerials(prev => [...prev, pendingAccept.serialNumber])
    setPendingAccept(null)
  }

  function handleCancel() {
    setPendingAccept(null)
  }

  function dismissBanner(serial: string) {
    setAcceptedSerials(prev => prev.filter(s => s !== serial))
  }

  return (
    <>
      {/* Confirmation modal (portal-like, rendered above everything) */}
      {pendingAccept && (
        <ConfirmModal
          item={pendingAccept}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      <div className="p-6 max-w-2xl mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Rework Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            Items tagged to your station for correction
          </p>
        </div>

        {/* Success banners */}
        {acceptedSerials.map(serial => (
          <SuccessBanner
            key={serial}
            serial={serial}
            onDismiss={() => dismissBanner(serial)}
          />
        ))}

        {/* Content */}
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {items.map(item => (
              <ReworkCard
                key={item.meterId}
                item={item}
                onAccept={handleAcceptClick}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
