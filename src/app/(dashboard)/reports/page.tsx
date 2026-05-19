'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import type { Role } from '@/types/user'
import { STAGES, stationLabel } from '@/lib/stages'

// ---------------------------------------------------------------------------
// Access control
// ---------------------------------------------------------------------------

const ALLOWED_ROLES: Role[] = ['qa', 'admin', 'supervisor']

// ---------------------------------------------------------------------------
// Mock data — Production runs
// TODO: Replace with Firestore query: collection('productionRuns') filtered by
//       workOrderId, stageId, operatorId, date range, result, reworkStatus
// ---------------------------------------------------------------------------

const MOCK_OPERATORS = [
  { id: 'OP-001', name: 'Anita Sharma' },
  { id: 'OP-002', name: 'Ravi Kumar' },
  { id: 'OP-003', name: 'Priya Nair' },
  { id: 'OP-004', name: 'Suresh Mehta' },
]

const MOCK_PRODUCTION_RUNS = [
  { id: 'pr1',  orderNum: 'WO-2026-00001', stageId: 'stage_01', operatorId: 'OP-001', date: new Date(Date.now() - 1800000).toISOString(),   result: 'Pass' as const, reworkStatus: null },
  { id: 'pr2',  orderNum: 'WO-2026-00002', stageId: 'stage_05', operatorId: 'OP-003', date: new Date(Date.now() - 3600000).toISOString(),   result: 'Fail' as const, reworkStatus: 'Pending' as const },
  { id: 'pr3',  orderNum: 'WO-2026-00003', stageId: 'stage_01', operatorId: 'OP-001', date: new Date(Date.now() - 7200000).toISOString(),   result: 'Pass' as const, reworkStatus: null },
  { id: 'pr4',  orderNum: 'WO-2026-00004', stageId: 'stage_08', operatorId: 'OP-002', date: new Date(Date.now() - 10800000).toISOString(),  result: 'Pass' as const, reworkStatus: null },
  { id: 'pr5',  orderNum: 'WO-2026-00005', stageId: 'stage_03', operatorId: 'OP-001', date: new Date(Date.now() - 14400000).toISOString(),  result: 'Fail' as const, reworkStatus: 'Resolved' as const },
  { id: 'pr6',  orderNum: 'WO-2026-00006', stageId: 'stage_09', operatorId: 'OP-004', date: new Date(Date.now() - 86400000).toISOString(),  result: 'Pass' as const, reworkStatus: null },
  { id: 'pr7',  orderNum: 'WO-2026-00007', stageId: 'stage_11', operatorId: 'OP-002', date: new Date(Date.now() - 172800000).toISOString(), result: 'Fail' as const, reworkStatus: 'Pending' as const },
  { id: 'pr8',  orderNum: 'WO-2026-00008', stageId: 'stage_09', operatorId: 'OP-002', date: new Date(Date.now() - 259200000).toISOString(), result: 'Fail' as const, reworkStatus: 'Resolved' as const },
  { id: 'pr9',  orderNum: 'WO-2026-00009', stageId: 'stage_04', operatorId: 'OP-003', date: new Date(Date.now() - 345600000).toISOString(), result: 'Pass' as const, reworkStatus: null },
  { id: 'pr10', orderNum: 'WO-2026-00010', stageId: 'stage_07', operatorId: 'OP-001', date: new Date(Date.now() - 432000000).toISOString(), result: 'Pass' as const, reworkStatus: null },
]

// Mock data — Rework items
// TODO: Replace with Firestore query: collection('reworkItems') where status != 'Resolved'
const MOCK_REWORK_ITEMS = [
  { id: 'rw1', orderNum: 'WO-2026-00002', stageId: 'stage_05', operatorId: 'OP-003', dateTagged: new Date(Date.now() - 3600000).toISOString(),   status: 'Pending' as const },
  { id: 'rw2', orderNum: 'WO-2026-00007', stageId: 'stage_11', operatorId: 'OP-002', dateTagged: new Date(Date.now() - 172800000).toISOString(), status: 'In Correction' as const },
]

