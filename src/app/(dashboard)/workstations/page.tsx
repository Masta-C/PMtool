'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { doc, arrayRemove, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import { stationLabel } from '@/lib/stages'
import { useMachineStatuses } from '@/hooks/useMachineStatuses'
import type { MachineStatus } from '@/types/workstation'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STAGES = [
  { stageId: 'stage_01', stationId: 'ws_01', name: 'Incoming Inspection / Stores' },
  { stageId: 'stage_02', stationId: 'ws_02', name: 'SMD, TH Soldering & Testing / EMS' },
  { stageId: 'stage_03', stationId: 'ws_03', name: 'PCBA Incoming / Store' },
  { stageId: 'stage_04', stationId: 'ws_04', name: 'Base Assembly' },
  { stageId: 'stage_05', stationId: 'ws_05', name: 'Functional Testing' },
  { stageId: 'stage_06', stationId: 'ws_06', name: 'Cover Assembly' },
  { stageId: 'stage_07', stationId: 'ws_07', name: 'Error Compensation' },
  { stageId: 'stage_08', stationId: 'ws_08', name: 'Tamper Test' },
  { stageId: 'stage_09', stationId: 'ws_09', name: 'HV-IR Test' },
  { stageId: 'stage_10', stationId: 'ws_10', name: 'Soaking Test' },
  { stageId: 'stage_11', stationId: 'ws_11', name: 'Final Testing' },
  { stageId: 'stage_12', stationId: 'ws_12', name: 'Sealing' },
  { stageId: 'stage_13', stationId: 'ws_13', name: 'Packing' },
]

const UNASSIGNED_VALUE = ''

// ---------------------------------------------------------------------------
// Date range types & localStorage helpers
// ---------------------------------------------------------------------------

type DateRange = 'today' | 'month'

interface StoredDateRange {
  range: DateRange
  date: string // ISO date string e.g. '2026-05-19'
}

function getTodayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function localStorageKey(stationId: string): string {
  return `dateRange_ws_${stationId}_${getTodayString()}`
}

function loadDateRange(stationId: string): DateRange | null {
  try {
    const raw = localStorage.getItem(localStorageKey(stationId))
    if (!raw) return null
    const stored: StoredDateRange = JSON.parse(raw)
    if (stored.date !== getTodayString()) return null
    return stored.range
  } catch {
    return null
  }
}

