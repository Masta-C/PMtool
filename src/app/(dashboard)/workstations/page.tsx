'use client'

import { useState, useRef, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import { stationLabel } from '@/lib/stages'

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
    // If the stored date doesn't match today, treat as unset
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCardAccent(total: number, reworkCount: number): {
  borderClass: string
  badgeClass: string
  statusLabel: string
} {
  if (total === 0) {
    return { borderClass: 'border-l-4 border-red-500', badgeClass: 'bg-red-100 text-red-700', statusLabel: 'No queue' }
  }
  if (reworkCount > 0) {
    return { borderClass: 'border-l-4 border-yellow-400', badgeClass: 'bg-yellow-100 text-yellow-700', statusLabel: 'Has rework' }
  }
  return { borderClass: 'border-l-4 border-green-500', badgeClass: 'bg-green-100 text-green-700', statusLabel: 'Queued' }
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
// Station Card
// ---------------------------------------------------------------------------

function StationCard({
  stage,
  total,
  reworkCount,
  operator,
  onOperatorChange,
  operatorOptions,
  dateRange,
  onDateRangeChange,
  pendingMeters,
  onExcelUpload,
  onManualAdd,
}: {
  stage: (typeof STAGES)[number]
  total: number
  reworkCount: number
  operator: string
  onOperatorChange: (stageId: string, op: string) => void
  operatorOptions: OperatorOption[]
  dateRange: DateRange | null
  onDateRangeChange: (stationId: string, range: DateRange) => void
  pendingMeters: ParsedMeter[]
  onExcelUpload: () => void
  onManualAdd: () => void
}) {
  const { borderClass, badgeClass, statusLabel } = getCardAccent(total, reworkCount)
  const isStation1 = stage.stageId === 'stage_01'

  return (
    <div
      className={`bg-white rounded-xl shadow-sm ${borderClass} overflow-hidden flex flex-col`}
      style={{ borderColor: undefined }}
    >
      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 leading-snug">{stationLabel(stage.stageId)}</h3>
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${badgeClass}`}>
            {statusLabel}
          </span>
        </div>

        {/* Queue count */}
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900">{total}</span>
          <span className="text-sm text-gray-500">meter{total !== 1 ? 's' : ''} queued</span>
          {reworkCount > 0 && (
            <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full ml-auto">
              {reworkCount} rework
            </span>
          )}
        </div>

        {/* Operator dropdown */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Operator</label>
          <select
            value={operator}
            onChange={e => onOperatorChange(stage.stageId, e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 transition-shadow"
            style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
          >
            {operatorOptions.map(op => (
              <option key={op.id} value={op.id}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date range selector — shown when an operator is assigned */}
        {operator !== UNASSIGNED_VALUE && (
          <DateRangeSelector
            stationId={stage.stationId}
            value={dateRange}
            onChange={onDateRangeChange}
          />
        )}

        {/* Station 1 extra actions */}
        {isStation1 && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={onExcelUpload}
                className="flex-1 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload Excel
              </button>
              <button
                onClick={onManualAdd}
                className="flex-1 text-sm font-medium text-white rounded-lg px-3 py-2 hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                style={{ background: 'var(--color-primary)' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add +
              </button>
            </div>

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
  const today = new Date()

  // Date range per station (keyed by stationId), loaded from localStorage on mount
  const [dateRanges, setDateRanges] = useState<Record<string, DateRange | null>>(() =>
    Object.fromEntries(STAGES.map(s => [s.stationId, loadDateRange(s.stationId)]))
  )

  // Operator assignments — stores operator uid ('' = Unassigned)
  const [operators, setOperators] = useState<Record<string, string>>(() =>
    Object.fromEntries(STAGES.map(s => [s.stageId, UNASSIGNED_VALUE]))
  )

  // Station 1 pending meters (queued locally, will go to Firestore once data layer merges)
  const [pendingMeters, setPendingMeters] = useState<ParsedMeter[]>([])

  // Excel modal
  const [excelModal, setExcelModal] = useState<ExcelModalState>({
    open: false,
    fileName: '',
    status: 'parsing',
    rows: [],
    errorMessage: '',
  })

  // Manual add panel
  const [manualOpen, setManualOpen] = useState(false)

  // Hidden file input ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleOperatorChange = useCallback((stageId: string, op: string) => {
    setOperators(prev => ({ ...prev, [stageId]: op }))
  }, [])

  const handleDateRangeChange = useCallback((stationId: string, range: DateRange) => {
    saveDateRange(stationId, range)
    setDateRanges(prev => ({ ...prev, [stationId]: range }))
  }, [])

  const handleExcelUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input so same file can be re-uploaded
    e.target.value = ''

    setExcelModal({ open: true, fileName: file.name, status: 'parsing', rows: [], errorMessage: '' })

    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) throw new Error('No sheets found in the file')
      const sheet = workbook.Sheets[sheetName]
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[]

      const rows: ParsedMeter[] = raw.map((row, idx) => {
        // Accept flexible column names: serial_number, Serial Number, serialNumber, SN, etc.
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

      setExcelModal(prev => ({ ...prev, status: 'preview', rows }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error parsing file'
      setExcelModal(prev => ({ ...prev, status: 'error', errorMessage: msg }))
    }
  }

  const handleExcelConfirm = (rows: ParsedMeter[]) => {
    setPendingMeters(prev => [...prev, ...rows])
    setExcelModal({ open: false, fileName: '', status: 'parsing', rows: [], errorMessage: '' })
  }

  const handleExcelCancel = () => {
    setExcelModal({ open: false, fileName: '', status: 'parsing', rows: [], errorMessage: '' })
  }

  const handleManualAdd = (meter: ParsedMeter) => {
    setPendingMeters(prev => [...prev, meter])
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-content-bg)' }}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
      />

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
                operator={operators[stage.stageId] ?? UNASSIGNED_VALUE}
                onOperatorChange={handleOperatorChange}
                operatorOptions={operatorOptions}
                dateRange={dateRanges[stage.stationId] ?? null}
                onDateRangeChange={handleDateRangeChange}
                pendingMeters={stage.stageId === 'stage_01' ? pendingMeters : []}
                onExcelUpload={handleExcelUploadClick}
                onManualAdd={() => setManualOpen(true)}
              />
            )
          })}
        </div>
      </div>

      {/* Modals */}
      <ExcelModal
        state={excelModal}
        onConfirm={handleExcelConfirm}
        onCancel={handleExcelCancel}
      />

      <ManualAddPanel
        open={manualOpen}
        onAdd={handleManualAdd}
        onClose={() => setManualOpen(false)}
      />

    </div>
  )
}