// ---------------------------------------------------------------------------
// Mock QA data — Failure history & Tamper Test
// ---------------------------------------------------------------------------

const MOCK_FAILURES = [
  { id: 'f1', date: new Date(Date.now() - 3600000).toISOString(),   serialNumber: 'WO-2026-00002', meterType: 'EM-400', stage: 'Functional Testing',          stageId: 'stage_05', parameter: 'Relay Functional Testing', value: '0.23V',    result: 'NOT OK', taggedTo: 'Base Assembly',                operatorId: 'OP-003' },
  { id: 'f2', date: new Date(Date.now() - 7200000).toISOString(),   serialNumber: 'WO-2026-00005', meterType: 'EM-500', stage: 'PCBA Incoming / Store',        stageId: 'stage_03', parameter: 'Power Supply Test',        value: 'Irregular', result: 'NOT OK', taggedTo: 'PCBA Incoming / Store',         operatorId: 'OP-001' },
  { id: 'f3', date: new Date(Date.now() - 10800000).toISOString(),  serialNumber: 'WO-2026-00008', meterType: 'EM-400', stage: 'HV-IR Test',                  stageId: 'stage_09', parameter: 'AC High Voltage Test',     value: '4.1kV',    result: 'NOT OK', taggedTo: 'Base Assembly',                operatorId: 'OP-002' },
  { id: 'f4', date: new Date(Date.now() - 14400000).toISOString(),  serialNumber: 'WO-2026-00011', meterType: 'EM-400', stage: 'Final Testing',               stageId: 'stage_11', parameter: 'Limits of Error Test',     value: '±2.8%',    result: 'REMARK', taggedTo: null,                           operatorId: 'OP-004' },
  { id: 'f5', date: new Date(Date.now() - 18000000).toISOString(),  serialNumber: 'WO-2026-00003', meterType: 'EM-500', stage: 'Incoming Inspection / Stores', stageId: 'stage_01', parameter: 'Battery',                  value: '3.1V',     result: 'NOT OK', taggedTo: 'Incoming Inspection / Stores', operatorId: 'OP-001' },
]

