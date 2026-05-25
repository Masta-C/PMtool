'use client'

import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import type { Role } from '@/types/user'
import { STAGES, stationLabel } from '@/lib/stages'
import { db } from '@/lib/firebase/client'
import {
  collectionGroup,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc,
  doc,
  Timestamp,
} from 'firebase/firestore'

// ---------------------------------------------------------------------------
// Access control
// ---------------------------------------------------------------------------

const ALLOWED_ROLES: Role[] = ['qa', 'admin', 'supervisor']

// ---------------------------------------------------------------------------
// Firestore types
// ---------------------------------------------------------------------------

interface StageHistoryDoc {
  stageId: string
  operatorId: string
  overallResult: 'PASSED' | 'FAILED_ACCEPTED' | 'REWORK'
  failedCount?: number
  totalCount?: number
  comment?: string
  submittedAt: Timestamp | null
  startedAt?: Timestamp | null
  parameters?: { parameterId: string; name: string; numericValue?: string | number; passed: boolean }[]
}

interface MeterDoc {
  serialNumber: string
  meterType: string
  status: string
  currentStageId?: string
  taggedFromStageId?: string
  reworkCount?: number
  createdAt?: Timestamp | null
  assignedOperatorId?: string
}

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

// Normalised row types
interface ProductionRow {
  id: string
  orderNum: string
  stageId: string
  operatorId: string
  date: string
  result: 'Pass' | 'Fail'
  reworkStatus: 'Pending' | 'In Correction' | null
}

interface ReworkRow {
  id: string
  orderNum: string
  stageId: string
  assignedOperatorId: string
  dateTagged: string
  status: 'Pending' | 'In Correction'
}

interface FailureRow {
  id: string
  date: string
  serialNumber: string
  meterType: string
  stageId: string
  parameter: string
  value: string
  result: 'NOT OK'
  taggedTo: string | null
  operatorId: string
}