function saveDateRange(stationId: string, range: DateRange): void {
  try {
    const value: StoredDateRange = { range, date: getTodayString() }
    localStorage.setItem(localStorageKey(stationId), JSON.stringify(value))
  } catch {
    // localStorage unavailable — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Operator option type
// ---------------------------------------------------------------------------

interface OperatorOption {
  id: string   // stored value (uid or '')
  label: string // display name
}

// ---------------------------------------------------------------------------
// Hook — builds operator options from Firestore users filtered by role
// ---------------------------------------------------------------------------

function useOperatorOptions(): { operatorOptions: OperatorOption[]; loading: boolean } {
  const { users, loading } = useUsers()
  const operatorOptions: OperatorOption[] = [
    { id: UNASSIGNED_VALUE, label: 'Unassigned' },
    ...users
      .filter(u => u.role === 'operator' && u.isActive)
      .map(u => ({
        id: u.uid,
        label: u.displayName?.trim() || u.email,
      })),
  ]
  return { operatorOptions, loading }
}

// ---------------------------------------------------------------------------
// Stub hook — replace with real Firestore hook once data layer merges
// ---------------------------------------------------------------------------

function useStationCounts() {
  return {
    counts: {
      stage_01: { total: 5, reworkCount: 0 },
      stage_02: { total: 2, reworkCount: 1 },
      stage_03: { total: 0, reworkCount: 0 },
      stage_04: { total: 8, reworkCount: 0 },
      stage_05: { total: 3, reworkCount: 2 },
      stage_06: { total: 0, reworkCount: 0 },
      stage_07: { total: 4, reworkCount: 0 },
      stage_08: { total: 1, reworkCount: 1 },
      stage_09: { total: 6, reworkCount: 0 },
      stage_10: { total: 0, reworkCount: 0 },
      stage_11: { total: 7, reworkCount: 0 },
      stage_12: { total: 2, reworkCount: 1 },
      stage_13: { total: 0, reworkCount: 0 },
    } as Record<string, { total: number; reworkCount: number }>,
    loading: false,
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedMeter {
  serialNumber: string
  meterType: string
}

interface ExcelModalState {
  open: boolean
  fileName: string
  status: 'parsing' | 'preview' | 'error'
  rows: ParsedMeter[]
  errorMessage: string
}

interface OrderItem {
  orderId: string
  meters: number
  date: string
  operator: string
}

// ---------------------------------------------------------------------------
// Mock order data helpers
// ---------------------------------------------------------------------------

const MOCK_OPERATORS = ['Ravi Kumar', 'Priya Sharma', 'Ankit Verma', 'Sunita Patel', 'Deepak Rao']

function makeMockOrders(stageId: string, count: number, prefix: string): OrderItem[] {
  const base = parseInt(stageId.replace('stage_', ''), 10) * 100
  return Array.from({ length: count }, (_, i) => ({
    orderId: `${prefix}-${String(base + i + 1).padStart(4, '0')}`,
    meters: 50 + ((base + i * 7) % 200),
    date: new Date(Date.now() - i * 86_400_000).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    }),
    operator: MOCK_OPERATORS[(base + i) % MOCK_OPERATORS.length],
  }))
}

// ---------------------------------------------------------------------------
// Order List Modal (Queue / Rework)
// ---------------------------------------------------------------------------

function OrderListModal({
  open,
  title,
  stationName,
  orders,
  onClose,
}: {
  open: boolean
  title: string
  stationName: string
  orders: OrderItem[]
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col"
        style={{ background: 'var(--color-card-bg)', maxHeight: '80vh' }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: 'var(--color-card-border)' }}
        >
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {title}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              {stationName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {orders.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>
              No orders to display.
            </p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: 'var(--color-content-bg)' }}>
                  {['Order #', 'Meters', 'Date', 'Operator'].map(col => (
                    <th
                      key={col}
                      className="text-left px-3 py-2 font-semibold border"
                      style={{
                        borderColor: 'var(--color-card-border)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((row, idx) => (
                  <tr key={idx}>
                    <td
                      className="px-3 py-2 border font-mono font-medium"
                      style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-primary)' }}
                    >
                      {row.orderId}
                    </td>
                    <td
                      className="px-3 py-2 border"
                      style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-primary)' }}
                    >
                      {row.meters}
                    </td>
                    <td
                      className="px-3 py-2 border"
                      style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-secondary)' }}
                    >
                      {row.date}
                    </td>
                    <td
                      className="px-3 py-2 border"
                      style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-secondary)' }}
                    >
                      {row.operator}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex justify-end shrink-0"
          style={{ borderColor: 'var(--color-card-border)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors"
            style={{
              borderColor: 'var(--color-card-border)',
              color: 'var(--color-text-primary)',
              background: 'transparent',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCardAccent(total: number, reworkCount: number): { borderClass: string } {
  if (total === 0) {
    return { borderClass: 'border-l-4 border-red-500' }
  }
  if (reworkCount > 0) {
    return { borderClass: 'border-l-4 border-yellow-400' }
  }
  return { borderClass: 'border-l-4 border-green-500' }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Date Range Selector — inline Today / Month buttons
// ---------------------------------------------------------------------------

function DateRangeSelector({
  stationId,
  value,
  onChange,
}: {
  stationId: string
  value: DateRange | null
  onChange: (stationId: string, range: DateRange) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Date Range</label>
      <div className="flex gap-2">
        {(['today', 'month'] as const).map(range => {
          const active = value === range
          return (
            <button
              key={range}
              onClick={() => onChange(stationId, range)}
              className="flex-1 text-xs font-semibold rounded-lg px-3 py-1.5 border transition-all"
              style={
                active
                  ? {
                      background: 'var(--color-primary)',
                      color: '#ffffff',
                      borderColor: 'var(--color-primary)',
                    }
                  : {
                      background: 'transparent',
                      color: '#6b7280',
                      borderColor: '#d1d5db',
                    }
              }
            >
              {range === 'today' ? 'Today' : 'Month'}
            </button>
          )
        })}
      </div>
      {value === null && (
        <p className="text-xs text-gray-400 mt-1">No range selected</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Machine Status Display (read-only — operator sets from their station)
// ---------------------------------------------------------------------------

const MACHINE_STATUS_OPTIONS: { value: MachineStatus; label: string; color: string }[] = [
  { value: 'green',  label: 'Running',  color: '#22c55e' },
  { value: 'yellow', label: 'Break',    color: '#eab308' },
  { value: 'red',    label: 'Down',     color: '#ef4444' },
]

function MachineStatusDisplay({
  status,
}: {
  stationId: string
  status: MachineStatus | null
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        Machine Status
        <span className="ml-1 font-normal text-gray-400">(set by operator)</span>
      </label>
      <div className="flex gap-2">
        {MACHINE_STATUS_OPTIONS.map(opt => {
          const active = status === opt.value
          return (
            <div
              key={opt.value}
              title={`${opt.label} — status set by operator`}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg px-2 py-1.5 border select-none"
              style={
                active
                  ? { background: opt.color, color: '#fff', borderColor: opt.color }
                  : { background: 'transparent', color: '#9ca3af', borderColor: '#e5e7eb' }
              }
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: active ? '#fff' : opt.color, opacity: active ? 1 : 0.4 }}
              />
              {opt.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Excel Upload Modal
// ---------------------------------------------------------------------------

function ExcelModal({
  state,
  onConfirm,
  onCancel,
}: {
  state: ExcelModalState
  onConfirm: (rows: ParsedMeter[]) => void
  onCancel: () => void
}) {
  if (!state.open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Excel Upload Preview"
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Upload Excel</h2>
            <p className="text-sm text-gray-500 mt-0.5 truncate max-w-xs">{state.fileName}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          {state.status === 'parsing' && (
            <div className="flex items-center gap-3 py-8 justify-center text-gray-500">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Parsing {state.fileName}...</span>
            </div>
          )}

          {state.status === 'error' && (
            <div className="py-6 text-center">
              <div className="text-red-500 font-medium mb-2">Failed to parse file</div>
              <p className="text-sm text-gray-500">{state.errorMessage}</p>
            </div>
          )}

          {state.status === 'preview' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">
                  {state.rows.length} meter{state.rows.length !== 1 ? 's' : ''} found
                </span>
              </div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 border border-gray-200">#</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 border border-gray-200">Serial Number</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 border border-gray-200">Meter Type</th>
                  </tr>
                </thead>
                <tbody>
                  {state.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 border border-gray-200 text-gray-400">{idx + 1}</td>
                      <td className="px-3 py-2 border border-gray-200 font-mono text-gray-800">{row.serialNumber}</td>
                      <td className="px-3 py-2 border border-gray-200 text-gray-700">{row.meterType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          {state.status === 'preview' && (
            <button
              onClick={() => onConfirm(state.rows)}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
              style={{ background: 'var(--color-primary)' }}
            >
              Add {state.rows.length} meter{state.rows.length !== 1 ? 's' : ''} to Queue
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Manual Add Panel (inline modal)
// ---------------------------------------------------------------------------

function ManualAddPanel({
  open,
  onAdd,
  onClose,
}: {
  open: boolean
  onAdd: (meter: ParsedMeter) => void
  onClose: () => void
}) {
  const [serial, setSerial] = useState('')
  const [meterType, setMeterType] = useState('')
  const serialRef = useRef<HTMLInputElement>(null)

  const handleAdd = () => {
    const s = serial.trim()
    const t = meterType.trim()
    if (!s || !t) return
    onAdd({ serialNumber: s, meterType: t })
    setSerial('')
    setMeterType('')
    serialRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
    if (e.key === 'Escape') onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Add Meter Manually</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Serial Number</label>
            <input
              ref={serialRef}
              autoFocus
              type="text"
              value={serial}
              onChange={e => setSerial(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. SN-20240001"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-shadow"
              style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Meter Type</label>
            <input
              type="text"
              value={meterType}
              onChange={e => setMeterType(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 3-Phase 10A"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-shadow"
              style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Done
          </button>
          <button
            onClick={handleAdd}
            disabled={!serial.trim() || !meterType.trim()}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
            style={{ background: 'var(--color-primary)' }}
          >
            Add Meter
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add Work Orders Modal (#36) — two-tab modal (Manual + Upload) for WS1
// ---------------------------------------------------------------------------

function AddWorkOrdersModal({
  open,
  onAddManual,
  onAddExcel,
  onCancel,
}: {
  open: boolean
  onAddManual: (meter: ParsedMeter) => void
  onAddExcel: (rows: ParsedMeter[]) => void
  onCancel: () => void
}) {
  const [tab, setTab] = useState<'manual' | 'upload'>('manual')

  // Manual tab state
  const [serial, setSerial] = useState('')
  const [meterType, setMeterType] = useState('')
  const serialRef = useRef<HTMLInputElement>(null)

  // Upload tab state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadState, setUploadState] = useState<{
    status: 'idle' | 'parsing' | 'preview' | 'error'
    fileName: string
    rows: ParsedMeter[]
    errorMessage: string
  }>({ status: 'idle', fileName: '', rows: [], errorMessage: '' })

  const handleTabSwitch = (newTab: 'manual' | 'upload') => {
    setTab(newTab)
    // Reset the other tab's state
    if (newTab === 'manual') {
      setUploadState({ status: 'idle', fileName: '', rows: [], errorMessage: '' })
    } else {
      setSerial('')
      setMeterType('')
    }
  }

  const handleManualConfirm = () => {
    const s = serial.trim()
    const t = meterType.trim()
    if (!s || !t) return
    onAddManual({ serialNumber: s, meterType: t })
    setSerial('')
    setMeterType('')
    serialRef.current?.focus()
    onCancel()
  }

  const handleManualKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleManualConfirm()
    if (e.key === 'Escape') onCancel()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setUploadState({ status: 'parsing', fileName: file.name, rows: [], errorMessage: '' })

    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) throw new Error('No sheets found in the file')
      const sheet = workbook.Sheets[sheetName]
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[]

      const rows: ParsedMeter[] = raw.map((row, idx) => {
        const serialNumber =
          String(
            row['Serial Number'] ??
            row['serial_number'] ??
            row['serialNumber'] ??
            row['SN'] ??
            row['serial'] ??
            Object.values(row)[0] ??
            ''
          ).trim() || `ROW-${idx + 1}`
        const meterType =
          String(
            row['Meter Type'] ??
            row['meter_type'] ??
            row['meterType'] ??
            row['Type'] ??
            row['type'] ??
            Object.values(row)[1] ??
            ''
          ).trim() || 'Unknown'
        return { serialNumber, meterType }
      })

      setUploadState(prev => ({ ...prev, status: 'preview', rows }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error parsing file'
      setUploadState(prev => ({ ...prev, status: 'error', errorMessage: msg }))
    }
  }

  const handleUploadConfirm = () => {
    if (uploadState.status !== 'preview') return
    onAddExcel(uploadState.rows)
    setUploadState({ status: 'idle', fileName: '', rows: [], errorMessage: '' })
    onCancel()
  }

  if (!open) return null

  const manualConfirmDisabled = !serial.trim() || !meterType.trim()
  const uploadConfirmDisabled = uploadState.status !== 'preview'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col"
        style={{ background: 'var(--color-card-bg)', maxHeight: '85vh' }}
        role="dialog"
        aria-modal="true"
        aria-label="Add Work Orders"
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: 'var(--color-card-border)' }}
        >
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Add Work Orders
          </h2>
          <button
            onClick={onCancel}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex border-b shrink-0"
          style={{ borderColor: 'var(--color-card-border)' }}
        >
          {(['manual', 'upload'] as const).map(t => (
            <button
              key={t}
              onClick={() => handleTabSwitch(t)}
              className="flex-1 py-3 text-sm font-semibold transition-colors"
              style={
                tab === t
                  ? { color: 'var(--color-primary)', borderBottom: '2px solid var(--color-primary)' }
                  : { color: 'var(--color-text-secondary)', borderBottom: '2px solid transparent' }
              }
            >
              {t === 'manual' ? 'Manual' : 'Upload'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {/* Manual tab */}
          {tab === 'manual' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Serial Number</label>
                <input
                  ref={serialRef}
                  autoFocus
                  type="text"
                  value={serial}
                  onChange={e => setSerial(e.target.value)}
                  onKeyDown={handleManualKeyDown}
                  placeholder="e.g. SN-20240001"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-shadow"
                  style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Meter Type</label>
                <input
                  type="text"
                  value={meterType}
                  onChange={e => setMeterType(e.target.value)}
                  onKeyDown={handleManualKeyDown}
                  placeholder="e.g. 3-Phase 10A"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-shadow"
                  style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
                />
              </div>
            </div>
          )}

          {/* Upload tab */}
          {tab === 'upload' && (
            <div>
              {/* Hidden file input — inside the modal */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
                aria-hidden="true"
              />

              {uploadState.status === 'idle' && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <p className="text-sm text-gray-500">Select an Excel file (.xlsx or .xls) to upload</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                    style={{ background: 'var(--color-primary)' }}
                  >
                    Choose File
                  </button>
                </div>
              )}

              {uploadState.status === 'parsing' && (
                <div className="flex items-center gap-3 py-12 justify-center text-gray-500">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Parsing {uploadState.fileName}...</span>
                </div>
              )}

              {uploadState.status === 'error' && (
                <div className="py-8 text-center">
                  <div className="text-red-500 font-medium mb-2">Failed to parse file</div>
                  <p className="text-sm text-gray-500 mb-4">{uploadState.errorMessage}</p>
                  <button
                    onClick={() => {
                      setUploadState({ status: 'idle', fileName: '', rows: [], errorMessage: '' })
                    }}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Try another file
                  </button>
                </div>
              )}

              {uploadState.status === 'preview' && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">
                      {uploadState.rows.length} meter{uploadState.rows.length !== 1 ? 's' : ''} found in {uploadState.fileName}
                    </span>
                    <button
                      onClick={() => {
                        setUploadState({ status: 'idle', fileName: '', rows: [], errorMessage: '' })
                        fileInputRef.current?.click()
                      }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Change file
                    </button>
                  </div>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-3 py-2 font-semibold text-gray-600 border border-gray-200">#</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600 border border-gray-200">Serial Number</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600 border border-gray-200">Meter Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadState.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2 border border-gray-200 text-gray-400">{idx + 1}</td>
                          <td className="px-3 py-2 border border-gray-200 font-mono text-gray-800">{row.serialNumber}</td>
                          <td className="px-3 py-2 border border-gray-200 text-gray-700">{row.meterType}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex justify-end gap-3 shrink-0"
          style={{ borderColor: 'var(--color-card-border)' }}
        >
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors"
            style={{
              borderColor: 'var(--color-card-border)',
              color: 'var(--color-text-primary)',
              background: 'transparent',
            }}
          >
            Cancel
          </button>
          {tab === 'manual' ? (
            <button
              onClick={handleManualConfirm}
              disabled={manualConfirmDisabled}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
              style={{ background: 'var(--color-primary)' }}
            >
              Add Meter
            </button>
          ) : (
            <button
              onClick={handleUploadConfirm}
              disabled={uploadConfirmDisabled}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
              style={{ background: 'var(--color-primary)' }}
            >
              {uploadState.status === 'preview'
                ? `Add ${uploadState.rows.length} meter${uploadState.rows.length !== 1 ? 's' : ''} to Queue`
                : 'Add to Queue'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Station Card — updated props per spec
// ---------------------------------------------------------------------------

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function StationCard({
  stage,
  total,
  reworkCount,
  savedOperator,
  draftOperator,
  saveStatus,
  conflictStation,
  onOperatorDraft,
  onSaveOperator,
  operatorOptions,
  dateRange,
  onDateRangeChange,
  machineStatus,
  pendingMeters,
  onAddWorkOrders,
  onQueueBadgeClick,
  onReworkBadgeClick,
}: {
  stage: (typeof STAGES)[number]
  total: number
  reworkCount: number
  savedOperator: string
  draftOperator: string | undefined
  saveStatus: SaveStatus
  conflictStation: string | null   // name of station the selected operator is already at
  onOperatorDraft: (stageId: string, op: string) => void
  onSaveOperator: (stageId: string) => void
  operatorOptions: OperatorOption[]
  dateRange: DateRange | null
  onDateRangeChange: (stationId: string, range: DateRange) => void
  machineStatus: MachineStatus | null
  pendingMeters: ParsedMeter[]
  onAddWorkOrders: () => void
  onQueueBadgeClick: () => void
  onReworkBadgeClick: () => void
}) {
  const isStation1 = stage.stageId === 'stage_01'

  // Effective operator shown in dropdown
  const effectiveOperator = draftOperator ?? savedOperator ?? UNASSIGNED_VALUE

  const accentColor =
    machineStatus === 'green'  ? '#22c55e' :
    machineStatus === 'yellow' ? '#eab308' :
    machineStatus === 'red'    ? '#ef4444' :
    'var(--color-card-border)'

  // Save button label
  const saveLabel =
    saveStatus === 'saving' ? 'Saving…' :
    saveStatus === 'saved'  ? 'Saved ✓' :
    saveStatus === 'error'  ? 'Error — retry' :
    'Save Info'

  // Disable save button when no draft or draft equals saved
  const saveDisabled =
    saveStatus === 'saving' ||
    draftOperator === undefined ||
    draftOperator === savedOperator

  return (
    <div
      className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col"
      style={{ borderLeft: `4px solid ${accentColor}` }}
    >
      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Header row — #38: replace static badge with clickable pills */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-800 leading-snug">{stationLabel(stage.stageId)}</h3>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {total === 0 && reworkCount === 0 ? (
              <span className="text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap bg-gray-100 text-gray-400 cursor-default">
                No Queue
              </span>
            ) : (
              <>
                {total > 0 && (
                  <button
                    onClick={onQueueBadgeClick}
                    className="text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                  >
                    {total} queued
                  </button>
                )}
                {reworkCount > 0 && (
                  <button
                    onClick={onReworkBadgeClick}
                    className="text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors"
                  >
                    {reworkCount} rework
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Queue count */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-3xl font-bold text-gray-900">{total}</span>
          <span className="text-sm text-gray-500">meter{total !== 1 ? 's' : ''} queued</span>
        </div>

        {/* Operator dropdown + Save Info button (#35) */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Operator</label>
          <select
            value={effectiveOperator}
            onChange={e => onOperatorDraft(stage.stageId, e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 transition-shadow"
            style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
          >
            {operatorOptions.map(op => (
              <option key={op.id} value={op.id}>
                {op.label}
              </option>
            ))}
          </select>

          {/* Conflict warning — operator already assigned elsewhere */}
          {conflictStation && (
            <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 leading-snug">
              ⚠️ Already at <span className="font-semibold">{conflictStation}</span>. Saving will move them here.
            </p>
          )}

          {/* Save Info button */}
          <button
            onClick={() => onSaveOperator(stage.stageId)}
            disabled={saveDisabled}
            className="mt-2 w-full text-sm font-semibold rounded-lg px-3 py-2 transition-all border disabled:cursor-not-allowed"
            style={
              saveStatus === 'saved'
                ? { background: '#dcfce7', color: '#166534', borderColor: '#86efac' }
                : saveStatus === 'error'
                ? { background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }
                : saveDisabled
                ? { background: 'transparent', color: '#9ca3af', borderColor: '#e5e7eb' }
                : { background: 'var(--color-primary)', color: '#ffffff', borderColor: 'var(--color-primary)' }
            }
          >
            {saveLabel}
          </button>
        </div>

        {/* Date range selector — shown when an operator is assigned */}
        {effectiveOperator !== UNASSIGNED_VALUE && (
          <DateRangeSelector
            stationId={stage.stationId}
            value={dateRange}
            onChange={onDateRangeChange}
          />
        )}

        {/* Machine status — read-only, operator sets from their station */}
        <MachineStatusDisplay
          stationId={stage.stationId}
          status={machineStatus}
        />

        {/* Station 1 extra actions — #36: single Add Work Orders button */}
        {isStation1 && (
          <div className="flex flex-col gap-2">
            <button
              onClick={onAddWorkOrders}
              className="w-full text-sm font-medium border border-gray-300 text-gray-700 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Add Work Orders
            </button>

            {pendingMeters.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs font-semibold text-blue-700 mb-2">
                  {pendingMeters.length} meter{pendingMeters.length !== 1 ? 's' : ''} pending queue
                </p>
                <ul className="space-y-1 max-h-28 overflow-y-auto">
                  {pendingMeters.map((m, i) => (
                    <li key={i} className="text-xs text-blue-800 font-mono flex gap-2">
                      <span>{m.serialNumber}</span>
                      <span className="text-blue-500">{m.meterType}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function WorkstationsPage() {
  const { role } = useAuth()

  // Guard — admin/supervisor only
  if (role && role !== 'admin' && role !== 'supervisor') {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-500">This page is only available to admins and supervisors.</p>
        </div>
      </div>
    )
  }

  return <WorkstationsPageInner />
}

function WorkstationsPageInner() {
  const { counts } = useStationCounts()
  const { operatorOptions } = useOperatorOptions()
  const { users } = useUsers()
  const { statuses: machineStatuses } = useMachineStatuses(STAGES.map(s => s.stationId))
  const today = new Date()

  // #34 — derive saved operators from Firestore users data
  const savedOperators = useMemo(() => {
    const map: Record<string, string> = Object.fromEntries(STAGES.map(s => [s.stageId, UNASSIGNED_VALUE]))
    users.forEach(user => {
      ;(user.workstationIds ?? []).forEach(stationId => {
        const stageId = stationId.replace('ws_', 'stage_')
        if (stageId in map) map[stageId] = user.uid
      })
    })
    return map
  }, [users])

  // #35 — draft operators (unsaved selections)
  const [draftOperators, setDraftOperators] = useState<Record<string, string>>({})

  // #35 — save statuses per stage
  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>({})

  // Date range per station (keyed by stationId), loaded from localStorage on mount
  const [dateRanges, setDateRanges] = useState<Record<string, DateRange | null>>(() =>
    Object.fromEntries(STAGES.map(s => [s.stationId, loadDateRange(s.stationId)]))
  )

  // Station 1 pending meters
  const [pendingMeters, setPendingMeters] = useState<ParsedMeter[]>([])

  // Add Work Orders modal (#36)
  const [addWorkOrdersOpen, setAddWorkOrdersOpen] = useState(false)

  // Queue / Rework order modals
  const [orderModal, setOrderModal] = useState<{
    open: boolean
    kind: 'queue' | 'rework'
    stageId: string
    orders: OrderItem[]
  }>({ open: false, kind: 'queue', stageId: '', orders: [] })

  const openQueueModal = useCallback((stageId: string, total: number) => {
    setOrderModal({
      open: true,
      kind: 'queue',
      stageId,
      orders: makeMockOrders(stageId, total, 'ORD'),
    })
  }, [])

  const openReworkModal = useCallback((stageId: string, reworkCount: number) => {
    setOrderModal({
      open: true,
      kind: 'rework',
      stageId,
      orders: makeMockOrders(stageId, reworkCount, 'RWK'),
    })
  }, [])

  const closeOrderModal = useCallback(() => {
    setOrderModal(prev => ({ ...prev, open: false }))
  }, [])

  // #35 — draft handler (no Firestore write)
  const handleOperatorDraft = useCallback((stageId: string, op: string) => {
    setDraftOperators(prev => ({ ...prev, [stageId]: op }))
  }, [])

  // #35 — save handler (writes to Firestore, clears draft on success)
  // Enforces 1-operator-per-station invariant:
  //   1. Remove this station from the previous operator
  //   2. Remove ALL stations from the new operator (they can only be at one station)
  //   3. Assign new operator to this station
  const handleSaveOperator = useCallback(async (stageId: string) => {
    const stationId = stageId.replace('stage_', 'ws_')
    const prevOp = savedOperators[stageId] ?? UNASSIGNED_VALUE
    const newOp = draftOperators[stageId] ?? UNASSIGNED_VALUE

    setSaveStatuses(prev => ({ ...prev, [stageId]: 'saving' }))

    try {
      const batch = writeBatch(db)

      // Step 1: Remove this station from the previous operator
      if (prevOp && prevOp !== UNASSIGNED_VALUE && prevOp !== newOp) {
        batch.update(doc(db, 'users', prevOp), { workstationIds: arrayRemove(stationId) })
      }

      // Step 2 & 3: Assign new operator — wipe all their existing stations, add only this one
      // This enforces the invariant: one operator can only be at one station at a time
      if (newOp && newOp !== UNASSIGNED_VALUE) {
        batch.update(doc(db, 'users', newOp), { workstationIds: [stationId] })
      } else if (newOp === UNASSIGNED_VALUE && prevOp && prevOp !== UNASSIGNED_VALUE) {
        // Unassigning: already handled in Step 1; nothing more to do for newOp
      }

      await batch.commit()

      // Clear draft on success
      setDraftOperators(prev => {
        const next = { ...prev }
        delete next[stageId]
        return next
      })
      setSaveStatuses(prev => ({ ...prev, [stageId]: 'saved' }))

      // Reset to idle after 2s
      setTimeout(() => {
        setSaveStatuses(prev => ({ ...prev, [stageId]: 'idle' }))
      }, 2000)
    } catch (e) {
      console.error('Failed to save operator assignment', e)
      setSaveStatuses(prev => ({ ...prev, [stageId]: 'error' }))
    }
  }, [savedOperators, draftOperators])

  // Returns the station name the drafted operator is already assigned to (if any)
  const getConflictStation = useCallback((stageId: string): string | null => {
    const draftOp = draftOperators[stageId]
    if (!draftOp || draftOp === UNASSIGNED_VALUE) return null
    if (draftOp === savedOperators[stageId]) return null // same station — no conflict
    const user = users.find(u => u.uid === draftOp)
    const existingStationId = (user?.workstationIds ?? [])[0]
    if (!existingStationId) return null
    const existingStage = STAGES.find(s => s.stationId === existingStationId)
    return existingStage ? existingStage.name : existingStationId
  }, [draftOperators, savedOperators, users])

  const handleDateRangeChange = useCallback((stationId: string, range: DateRange) => {
    saveDateRange(stationId, range)
    setDateRanges(prev => ({ ...prev, [stationId]: range }))
  }, [])

  const handleAddManual = (meter: ParsedMeter) => {
    setPendingMeters(prev => [...prev, meter])
  }

  const handleAddExcel = (rows: ParsedMeter[]) => {
    setPendingMeters(prev => [...prev, ...rows])
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-content-bg)' }}>
      {/* Page header */}
      <div
        className="sticky top-0 z-30 px-6 py-4 border-b"
        style={{ background: 'var(--color-card-bg)', borderColor: 'var(--color-card-border)' }}
      >
        <h1 className="text-xl font-bold text-gray-900">Workstations</h1>
        <p className="text-sm text-gray-500 mt-0.5">{formatDate(today)}</p>
      </div>

      {/* Station grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {STAGES.map(stage => {
            const count = counts[stage.stageId] ?? { total: 0, reworkCount: 0 }
            return (
              <StationCard
                key={stage.stageId}
                stage={stage}
                total={count.total}
                reworkCount={count.reworkCount}
                savedOperator={savedOperators[stage.stageId] ?? UNASSIGNED_VALUE}
                draftOperator={draftOperators[stage.stageId]}
                saveStatus={saveStatuses[stage.stageId] ?? 'idle'}
                conflictStation={getConflictStation(stage.stageId)}
                onOperatorDraft={handleOperatorDraft}
                onSaveOperator={handleSaveOperator}
                operatorOptions={operatorOptions}
                dateRange={dateRanges[stage.stationId] ?? null}
                onDateRangeChange={handleDateRangeChange}
                machineStatus={machineStatuses[stage.stationId] ?? null}
                pendingMeters={stage.stageId === 'stage_01' ? pendingMeters : []}
                onAddWorkOrders={() => setAddWorkOrdersOpen(true)}
                onQueueBadgeClick={() => openQueueModal(stage.stageId, count.total)}
                onReworkBadgeClick={() => openReworkModal(stage.stageId, count.reworkCount)}
              />
            )
          })}
        </div>
      </div>

      {/* Modals */}
      <AddWorkOrdersModal
        open={addWorkOrdersOpen}
        onAddManual={handleAddManual}
        onAddExcel={handleAddExcel}
        onCancel={() => setAddWorkOrdersOpen(false)}
      />

      <OrderListModal
        open={orderModal.open}
        title={orderModal.kind === 'queue' ? 'Queued Orders' : 'Rework Orders'}
        stationName={orderModal.stageId ? stationLabel(orderModal.stageId) : ''}
        orders={orderModal.orders}
        onClose={closeOrderModal}
      />
    </div>
  )
}