const MOCK_TAMPER_SAMPLES = [
  { id: 't1', date: new Date(Date.now() - 5400000).toISOString(),    serialNumber: 'WO-2026-00004', meterType: 'EM-400', tamper38: { value: 'Pass', result: 'OK'     }, magneticTamper: { value: 'Pass', result: 'OK'     }, esd35kv: { value: 'Pass', result: 'OK' }, overall: 'PASSED', operatorId: 'OP-002' },
  { id: 't2', date: new Date(Date.now() - 86400000).toISOString(),   serialNumber: 'WO-2026-00009', meterType: 'EM-500', tamper38: { value: 'Pass', result: 'OK'     }, magneticTamper: { value: 'Fail', result: 'NOT OK' }, esd35kv: { value: 'Pass', result: 'OK' }, overall: 'FAILED', operatorId: 'OP-003' },
  { id: 't3', date: new Date(Date.now() - 172800000).toISOString(),  serialNumber: 'WO-2026-00015', meterType: 'EM-400', tamper38: { value: 'Pass', result: 'OK'     }, magneticTamper: { value: 'Pass', result: 'OK'     }, esd35kv: { value: 'Pass', result: 'OK' }, overall: 'PASSED', operatorId: 'OP-001' },
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MainTab = 'production' | 'rework' | 'qa'
type QaTab = 'failures' | 'tamper'
type SortDir = 'asc' | 'desc'
type FailureResultFilter = 'all' | 'NOT OK' | 'REMARK'
type TamperOverallFilter = 'all' | 'PASSED' | 'FAILED'
type ProductionResultFilter = 'all' | 'Pass' | 'Fail'
type ReworkStatusFilter = 'all' | 'Pending' | 'Resolved'

interface ProductionFilters {
  station: string
  dateFrom: string
  dateTo: string
  operator: string
  result: ProductionResultFilter
  reworkResult: ReworkStatusFilter
}

interface FailureFilters {
  dateFrom: string
  dateTo: string
  stage: string
  result: FailureResultFilter
  meterType: string
}

interface TamperFilters {
  dateFrom: string
  dateTo: string
  overall: TamperOverallFilter
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_STAGE_IDS_QA = Array.from(new Set(MOCK_FAILURES.map(f => f.stageId)))
const ALL_METER_TYPES = Array.from(new Set(MOCK_FAILURES.map(f => f.meterType).concat(MOCK_TAMPER_SAMPLES.map(t => t.meterType))))

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function isToday(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
}

function inDateRange(iso: string, from: string, to: string): boolean {
  if (!from && !to) return true
  const d = new Date(iso).getTime()
  if (from && d < new Date(from).setHours(0, 0, 0, 0)) return false
  if (to   && d > new Date(to).setHours(23, 59, 59, 999)) return false
  return true
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v ?? ''}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function operatorName(id: string): string {
  return MOCK_OPERATORS.find(o => o.id === id)?.name ?? id
}

// ---------------------------------------------------------------------------
// Shared UI components
// ---------------------------------------------------------------------------

function ResultBadge({ result }: { result: string }) {
  const styles: Record<string, string> = {
    'NOT OK':        'bg-red-100 text-red-700 border border-red-200',
    'REMARK':        'bg-amber-100 text-amber-700 border border-amber-200',
    'OK':            'bg-green-100 text-green-700 border border-green-200',
    'PASSED':        'bg-green-100 text-green-700 border border-green-200',
    'FAILED':        'bg-red-100 text-red-700 border border-red-200',
    'Pass':          'bg-green-100 text-green-700 border border-green-200',
    'Fail':          'bg-red-100 text-red-700 border border-red-200',
    'Pending':       'bg-amber-100 text-amber-700 border border-amber-200',
    'Resolved':      'bg-green-100 text-green-700 border border-green-200',
    'In Correction': 'bg-blue-100 text-blue-700 border border-blue-200',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${styles[result] ?? 'bg-gray-100 text-gray-600'}`}>
      {result}
    </span>
  )
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

const INPUT_CLS = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white'

function SortIcon({ dir }: { dir: SortDir }) {
  return (
    <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      {dir === 'desc'
        ? <path d="M8 12L3 6h10l-5 6z" />
        : <path d="M8 4l5 6H3L8 4z" />
      }
    </svg>
  )
}

function TableFooter({ count, noun }: { count: number; noun: string }) {
  if (count === 0) return null
  return (
    <div className="px-4 py-2 text-xs text-gray-400 border-t" style={{ borderColor: 'var(--color-card-border)' }}>
      Showing {count} {count === 1 ? noun : `${noun}s`}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Production tab
// ---------------------------------------------------------------------------

function ProductionTab() {
  const [filters, setFilters] = useState<ProductionFilters>({
    station: 'all',
    dateFrom: '',
    dateTo: '',
    operator: 'all',
    result: 'all',
    reworkResult: 'all',
  })
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function updateFilter<K extends keyof ProductionFilters>(key: K, val: ProductionFilters[K]) {
    setFilters(prev => ({ ...prev, [key]: val }))
  }

  const filtered = useMemo(() => {
    let rows = MOCK_PRODUCTION_RUNS.filter(r => {
      if (filters.station !== 'all' && r.stageId !== filters.station) return false
      if (!inDateRange(r.date, filters.dateFrom, filters.dateTo)) return false
      if (filters.operator !== 'all' && r.operatorId !== filters.operator) return false
      if (filters.result !== 'all' && r.result !== filters.result) return false
      if (filters.reworkResult !== 'all') {
        if (filters.reworkResult === 'Pending' && r.reworkStatus !== 'Pending') return false
        if (filters.reworkResult === 'Resolved' && r.reworkStatus !== 'Resolved') return false
      }
      return true
    })
    rows = [...rows].sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime()
      return sortDir === 'desc' ? -diff : diff
    })
    return rows
  }, [filters, sortDir])

  function handleExport() {
    const headers = ['Order #', 'Station', 'Operator', 'Date', 'Result', 'Rework Status']
    const rows = filtered.map(r => [
      r.orderNum,
      stationLabel(r.stageId),
      operatorName(r.operatorId),
      formatDateTime(r.date),
      r.result,
      r.reworkStatus ?? '—',
    ])
    downloadCsv(`pmtool-production-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      <div
        className="rounded-xl p-4 flex flex-wrap gap-3 items-end"
        style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
      >
        <FilterField label="Station">
          <select value={filters.station} onChange={e => updateFilter('station', e.target.value)} className={INPUT_CLS}>
            <option value="all">All stations</option>
            {STAGES.map(s => (
              <option key={s.stageId} value={s.stageId}>{stationLabel(s.stageId)}</option>
            ))}
          </select>
        </FilterField>

        <FilterField label="From">
          <input type="date" value={filters.dateFrom} onChange={e => updateFilter('dateFrom', e.target.value)} className={INPUT_CLS} />
        </FilterField>

        <FilterField label="To">
          <input type="date" value={filters.dateTo} onChange={e => updateFilter('dateTo', e.target.value)} className={INPUT_CLS} />
        </FilterField>

        <FilterField label="Operator">
          <select value={filters.operator} onChange={e => updateFilter('operator', e.target.value)} className={INPUT_CLS}>
            <option value="all">All operators</option>
            {MOCK_OPERATORS.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Result">
          <select value={filters.result} onChange={e => updateFilter('result', e.target.value as ProductionResultFilter)} className={INPUT_CLS}>
            <option value="all">All</option>
            <option value="Pass">Pass</option>
            <option value="Fail">Fail</option>
          </select>
        </FilterField>

        <FilterField label="Rework result">
          <select value={filters.reworkResult} onChange={e => updateFilter('reworkResult', e.target.value as ReworkStatusFilter)} className={INPUT_CLS}>
            <option value="all">All</option>
            <option value="Pending">Pending</option>
            <option value="Resolved">Resolved</option>
          </select>
        </FilterField>

        <div className="ml-auto self-end">
          <button
            onClick={handleExport}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: 'var(--color-primary)' }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl shadow-sm overflow-hidden"
        style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f8f9fc', borderBottom: '1px solid var(--color-card-border)' }}>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Order #</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Station</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Operator</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                  <button
                    className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                    onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                  >
                    Date <SortIcon dir={sortDir} />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Result</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Rework Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400 text-sm">
                    No production runs match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`border-t transition-colors ${r.result === 'Fail' ? 'bg-red-50 hover:bg-red-100' : i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-100/50'}`}
                    style={{ borderColor: 'var(--color-card-border)' }}
                  >
                    <td className="px-4 py-3 font-mono text-gray-800 whitespace-nowrap">{r.orderNum}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{stationLabel(r.stageId)}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{operatorName(r.operatorId)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDateTime(r.date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><ResultBadge result={r.result} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.reworkStatus
                        ? <ResultBadge result={r.reworkStatus} />
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TableFooter count={filtered.length} noun="record" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rework tab
// ---------------------------------------------------------------------------

function ReworkTab() {
  // TODO: Replace with Firestore query: collection('reworkItems') where
  //       status in ['Pending', 'In Correction'] (not yet re-submitted and passed)
  const rows = MOCK_REWORK_ITEMS

  return (
    <div className="flex flex-col gap-5">
      {/* Info banner */}
      <div
        className="rounded-xl px-4 py-3 flex items-start gap-3 text-sm"
        style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
      >
        <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-warning, #f59e0b)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-gray-600">
          <span className="font-semibold text-gray-800">Note:</span> Rework items count as failures permanently, even when resolved. These are items still open — not yet re-submitted and passed.
        </p>
      </div>

      {/* Table */}
      <div
        className="rounded-xl shadow-sm overflow-hidden"
        style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f8f9fc', borderBottom: '1px solid var(--color-card-border)' }}>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Order #</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Tagged Station</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Operator</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Date Tagged</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400 text-sm">
                    No open rework items.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`border-t transition-colors ${i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-100/50'}`}
                    style={{ borderColor: 'var(--color-card-border)' }}
                  >
                    <td className="px-4 py-3 font-mono text-gray-800 whitespace-nowrap">{r.orderNum}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{stationLabel(r.stageId)}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{operatorName(r.operatorId)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDateTime(r.dateTagged)}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><ResultBadge result={r.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TableFooter count={rows.length} noun="item" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// QA tab — Failure History sub-tab
// ---------------------------------------------------------------------------

function QaSummaryPanel() {
  const todayFailures = MOCK_FAILURES.filter(f => isToday(f.date))

  const stageCounts: Record<string, number> = {}
  const paramCounts: Record<string, number> = {}
  MOCK_FAILURES.forEach(f => {
    stageCounts[f.stageId] = (stageCounts[f.stageId] ?? 0) + 1
    paramCounts[f.parameter] = (paramCounts[f.parameter] ?? 0) + 1
  })
  const topStageId = Object.entries(stageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  const topStage = topStageId ? stationLabel(topStageId) : '—'
  const topParam = Object.entries(paramCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <SummaryCard label="Total failures today" value={String(todayFailures.length)} color="var(--color-danger)" />
      <SummaryCard label="Most common failure stage" value={topStage} color="var(--color-warning)" small />
      <SummaryCard label="Most common failed parameter" value={topParam} color="var(--color-primary)" small />
    </div>
  )
}

function SummaryCard({ label, value, color, small }: { label: string; value: string; color: string; small?: boolean }) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1 shadow-sm"
      style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
    >
      <div className="w-1 h-6 rounded-full self-start" style={{ background: color }} />
      <span
        className={`font-bold leading-tight ${small ? 'text-base' : 'text-2xl'}`}
        style={{ color }}
        title={value}
      >
        {value}
      </span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  )
}

function FailureHistoryTab() {
  const [filters, setFilters] = useState<FailureFilters>({
    dateFrom: '',
    dateTo: '',
    stage: 'all',
    result: 'all',
    meterType: 'all',
  })
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function updateFilter<K extends keyof FailureFilters>(key: K, val: FailureFilters[K]) {
    setFilters(prev => ({ ...prev, [key]: val }))
  }

  const filtered = useMemo(() => {
    let rows = MOCK_FAILURES.filter(f => {
      if (!inDateRange(f.date, filters.dateFrom, filters.dateTo)) return false
      if (filters.stage !== 'all' && f.stageId !== filters.stage) return false
      if (filters.result !== 'all' && f.result !== filters.result) return false
      if (filters.meterType !== 'all' && f.meterType !== filters.meterType) return false
      return true
    })
    rows = [...rows].sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime()
      return sortDir === 'desc' ? -diff : diff
    })
    return rows
  }, [filters, sortDir])

  function handleExport() {
    const headers = ['Date', 'Serial Number', 'Meter Type', 'Stage', 'Parameter', 'Recorded Value', 'Result', 'Tagged To', 'Operator']
    const rows = filtered.map(f => [
      formatDateTime(f.date), f.serialNumber, f.meterType, f.stage, f.parameter, f.value, f.result, f.taggedTo ?? '', f.operatorId,
    ])
    downloadCsv(`pmtool-failures-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }

  return (
    <div className="flex flex-col gap-5">
      <QaSummaryPanel />

      {/* Filters */}
      <div
        className="rounded-xl p-4 flex flex-wrap gap-3 items-end"
        style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
      >
        <FilterField label="From">
          <input type="date" value={filters.dateFrom} onChange={e => updateFilter('dateFrom', e.target.value)} className={INPUT_CLS} />
        </FilterField>
        <FilterField label="To">
          <input type="date" value={filters.dateTo} onChange={e => updateFilter('dateTo', e.target.value)} className={INPUT_CLS} />
        </FilterField>
        <FilterField label="Stage">
          <select value={filters.stage} onChange={e => updateFilter('stage', e.target.value)} className={INPUT_CLS}>
            <option value="all">All stages</option>
            {ALL_STAGE_IDS_QA.map(id => <option key={id} value={id}>{stationLabel(id)}</option>)}
          </select>
        </FilterField>
        <FilterField label="Meter type">
          <select value={filters.meterType} onChange={e => updateFilter('meterType', e.target.value)} className={INPUT_CLS}>
            <option value="all">All types</option>
            {ALL_METER_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </FilterField>
        <FilterField label="Result">
          <select value={filters.result} onChange={e => updateFilter('result', e.target.value as FailureResultFilter)} className={INPUT_CLS}>
            <option value="all">All results</option>
            <option value="NOT OK">NOT OK</option>
            <option value="REMARK">REMARK</option>
          </select>
        </FilterField>

        <div className="ml-auto self-end">
          <button
            onClick={handleExport}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: 'var(--color-primary)' }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl shadow-sm overflow-hidden"
        style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f8f9fc', borderBottom: '1px solid var(--color-card-border)' }}>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                  <button
                    className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                    onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                  >
                    Date <SortIcon dir={sortDir} />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Serial Number</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Meter Type</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Stage</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Parameter</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Recorded Value</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Result</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Tagged To</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Operator</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-gray-400 text-sm">
                    No records match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((f, i) => (
                  <tr
                    key={f.id}
                    className={`border-t transition-colors ${f.result === 'NOT OK' ? 'bg-red-50 hover:bg-red-100' : i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-100/50'}`}
                    style={{ borderColor: 'var(--color-card-border)' }}
                  >
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDateTime(f.date)}</td>
                    <td className="px-4 py-3 font-mono text-gray-800 whitespace-nowrap">{f.serialNumber}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{f.meterType}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{stationLabel(f.stageId)}</td>
                    <td className="px-4 py-3 text-gray-700">{f.parameter}</td>
                    <td className="px-4 py-3 font-mono text-gray-800 whitespace-nowrap">{f.value}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><ResultBadge result={f.result} /></td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{f.taggedTo ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 font-mono text-gray-600 whitespace-nowrap">{f.operatorId}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TableFooter count={filtered.length} noun="record" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// QA tab — Tamper Test sub-tab
// ---------------------------------------------------------------------------

function TamperTestTab() {
  const [filters, setFilters] = useState<TamperFilters>({
    dateFrom: '',
    dateTo: '',
    overall: 'all',
  })

  function updateFilter<K extends keyof TamperFilters>(key: K, val: TamperFilters[K]) {
    setFilters(prev => ({ ...prev, [key]: val }))
  }

  const filtered = useMemo(() => {
    return MOCK_TAMPER_SAMPLES
      .filter(t => {
        if (!inDateRange(t.date, filters.dateFrom, filters.dateTo)) return false
        if (filters.overall !== 'all' && t.overall !== filters.overall) return false
        return true
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [filters])

  function handleExport() {
    const headers = ['Date', 'Serial Number', 'Meter Type', '38 Tamper Test', 'Magnetic Tamper', '35KV ESD', 'Overall', 'Operator']
    const rows = filtered.map(t => [
      formatDateTime(t.date),
      t.serialNumber,
      t.meterType,
      `${t.tamper38.value} (${t.tamper38.result})`,
      `${t.magneticTamper.value} (${t.magneticTamper.result})`,
      `${t.esd35kv.value} (${t.esd35kv.result})`,
      t.overall,
      t.operatorId,
    ])
    downloadCsv(`pmtool-tamper-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      <div
        className="rounded-xl p-4 flex flex-wrap gap-3 items-end"
        style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
      >
        <FilterField label="From">
          <input type="date" value={filters.dateFrom} onChange={e => updateFilter('dateFrom', e.target.value)} className={INPUT_CLS} />
        </FilterField>
        <FilterField label="To">
          <input type="date" value={filters.dateTo} onChange={e => updateFilter('dateTo', e.target.value)} className={INPUT_CLS} />
        </FilterField>
        <FilterField label="Overall result">
          <div className="flex gap-1">
            {(['all', 'PASSED', 'FAILED'] as TamperOverallFilter[]).map(opt => (
              <button
                key={opt}
                onClick={() => updateFilter('overall', opt)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: filters.overall === opt ? 'var(--color-primary)' : '#f3f4f6',
                  color: filters.overall === opt ? '#fff' : '#374151',
                }}
              >
                {opt === 'all' ? 'All' : opt.charAt(0) + opt.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </FilterField>

        <div className="ml-auto self-end">
          <button
            onClick={handleExport}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: 'var(--color-primary)' }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl shadow-sm overflow-hidden"
        style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f8f9fc', borderBottom: '1px solid var(--color-card-border)' }}>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Serial Number</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Meter Type</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">38 Tamper Test</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Magnetic Tamper</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">35KV ESD</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Overall</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Operator</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-400 text-sm">
                    No Tamper Test samples match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((t, i) => (
                  <tr
                    key={t.id}
                    className={`border-t transition-colors ${i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-100/50'}`}
                    style={{ borderColor: 'var(--color-card-border)' }}
                  >
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDateTime(t.date)}</td>
                    <td className="px-4 py-3 font-mono text-gray-800 whitespace-nowrap">{t.serialNumber}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{t.meterType}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <TamperCell value={t.tamper38.value} result={t.tamper38.result} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <TamperCell value={t.magneticTamper.value} result={t.magneticTamper.result} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <TamperCell value={t.esd35kv.value} result={t.esd35kv.result} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><ResultBadge result={t.overall} /></td>
                    <td className="px-4 py-3 font-mono text-gray-600 whitespace-nowrap">{t.operatorId}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TableFooter count={filtered.length} noun="sample" />
      </div>
    </div>
  )
}

function TamperCell({ value, result }: { value: string; result: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-gray-700">{value}</span>
      <ResultBadge result={result} />
    </span>
  )
}

// ---------------------------------------------------------------------------
// QA tab — wrapper with its own sub-tab bar
// ---------------------------------------------------------------------------

function QaTab() {
  const [qaTab, setQaTab] = useState<QaTab>('failures')

  return (
    <div className="flex flex-col gap-5">
      {/* Sub-tab bar */}
      <div
        className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
      >
        {([
          { id: 'failures', label: 'Failure History' },
          { id: 'tamper',   label: 'Tamper Test Samples' },
        ] as { id: QaTab; label: string }[]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setQaTab(tab.id)}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150"
            style={
              qaTab === tab.id
                ? { background: 'var(--color-primary)', color: '#fff' }
                : { color: '#6b7280' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {qaTab === 'failures' ? <FailureHistoryTab /> : <TamperTestTab />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Access denied
// ---------------------------------------------------------------------------

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <div
        className="rounded-full w-14 h-14 flex items-center justify-center text-2xl"
        style={{ background: '#fef2f2' }}
      >
        <svg className="w-7 h-7" style={{ color: 'var(--color-danger)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <p className="text-lg font-semibold text-gray-800">Access Denied</p>
      <p className="text-sm text-gray-400">You do not have permission to view this page.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const MAIN_TABS: { id: MainTab; label: string }[] = [
  { id: 'production', label: 'Production' },
  { id: 'rework',     label: 'Rework' },
  { id: 'qa',         label: 'QA' },
]

export default function ReportsPage() {
  const { role, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<MainTab>('production')

  if (loading) {
    return <div className="p-10 text-gray-400 text-sm">Loading…</div>
  }

  if (!role || !ALLOWED_ROLES.includes(role)) {
    return <AccessDenied />
  }

  return (
    <div className="p-6 md:p-8 flex flex-col gap-6 max-w-screen-xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
        <p className="text-sm text-gray-400 mt-0.5">Production runs, rework items, and QE reports — read only</p>
      </div>

      {/* Main tab bar */}
      <div
        className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
      >
        {MAIN_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150"
            style={
              activeTab === tab.id
                ? { background: 'var(--color-primary)', color: '#fff' }
                : { color: '#6b7280' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'production' && <ProductionTab />}
      {activeTab === 'rework'     && <ReworkTab />}
      {activeTab === 'qa'         && <QaTab />}
    </div>
  )
}