interface TamperRow {
  id: string
  date: string
  serialNumber: string
  meterType: string
  tamper38: { value: string; result: string }
  magneticTamper: { value: string; result: string }
  esd35kv: { value: string; result: string }
  overall: string
  operatorId: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function operatorName(id: string, lookup?: Record<string, string>): string {
  return lookup?.[id] ?? id
}

function toIso(ts: Timestamp | null | undefined): string {
  if (!ts) return new Date().toISOString()
  return ts.toDate().toISOString()
}

/** Fetch parent meter doc for a stageHistory document reference path like
 *  "meters/{meterId}/stageHistory/{attemptId}" */
function meterIdFromPath(path: string): string {
  // path = "meters/<meterId>/stageHistory/<attemptId>"
  const parts = path.split('/')
  return parts[1] ?? ''
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
  const { users } = useUsers()

  const operatorUsers = useMemo(
    () => users.filter(u => u.role === 'operator'),
    [users]
  )
  const operatorLookup = useMemo(
    () => Object.fromEntries(operatorUsers.map(u => [u.uid, u.displayName?.trim() || u.email])),
    [operatorUsers]
  )

  const [filters, setFilters] = useState<ProductionFilters>({
    station: 'all',
    dateFrom: '',
    dateTo: '',
    operator: 'all',
    result: 'all',
    reworkResult: 'all',
  })
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Live data from Firestore
  const [rows, setRows] = useState<ProductionRow[]>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    // Load last 30 days as the default window; filter client-side to avoid compound index requirements
    const windowStart = new Date()
    windowStart.setDate(windowStart.getDate() - 30)

    const q = query(
      collectionGroup(db, 'stageHistory'),
      where('submittedAt', '>=', Timestamp.fromDate(windowStart)),
      orderBy('submittedAt', 'desc')
    )

    // Cache of meterId → MeterDoc to avoid duplicate reads
    const meterCache: Record<string, MeterDoc> = {}

    const unsub = onSnapshot(q, async snap => {
      // Collect unique meterIds that are not yet cached
      const newMeterIds = Array.from(
        new Set(snap.docs.map(d => meterIdFromPath(d.ref.path)))
      ).filter(id => id && !(id in meterCache))

      // Fetch missing meter docs
      await Promise.all(
        newMeterIds.map(async meterId => {
          try {
            const meterSnap = await getDoc(doc(db, 'meters', meterId))
            if (meterSnap.exists()) {
              meterCache[meterId] = meterSnap.data() as MeterDoc
            }
          } catch {
            // Ignore individual fetch errors
          }
        })
      )

      const mapped: ProductionRow[] = snap.docs.map(d => {
        const data = d.data() as StageHistoryDoc
        const meterId = meterIdFromPath(d.ref.path)
        const meter = meterCache[meterId]
        const result: 'Pass' | 'Fail' = data.overallResult === 'REWORK' ? 'Fail' : 'Pass'
        const reworkStatus: 'Pending' | 'In Correction' | null =
          data.overallResult === 'REWORK' ? 'Pending' : null

        return {
          id: d.id,
          orderNum: meter?.serialNumber ?? meterId,
          stageId: data.stageId,
          operatorId: data.operatorId,
          date: toIso(data.submittedAt),
          result,
          reworkStatus,
        }
      })

      setRows(mapped)
      setLoadingData(false)
    })

    return unsub
  }, [])

  function updateFilter<K extends keyof ProductionFilters>(key: K, val: ProductionFilters[K]) {
    setFilters(prev => ({ ...prev, [key]: val }))
  }

  const filtered = useMemo(() => {
    let result = rows.filter(r => {
      if (filters.station !== 'all' && r.stageId !== filters.station) return false
      if (!inDateRange(r.date, filters.dateFrom, filters.dateTo)) return false
      if (filters.operator !== 'all' && r.operatorId !== filters.operator) return false
      if (filters.result !== 'all' && r.result !== filters.result) return false
      if (filters.reworkResult !== 'all') {
        if (filters.reworkResult === 'Pending' && r.reworkStatus !== 'Pending') return false
        if (filters.reworkResult === 'Resolved' && r.reworkStatus !== null) return false
      }
      return true
    })
    result = [...result].sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime()
      return sortDir === 'desc' ? -diff : diff
    })
    return result
  }, [rows, filters, sortDir])

  function handleExport() {
    const headers = ['Order #', 'Station', 'Operator', 'Date', 'Result', 'Rework Status']
    const exportRows = filtered.map(r => [
      r.orderNum,
      stationLabel(r.stageId),
      operatorName(r.operatorId, operatorLookup),
      formatDateTime(r.date),
      r.result,
      r.reworkStatus ?? '—',
    ])
    downloadCsv(`pmtool-production-${new Date().toISOString().slice(0, 10)}.csv`, headers, exportRows)
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
            <option value="all">All Operators</option>
            {operatorUsers.map(u => (
              <option key={u.uid} value={u.uid}>{u.displayName?.trim() || u.email}</option>
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

        <div className="ml-auto self-end flex gap-2">
          <button
            onClick={() => setFilters({ station: 'all', dateFrom: '', dateTo: '', operator: 'all', result: 'all', reworkResult: 'all' })}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Clear filters
          </button>
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
              {loadingData ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400 text-sm">
                    Loading production runs…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
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
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{operatorName(r.operatorId, operatorLookup)}</td>
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
  const [rows, setRows] = useState<ReworkRow[]>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'meters'),
      where('status', '==', 'rework')
    )

    const unsub = onSnapshot(q, snap => {
      const mapped: ReworkRow[] = snap.docs.map(d => {
        const data = d.data() as MeterDoc
        return {
          id: d.id,
          orderNum: data.serialNumber ?? d.id,
          stageId: data.taggedFromStageId ?? '',
          assignedOperatorId: data.assignedOperatorId ?? '',
          dateTagged: toIso(data.createdAt),
          status: 'Pending' as const,
        }
      })
      setRows(mapped)
      setLoadingData(false)
    })

    return unsub
  }, [])

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
              {loadingData ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400 text-sm">
                    Loading rework items…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
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
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{operatorName(r.assignedOperatorId)}</td>
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

function QaSummaryPanel({ failures }: { failures: FailureRow[] }) {
  const todayFailures = failures.filter(f => isToday(f.date))

  const stageCounts: Record<string, number> = {}
  const paramCounts: Record<string, number> = {}
  failures.forEach(f => {
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
  const [allFailures, setAllFailures] = useState<FailureRow[]>([])
  const [allMeterTypes, setAllMeterTypes] = useState<string[]>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    // Query stageHistory where overallResult === 'REWORK'
    const q = query(
      collectionGroup(db, 'stageHistory'),
      where('overallResult', '==', 'REWORK'),
      orderBy('submittedAt', 'desc')
    )

    const meterCache: Record<string, MeterDoc> = {}

    const unsub = onSnapshot(q, async snap => {
      const newMeterIds = Array.from(
        new Set(snap.docs.map(d => meterIdFromPath(d.ref.path)))
      ).filter(id => id && !(id in meterCache))

      await Promise.all(
        newMeterIds.map(async meterId => {
          try {
            const meterSnap = await getDoc(doc(db, 'meters', meterId))
            if (meterSnap.exists()) {
              meterCache[meterId] = meterSnap.data() as MeterDoc
            }
          } catch {
            // ignore
          }
        })
      )

      const mapped: FailureRow[] = snap.docs.map(d => {
        const data = d.data() as StageHistoryDoc
        const meterId = meterIdFromPath(d.ref.path)
        const meter = meterCache[meterId]

        // Find first failed parameter
        const firstFailed = data.parameters?.find(p => !p.passed)
        const paramName = firstFailed?.name ?? '—'
        const paramValue = firstFailed?.numericValue != null ? String(firstFailed.numericValue) : '—'

        return {
          id: d.id,
          date: toIso(data.submittedAt),
          serialNumber: meter?.serialNumber ?? meterId,
          meterType: meter?.meterType ?? '—',
          stageId: data.stageId,
          parameter: paramName,
          value: paramValue,
          result: 'NOT OK' as const,
          taggedTo: meter?.taggedFromStageId ? stationLabel(meter.taggedFromStageId) : null,
          operatorId: data.operatorId,
        }
      })

      const types = Array.from(new Set(mapped.map(f => f.meterType).filter(t => t !== '—')))
      setAllMeterTypes(types)
      setAllFailures(mapped)
      setLoadingData(false)
    })

    return unsub
  }, [])

  const allStageIds = useMemo(
    () => Array.from(new Set(allFailures.map(f => f.stageId))),
    [allFailures]
  )

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
    let rows = allFailures.filter(f => {
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
  }, [allFailures, filters, sortDir])

  function handleExport() {
    const headers = ['Date', 'Serial Number', 'Meter Type', 'Stage', 'Parameter', 'Recorded Value', 'Result', 'Tagged To', 'Operator']
    const exportRows = filtered.map(f => [
      formatDateTime(f.date), f.serialNumber, f.meterType, stationLabel(f.stageId), f.parameter, f.value, f.result, f.taggedTo ?? '', f.operatorId,
    ])
    downloadCsv(`pmtool-failures-${new Date().toISOString().slice(0, 10)}.csv`, headers, exportRows)
  }

  return (
    <div className="flex flex-col gap-5">
      <QaSummaryPanel failures={allFailures} />

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
            {allStageIds.map(id => <option key={id} value={id}>{stationLabel(id)}</option>)}
          </select>
        </FilterField>
        <FilterField label="Meter type">
          <select value={filters.meterType} onChange={e => updateFilter('meterType', e.target.value)} className={INPUT_CLS}>
            <option value="all">All types</option>
            {allMeterTypes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </FilterField>
        <FilterField label="Result">
          <select value={filters.result} onChange={e => updateFilter('result', e.target.value as FailureResultFilter)} className={INPUT_CLS}>
            <option value="all">All results</option>
            <option value="NOT OK">NOT OK</option>
            <option value="REMARK">REMARK</option>
          </select>
        </FilterField>

        <div className="ml-auto self-end flex gap-2">
          <button
            onClick={() => setFilters({ dateFrom: '', dateTo: '', stage: 'all', result: 'all', meterType: 'all' })}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Clear filters
          </button>
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
              {loadingData ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-gray-400 text-sm">
                    Loading failure history…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
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
  const [allTamper, setAllTamper] = useState<TamperRow[]>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    // stageHistory where stageId === 'stage_08' (tamper test stage)
    const q = query(
      collectionGroup(db, 'stageHistory'),
      where('stageId', '==', 'stage_08'),
      orderBy('submittedAt', 'desc')
    )

    const meterCache: Record<string, MeterDoc> = {}

    const unsub = onSnapshot(q, async snap => {
      const newMeterIds = Array.from(
        new Set(snap.docs.map(d => meterIdFromPath(d.ref.path)))
      ).filter(id => id && !(id in meterCache))

      await Promise.all(
        newMeterIds.map(async meterId => {
          try {
            const meterSnap = await getDoc(doc(db, 'meters', meterId))
            if (meterSnap.exists()) {
              meterCache[meterId] = meterSnap.data() as MeterDoc
            }
          } catch {
            // ignore
          }
        })
      )

      const mapped: TamperRow[] = snap.docs.map(d => {
        const data = d.data() as StageHistoryDoc
        const meterId = meterIdFromPath(d.ref.path)
        const meter = meterCache[meterId]
        const params = data.parameters ?? []

        function paramResult(name: string) {
          const p = params.find(x => x.name.toLowerCase().includes(name.toLowerCase()))
          if (!p) return { value: '—', result: '—' }
          return { value: p.passed ? 'Pass' : 'Fail', result: p.passed ? 'OK' : 'NOT OK' }
        }

        const overall =
          data.overallResult === 'PASSED' ? 'PASSED' :
          data.overallResult === 'REWORK' ? 'FAILED' : 'PASSED'

        return {
          id: d.id,
          date: toIso(data.submittedAt),
          serialNumber: meter?.serialNumber ?? meterId,
          meterType: meter?.meterType ?? '—',
          tamper38: paramResult('neutral'),
          magneticTamper: paramResult('magnetic'),
          esd35kv: paramResult('earth'),
          overall,
          operatorId: data.operatorId,
        }
      })

      setAllTamper(mapped)
      setLoadingData(false)
    })

    return unsub
  }, [])

  const [filters, setFilters] = useState<TamperFilters>({
    dateFrom: '',
    dateTo: '',
    overall: 'all',
  })

  function updateFilter<K extends keyof TamperFilters>(key: K, val: TamperFilters[K]) {
    setFilters(prev => ({ ...prev, [key]: val }))
  }

  const filtered = useMemo(() => {
    return allTamper
      .filter(t => {
        if (!inDateRange(t.date, filters.dateFrom, filters.dateTo)) return false
        if (filters.overall !== 'all' && t.overall !== filters.overall) return false
        return true
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [allTamper, filters])

  function handleExport() {
    const headers = ['Date', 'Serial Number', 'Meter Type', '38 Tamper Test', 'Magnetic Tamper', '35KV ESD', 'Overall', 'Operator']
    const exportRows = filtered.map(t => [
      formatDateTime(t.date),
      t.serialNumber,
      t.meterType,
      `${t.tamper38.value} (${t.tamper38.result})`,
      `${t.magneticTamper.value} (${t.magneticTamper.result})`,
      `${t.esd35kv.value} (${t.esd35kv.result})`,
      t.overall,
      t.operatorId,
    ])
    downloadCsv(`pmtool-tamper-${new Date().toISOString().slice(0, 10)}.csv`, headers, exportRows)
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

        <div className="ml-auto self-end flex gap-2">
          <button
            onClick={() => setFilters({ dateFrom: '', dateTo: '', overall: 'all' })}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Clear filters
          </button>
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
              {loadingData ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-400 text-sm">
                    Loading tamper test samples…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
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
