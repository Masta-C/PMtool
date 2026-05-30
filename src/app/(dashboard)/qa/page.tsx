'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { stationLabel, STAGES } from '@/lib/stages'
import {
  getMetersByStatus,
  getStageHistoryByStageId,
  getFailedAcceptedEntries,
  getMeterSerialNumbers,
} from '@/lib/firebase/firestore'
import type { Meter, StageHistoryEntry, ParameterResult } from '@/types/meter'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'rework' | 'failures' | 'tamper' | 'hvir'

interface DateRange {
  from: string
  to: string
}

interface FailureRow extends StageHistoryEntry {
  meterId: string
  serialNumber: string
}

interface StageRow extends StageHistoryEntry {
  meterId: string
  serialNumber: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

function rangeToDate(dateStr: string, endOfDay = false): Date {
  const d = new Date(dateStr)
  if (endOfDay) d.setHours(23, 59, 59, 999)
  else d.setHours(0, 0, 0, 0)
  return d
}

// Stage 08 parameters in fixed order
const TAMPER_PARAMS = STAGES.find((s) => s.stageId === 'stage_08')?.parameters ?? []
// Stage 09 parameters in fixed order
const HVIR_PARAMS = STAGES.find((s) => s.stageId === 'stage_09')?.parameters ?? []

function getParamResult(
  parameters: ParameterResult[],
  parameterId: string
): ParameterResult | undefined {
  return parameters.find((p) => p.parameterId === parameterId)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ResultBadge({ result }: { result: string }) {
  const styles: Record<string, React.CSSProperties> = {
    PASSED: { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' },
    FAILED_ACCEPTED: { background: '#fef9c3', color: '#854d0e', border: '1px solid #fde68a' },
    REWORK: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' },
  }
  const label: Record<string, string> = {
    PASSED: 'Passed',
    FAILED_ACCEPTED: 'Within Tolerance',
    REWORK: 'Rework',
  }
  const style = styles[result] ?? { background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={style}
    >
      {label[result] ?? result}
    </span>
  )
}

function ParamCell({ result }: { result: ParameterResult | undefined }) {
  if (!result) {
    return <span className="text-gray-300 text-xs">—</span>
  }
  return (
    <span className="text-xs whitespace-nowrap">
      {result.numericValue}{' '}
      {result.passed ? (
        <span style={{ color: '#16a34a' }}>✓</span>
      ) : (
        <span style={{ color: '#dc2626' }}>✗</span>
      )}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="py-16 text-center text-sm text-gray-400">
      No records in this date range
    </div>
  )
}

function LoadingState() {
  return (
    <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
  )
}

// ---------------------------------------------------------------------------
// Table wrappers
// ---------------------------------------------------------------------------

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#6b7280',
  background: '#f9fafb',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  zIndex: 1,
  borderBottom: '1px solid #e5e7eb',
}

const tdStyle: React.CSSProperties = {
  padding: '9px 12px',
  fontSize: '13px',
  color: '#374151',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid #f3f4f6',
}

// ---------------------------------------------------------------------------
// Tab 1: Rework Items
// ---------------------------------------------------------------------------

function ReworkTab() {
  const [meters, setMeters] = useState<Meter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    // No date filter — rework is a live status, not a historical record.
    // A meter tagged for rework today may have been created weeks ago.
    getMetersByStatus('rework')
      .then((data) => {
        if (!cancelled) setMeters(data)
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <LoadingState />
  if (meters.length === 0) return <EmptyState />

  return (
    <div className="overflow-x-auto rounded-xl shadow-sm" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th style={thStyle}>Order #</th>
            <th style={thStyle}>Tagged Station</th>
            <th style={thStyle}>Current Station</th>
            <th style={thStyle}>Rework Count</th>
            <th style={thStyle}>Time in Rework</th>
          </tr>
        </thead>
        <tbody>
          {meters.map((meter, idx) => (
            <tr key={meter.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
              <td style={tdStyle} className="font-mono font-medium">{meter.serialNumber}</td>
              <td style={tdStyle}>{stationLabel(meter.taggedFromStageId ?? '')}</td>
              <td style={tdStyle}>{stationLabel(meter.currentStageId)}</td>
              <td style={tdStyle}>{meter.reworkCount}</td>
              <td style={tdStyle}>{timeAgo(meter.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 2: Failure-Flagged Meters
// ---------------------------------------------------------------------------

function FailuresTab({ from, to }: { from: string; to: string }) {
  const [rows, setRows] = useState<FailureRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    getFailedAcceptedEntries(rangeToDate(from), rangeToDate(to, true))
      .then(async (entries) => {
        if (cancelled) return
        const meterIds = entries.map((e) => e.meterId)
        const serialMap = await getMeterSerialNumbers(meterIds)
        if (cancelled) return
        const mapped: FailureRow[] = entries.map((e) => ({
          ...e,
          serialNumber: serialMap[e.meterId] ?? e.meterId,
        }))
        setRows(mapped)
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [from, to])

  if (loading) return <LoadingState />
  if (rows.length === 0) return <EmptyState />

  return (
    <div className="overflow-x-auto rounded-xl shadow-sm" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th style={thStyle}>Order #</th>
            <th style={thStyle}>Stage</th>
            <th style={thStyle}>Operator</th>
            <th style={thStyle}>Failed Parameters</th>
            <th style={thStyle}>Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const failedParams = row.parameters
              .filter((p) => !p.passed)
              .map((p) => p.name)
              .join(', ')
            return (
              <tr key={row.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                <td style={tdStyle} className="font-mono font-medium">{row.serialNumber}</td>
                <td style={tdStyle}>{stationLabel(row.stageId)}</td>
                <td style={tdStyle}>{row.operatorName}</td>
                <td style={{ ...tdStyle, maxWidth: '220px', whiteSpace: 'normal' }}>
                  <span style={{ color: '#dc2626', fontSize: '12px' }}>{failedParams || '—'}</span>
                </td>
                <td style={tdStyle}>{formatDate(row.submittedAt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 3 & 4: Stage-specific parameter tables
// ---------------------------------------------------------------------------

interface StageParamTabProps {
  stageId: string
  params: { parameterId: string; name: string }[]
  from: string
  to: string
}

function StageParamTab({ stageId, params, from, to }: StageParamTabProps) {
  const [rows, setRows] = useState<StageRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    getStageHistoryByStageId(stageId, rangeToDate(from), rangeToDate(to, true))
      .then(async (entries) => {
        if (cancelled) return
        const meterIds = entries.map((e) => e.meterId)
        const serialMap = await getMeterSerialNumbers(meterIds)
        if (cancelled) return
        const mapped: StageRow[] = entries.map((e) => ({
          ...e,
          serialNumber: serialMap[e.meterId] ?? e.meterId,
        }))
        setRows(mapped)
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [stageId, from, to])

  if (loading) return <LoadingState />
  if (rows.length === 0) return <EmptyState />

  return (
    <div className="overflow-x-auto rounded-xl shadow-sm" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th style={thStyle}>Order #</th>
            <th style={thStyle}>Operator</th>
            <th style={thStyle}>Date</th>
            <th style={thStyle}>Result</th>
            {params.map((p) => (
              <th key={p.parameterId} style={thStyle}>{p.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
              <td style={tdStyle} className="font-mono font-medium">{row.serialNumber}</td>
              <td style={tdStyle}>{row.operatorName}</td>
              <td style={tdStyle}>{formatDate(row.submittedAt)}</td>
              <td style={tdStyle}><ResultBadge result={row.overallResult} /></td>
              {params.map((p) => (
                <td key={p.parameterId} style={tdStyle}>
                  <ParamCell result={getParamResult(row.parameters, p.parameterId)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

const TABS: { id: TabId; label: string }[] = [
  { id: 'rework',   label: 'Rework' },
  { id: 'failures', label: 'Failures' },
  { id: 'tamper',   label: 'Tamper Test' },
  { id: 'hvir',     label: 'HV-IR Test' },
]

// ---------------------------------------------------------------------------
// Date range filter
// ---------------------------------------------------------------------------

function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="text-xs font-medium text-gray-500">From</label>
      <input
        type="date"
        value={from}
        max={to}
        onChange={(e) => onFromChange(e.target.value)}
        className="border rounded-lg px-2 py-1 text-xs"
        style={{ borderColor: '#d1d5db', color: '#374151' }}
      />
      <label className="text-xs font-medium text-gray-500">To</label>
      <input
        type="date"
        value={to}
        min={from}
        max={todayIso()}
        onChange={(e) => onToChange(e.target.value)}
        className="border rounded-lg px-2 py-1 text-xs"
        style={{ borderColor: '#d1d5db', color: '#374151' }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main QA Page
// ---------------------------------------------------------------------------

export default function QAPage() {
  const router = useRouter()
  const { role, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('rework')
  const [from, setFrom] = useState<string>(todayIso())
  const [to, setTo] = useState<string>(todayIso())

  // Guard: only qa role
  useEffect(() => {
    if (!authLoading && role && role !== 'qa') {
      router.replace('/dashboard')
    }
  }, [authLoading, role, router])

  const handleTabChange = useCallback((id: TabId) => {
    setActiveTab(id)
  }, [])

  if (authLoading) {
    return <div className="p-10 text-gray-400 text-sm">Loading…</div>
  }

  if (role && role !== 'qa') return null

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--color-content-bg)' }}
    >
      {/* Page header */}
      <div
        className="sticky top-0 z-40 px-4 py-3 border-b"
        style={{ background: 'var(--color-card-bg)', borderColor: 'var(--color-card-border)' }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3 max-w-5xl mx-auto w-full">
          <div>
            <h1 className="text-base font-bold" style={{ color: '#1e293b' }}>QA Dashboard</h1>
            <p className="text-xs text-gray-400">Read-only monitoring view</p>
          </div>
          <DateRangeFilter
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
          />
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="px-4 pt-4 max-w-5xl mx-auto w-full"
      >
        <div className="flex gap-2 flex-wrap">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className="px-4 py-2 rounded-full text-sm font-semibold border transition-all"
                style={
                  isActive
                    ? {
                        background: 'var(--color-primary)',
                        color: '#fff',
                        borderColor: 'var(--color-primary)',
                      }
                    : {
                        background: '#fff',
                        color: '#6b7280',
                        borderColor: '#d1d5db',
                      }
                }
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 px-4 py-4 max-w-5xl mx-auto w-full">
        {activeTab === 'rework' && <ReworkTab />}
        {activeTab === 'failures' && <FailuresTab from={from} to={to} />}
        {activeTab === 'tamper' && (
          <StageParamTab stageId="stage_08" params={TAMPER_PARAMS} from={from} to={to} />
        )}
        {activeTab === 'hvir' && (
          <StageParamTab stageId="stage_09" params={HVIR_PARAMS} from={from} to={to} />
        )}
      </div>
    </div>
  )
}
