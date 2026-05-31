'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import { stationLabel, STAGES } from '@/lib/stages'
import { db } from '@/lib/firebase/client'
import {
  collection,
  collectionGroup,
  query,
  where,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DateRange = 'today' | 'last7' | 'last30' | 'custom'
type ResultFilter = 'all' | 'passed' | 'rework'
type ThroughputView = 'day' | 'month'

interface ExportFilters {
  dateRange: DateRange
  customFrom: string
  customTo: string
  station: string
  result: ResultFilter
}

interface DashboardMetrics {
  committed: number
  completed: number
  completedToday: number
  throughputPerHour: number
  failureRate: {
    percentage: number
    reworkCount: number
    totalSubmissions: number
  }
  inProgressByStation: { stageId: string; name: string; count: number }[]
  stationFailureRates: { stageId: string; failureRate: number }[]
  operatorFailureRates: { operatorId: string; name: string; failedCount: number }[]
  throughputByDay: { label: string; value: number }[]
  throughputByHour: { label: string; value: number }[]
  loading: boolean
}

// ---------------------------------------------------------------------------
// Firestore document shapes (minimal)
// ---------------------------------------------------------------------------

interface MeterDoc {
  currentStageId: string
  status: 'queued' | 'in_progress' | 'rework' | 'done'
  taggedFromStageId?: string
  createdAt: Timestamp
  completedAt?: Timestamp
}

interface StageHistoryDoc {
  stageId: string
  operatorId: string
  operatorName: string
  overallResult: 'PASSED' | 'FAILED_ACCEPTED' | 'REWORK'
  failedCount: number
  totalCount: number
  submittedAt: Timestamp
  taggedFromStageId?: string
}

// ---------------------------------------------------------------------------
// useDashboardMetrics hook
// ---------------------------------------------------------------------------

function useDashboardMetrics(
  refreshKey: number,
  stationFailureView: 'day' | 'week' | 'month',
  operatorFailureView: 'day' | 'week' | 'month',
): DashboardMetrics {
  const { users } = useUsers()

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    committed: 0,
    completed: 0,
    completedToday: 0,
    throughputPerHour: 0,
    failureRate: { percentage: 0, reworkCount: 0, totalSubmissions: 0 },
    inProgressByStation: STAGES.map(s => ({ stageId: s.stageId, name: s.name, count: 0 })),
    stationFailureRates: [],
    operatorFailureRates: [],
    throughputByDay: [],
    throughputByHour: [],
    loading: true,
  })

  // Keep latest users in a ref so Firestore callbacks can read them without
  // needing to be listed in the effect's dependency array (which would cause
  // constant re-subscriptions every time useUsers resolves).
  const usersRef = useRef(users)
  useEffect(() => { usersRef.current = users }, [users])

  // Shared mutable result buckets — updated by whichever snapshot fires
  const metersRef = useRef<MeterDoc[]>([])
  const allHistoryRef = useRef<StageHistoryDoc[]>([])

  useEffect(() => {
    // -----------------------------------------------------------------------
    // Time boundaries
    // -----------------------------------------------------------------------
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const todayTs = Timestamp.fromDate(todayStart)

    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const thirtyDaysTs = Timestamp.fromDate(thirtyDaysAgo)

    // -----------------------------------------------------------------------
    // Compute and publish metrics from the cached refs
    // -----------------------------------------------------------------------
    function compute() {
      const meters = metersRef.current
      const history = allHistoryRef.current
      const currentUsers = usersRef.current

      // --- KPI cards ---
      const committed = meters.length
      const completed = meters.filter(m => m.status === 'done').length

      const completedTodayMs = todayStart.getTime()
      const completedToday = meters.filter(m => {
        if (m.status !== 'done' || !m.completedAt) return false
        return m.completedAt.toMillis() >= completedTodayMs
      }).length

      // Hours elapsed since 08:00 today, floored to 1
      const shiftStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0)
      const hoursElapsed = Math.max(1, (now.getTime() - shiftStart.getTime()) / 3600000)
      const throughputPerHour = Math.round((completedToday / hoursElapsed) * 10) / 10

      // --- Failure rate (today) ---
      const todayHistory = history.filter(h => h.submittedAt.toMillis() >= completedTodayMs)
      const reworkToday = todayHistory.filter(h => h.overallResult === 'REWORK')
      const totalSubmissionsToday = todayHistory.length
      const reworkCount = reworkToday.length
      const failurePct = totalSubmissionsToday > 0
        ? Math.round((reworkCount / totalSubmissionsToday) * 100)
        : 0

      // --- In-progress by station ---
      const inProgressMap: Record<string, number> = {}
      for (const m of meters) {
        if (m.status === 'in_progress' && m.currentStageId) {
          inProgressMap[m.currentStageId] = (inProgressMap[m.currentStageId] ?? 0) + 1
        }
      }
      const inProgressByStation = STAGES.map(s => ({
        stageId: s.stageId,
        name: s.name,
        count: inProgressMap[s.stageId] ?? 0,
      }))

      // --- Station failure rates ---
      const stationPeriodMs = stationFailureView === 'day'
        ? completedTodayMs
        : stationFailureView === 'week'
          ? sevenDaysAgo.getTime()
          : thirtyDaysAgo.getTime()

      const stationReworkMap: Record<string, number> = {}
      for (const h of history) {
        if (h.overallResult !== 'REWORK') continue
        if (h.submittedAt.toMillis() < stationPeriodMs) continue
        const stageId = h.taggedFromStageId ?? h.stageId
        stationReworkMap[stageId] = (stationReworkMap[stageId] ?? 0) + 1
      }
      const stationFailureRates = Object.entries(stationReworkMap)
        .map(([stageId, count]) => ({ stageId, failureRate: count }))
        .sort((a, b) => b.failureRate - a.failureRate)

      // --- Operator failure rates ---
      const operatorPeriodMs = operatorFailureView === 'day'
        ? completedTodayMs
        : operatorFailureView === 'week'
          ? sevenDaysAgo.getTime()
          : thirtyDaysAgo.getTime()

      const operatorMap: Record<string, number> = {}
      for (const h of history) {
        if (h.failedCount <= 0) continue
        if (h.submittedAt.toMillis() < operatorPeriodMs) continue
        operatorMap[h.operatorId] = (operatorMap[h.operatorId] ?? 0) + h.failedCount
      }
      const operatorFailureRates = Object.entries(operatorMap)
        .map(([operatorId, failedCount]) => {
          const user = currentUsers.find(u => u.uid === operatorId)
          const name = user?.displayName ?? operatorId
          return { operatorId, name, failedCount }
        })
        .filter(o => o.failedCount > 0)
        .sort((a, b) => b.failedCount - a.failedCount)

      // --- Throughput by day (rolling 30) ---
      const finalHistory = history.filter(
        h => h.stageId === 'stage_13' && h.overallResult === 'PASSED',
      )
      const dayCountMap: Record<string, number> = {}
      for (const h of finalHistory) {
        if (h.submittedAt.toMillis() < thirtyDaysAgo.getTime()) continue
        const d = h.submittedAt.toDate()
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        dayCountMap[key] = (dayCountMap[key] ?? 0) + 1
      }
      const throughputByDay: { label: string; value: number }[] = []
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(now.getDate() - i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
        throughputByDay.push({ label, value: dayCountMap[key] ?? 0 })
      }

      // --- Throughput by hour (today) ---
      const hourCountMap: Record<number, number> = {}
      for (const h of finalHistory) {
        if (h.submittedAt.toMillis() < completedTodayMs) continue
        const hr = h.submittedAt.toDate().getHours()
        hourCountMap[hr] = (hourCountMap[hr] ?? 0) + 1
      }
      const throughputByHour: { label: string; value: number }[] = []
      for (let hr = 0; hr <= 23; hr++) {
        throughputByHour.push({
          label: `${String(hr).padStart(2, '0')}:00`,
          value: hourCountMap[hr] ?? 0,
        })
      }

      setMetrics({
        committed,
        completed,
        completedToday,
        throughputPerHour,
        failureRate: {
          percentage: failurePct,
          reworkCount,
          totalSubmissions: totalSubmissionsToday,
        },
        inProgressByStation,
        stationFailureRates,
        operatorFailureRates,
        throughputByDay,
        throughputByHour,
        loading: false,
      })
    }

    // -----------------------------------------------------------------------
    // Listener 1 — meters collection
    // -----------------------------------------------------------------------
    const metersUnsub = onSnapshot(
      collection(db, 'meters'),
      snap => {
        metersRef.current = snap.docs.map(d => d.data() as MeterDoc)
        compute()
      },
      err => console.error('meters snapshot error', err),
    )

    // -----------------------------------------------------------------------
    // Listener 2 — stageHistory collectionGroup (last 30 days)
    // -----------------------------------------------------------------------
    const historyUnsub = onSnapshot(
      query(
        collectionGroup(db, 'stageHistory'),
        where('submittedAt', '>=', thirtyDaysTs),
      ),
      snap => {
        allHistoryRef.current = snap.docs.map(d => d.data() as StageHistoryDoc)
        compute()
      },
      err => console.error('stageHistory snapshot error', err),
    )

    return () => {
      metersUnsub()
      historyUnsub()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, stationFailureView, operatorFailureView])

  // Re-compute when users resolve (names become available)
  useEffect(() => {
    // Only re-compute if we already have data (avoid no-op on mount)
    if (!metrics.loading) {
      // Trigger a lightweight re-derive by calling compute via a state update
      // that feeds through the next snapshot callback. Instead, we just
      // directly update the operatorFailureRates names here.
      setMetrics(prev => ({
        ...prev,
        operatorFailureRates: prev.operatorFailureRates.map(o => {
          const user = users.find(u => u.uid === o.operatorId)
          return user ? { ...o, name: user.displayName ?? o.operatorId } : o
        }),
      }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users])

  return metrics
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(d: Date) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin === 1) return '1 min ago'
  return `${diffMin} min ago`
}

function failureRateColor(pct: number): string {
  if (pct >= 10) return '#ef4444'
  if (pct >= 5)  return '#f59e0b'
  return '#22c55e'
}

// ---------------------------------------------------------------------------
// Export — still uses mock rows (export wiring is a separate issue)
// ---------------------------------------------------------------------------

const MOCK_EXPORT_ROWS = [
  { serialNumber: 'WO-2026-00001', meterType: 'EM-400', stage: 'Incoming Inspection',    parameter: 'SMD Components',          value: '250',    result: 'OK',     operator: 'OP-001', timestamp: new Date().toISOString() },
  { serialNumber: 'WO-2026-00002', meterType: 'EM-400', stage: 'Functional Testing',     parameter: 'Relay Functional Testing', value: '0.23V',  result: 'NOT OK', operator: 'OP-003', timestamp: new Date().toISOString() },
  { serialNumber: 'WO-2026-00003', meterType: 'EM-500', stage: 'SMD / EMS',              parameter: 'AOI Testing',              value: 'Pass',   result: 'OK',     operator: 'OP-002', timestamp: new Date().toISOString() },
  { serialNumber: 'WO-2026-00004', meterType: 'EM-400', stage: 'HV-IR Test',             parameter: 'AC High Voltage Test',     value: '2.5kV',  result: 'OK',     operator: 'OP-005', timestamp: new Date().toISOString() },
  { serialNumber: 'WO-2026-00005', meterType: 'EM-500', stage: 'Base Assembly',          parameter: 'Terminal Tightness',       value: '1.2Nm',  result: 'REMARK', operator: 'OP-004', timestamp: new Date().toISOString() },
  { serialNumber: 'WO-2026-00006', meterType: 'EM-400', stage: 'Error Compensation',     parameter: 'Current Error at 5%',      value: '0.12%',  result: 'OK',     operator: 'OP-003', timestamp: new Date().toISOString() },
  { serialNumber: 'WO-2026-00007', meterType: 'EM-500', stage: 'Final Testing',          parameter: 'LED Indicator',            value: 'Green',  result: 'OK',     operator: 'OP-006', timestamp: new Date().toISOString() },
  { serialNumber: 'WO-2026-00008', meterType: 'EM-400', stage: 'Functional Testing',     parameter: 'Voltage Measurement',      value: '231V',   result: 'NOT OK', operator: 'OP-003', timestamp: new Date().toISOString() },
  { serialNumber: 'WO-2026-00009', meterType: 'EM-500', stage: 'Soaking Test',           parameter: '72hr Soak',                value: 'Pass',   result: 'OK',     operator: 'OP-007', timestamp: new Date().toISOString() },
  { serialNumber: 'WO-2026-00010', meterType: 'EM-400', stage: 'Sealing',               parameter: 'Seal Integrity',           value: 'Pass',   result: 'OK',     operator: 'OP-008', timestamp: new Date().toISOString() },
  { serialNumber: 'WO-2026-00011', meterType: 'EM-500', stage: 'Packing',               parameter: 'Carton Labelling',         value: 'Pass',   result: 'OK',     operator: 'OP-009', timestamp: new Date().toISOString() },
  { serialNumber: 'WO-2026-00012', meterType: 'EM-400', stage: 'Cover Assembly',         parameter: 'Cover Torque',             value: '0.9Nm',  result: 'REMARK', operator: 'OP-004', timestamp: new Date().toISOString() },
]

const STATION_OPTIONS = [
  { value: 'all', label: 'All stations' },
  ...STAGES.map(s => ({ value: s.name, label: stationLabel(s.stageId) })),
]

function downloadCsv(filters: ExportFilters) {
  const resultMap: Record<ResultFilter, string[]> = {
    all:    ['OK', 'NOT OK', 'REMARK'],
    passed: ['OK'],
    rework: ['NOT OK'],
  }
  const allowed = resultMap[filters.result]

  let rows = MOCK_EXPORT_ROWS.filter(r => allowed.includes(r.result))

  if (filters.station !== 'all') {
    rows = rows.filter(r => r.stage === filters.station)
  }

  const headers = ['Serial Number', 'Meter Type', 'Stage', 'Parameter', 'Value', 'Result', 'Operator', 'Timestamp']
  const csvRows = rows.map(r => [
    r.serialNumber,
    r.meterType,
    r.stage,
    r.parameter,
    r.value,
    r.result,
    r.operator,
    r.timestamp,
  ].map(v => `"${v}"`).join(','))

  const csv = [headers.join(','), ...csvRows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pmtool-report-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface MetricCardProps {
  label: string
  value: string
  subLabel?: string
  accentColor: string
  trend?: { value: number; direction: 'up' | 'down' | 'neutral'; label?: string }
}

function MetricCard({ label, value, subLabel, accentColor, trend }: MetricCardProps) {
  return (
    <div
      className="glass-card rounded-xl p-5 flex flex-col gap-1"
    >
      <div
        className="w-1 h-8 rounded-full mb-1 self-start"
        style={{ background: accentColor }}
      />
      <span className="text-3xl font-bold" style={{ color: accentColor }}>{value}</span>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${
          trend.direction === 'up' ? 'text-green-600' :
          trend.direction === 'down' ? 'text-red-500' : 'text-gray-400'
        }`}>
          <span>{trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}</span>
          <span>{Math.abs(trend.value)}% {trend.label ?? 'vs yesterday'}</span>
        </div>
      )}
      <span className="text-sm font-semibold text-gray-700">{label}</span>
      {subLabel && <span className="text-xs text-gray-400">{subLabel}</span>}
    </div>
  )
}

interface HorizontalBarProps {
  label: string
  value: number
  maxValue: number
  color: string
  suffix?: string
}

function HorizontalBar({ label, value, maxValue, color, suffix = '' }: HorizontalBarProps) {
  const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs text-gray-500 w-36 shrink-0 truncate" title={label}>{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
        <div
          className="h-5 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
          style={{ width: `${Math.max(pct, 4)}%`, background: color }}
        >
          <span className="text-white text-xs font-semibold leading-none">{value}{suffix}</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ThroughputChart — pure SVG line chart, no external library
// ---------------------------------------------------------------------------

interface ThroughputPoint {
  label: string
  value: number
}

interface ThroughputChartProps {
  points: ThroughputPoint[]
  width?: number
  height?: number
  lineColor?: string
}

function ThroughputChart({
  points,
  width = 560,
  height = 160,
  lineColor = '#4361ee',
}: ThroughputChartProps) {
  const PAD_LEFT   = 36
  const PAD_RIGHT  = 8
  const PAD_TOP    = 12
  const PAD_BOTTOM = 28

  const chartW = width - PAD_LEFT - PAD_RIGHT
  const chartH = height - PAD_TOP - PAD_BOTTOM

  const maxVal = Math.max(...points.map(p => p.value), 1)
  const yMax   = Math.ceil(maxVal / 10) * 10 || 10

  const n = points.length

  function xOf(i: number): number {
    return PAD_LEFT + (i / Math.max(n - 1, 1)) * chartW
  }
  function yOf(v: number): number {
    return PAD_TOP + chartH - (v / yMax) * chartH
  }

  const polylinePoints = points
    .map((p, i) => `${xOf(i).toFixed(1)},${yOf(p.value).toFixed(1)}`)
    .join(' ')

  const areaPath = [
    `M ${xOf(0).toFixed(1)} ${yOf(0).toFixed(1)}`,
    ...points.map((p, i) => `L ${xOf(i).toFixed(1)} ${yOf(p.value).toFixed(1)}`),
    `L ${xOf(n - 1).toFixed(1)} ${yOf(0).toFixed(1)}`,
    'Z',
  ].join(' ')

  const yTicks = [0, 1, 2, 3].map(t => Math.round((yMax / 3) * t))

  const xLabelStep = Math.max(1, Math.floor(n / 8))
  const xLabelIndices = points.reduce<number[]>((acc, _, i) => {
    if (i === 0 || i === n - 1 || i % xLabelStep === 0) acc.push(i)
    return acc
  }, [])

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ display: 'block', overflow: 'visible' }}
      aria-label="Throughput line chart"
      onMouseLeave={() => setHoveredIdx(null)}
    >
      <defs>
        <linearGradient id="tp-area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={lineColor} stopOpacity="0.18" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {yTicks.map(tick => (
        <g key={tick}>
          <line
            x1={PAD_LEFT} y1={yOf(tick)}
            x2={width - PAD_RIGHT} y2={yOf(tick)}
            stroke="#e4e7f0" strokeWidth="1" strokeDasharray="4 3"
          />
          <text
            x={PAD_LEFT - 4} y={yOf(tick)}
            textAnchor="end" dominantBaseline="middle"
            fontSize="9" fill="#9ca3af"
          >
            {tick}
          </text>
        </g>
      ))}

      <path d={areaPath} fill="url(#tp-area-fill)" />

      <polyline
        points={polylinePoints}
        fill="none"
        stroke={lineColor}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {points.map((_, i) => {
        const cx    = xOf(i)
        const slotW = chartW / Math.max(n - 1, 1)
        return (
          <rect
            key={i}
            x={cx - slotW / 2} y={PAD_TOP}
            width={slotW} height={chartH}
            fill="transparent"
            onMouseEnter={() => setHoveredIdx(i)}
          />
        )
      })}

      {hoveredIdx !== null && (() => {
        const p   = points[hoveredIdx]
        const cx  = xOf(hoveredIdx)
        const cy  = yOf(p.value)
        const tipW = 68
        const tipH = 30
        const tipX = Math.min(cx - tipW / 2, width - tipW - PAD_RIGHT)
        const tipY = Math.max(cy - tipH - 8, PAD_TOP)
        return (
          <g>
            <line
              x1={cx} y1={PAD_TOP} x2={cx} y2={PAD_TOP + chartH}
              stroke={lineColor} strokeWidth="1" strokeDasharray="3 2" opacity="0.4"
            />
            <circle cx={cx} cy={cy} r="4" fill="#fff" stroke={lineColor} strokeWidth="2" />
            <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="5" fill="#1c2235" opacity="0.88" />
            <text x={tipX + tipW / 2} y={tipY + 11}
              textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
              {p.value} units
            </text>
            <text x={tipX + tipW / 2} y={tipY + 22}
              textAnchor="middle" fontSize="8.5" fill="#9da8c3">
              {p.label}
            </text>
          </g>
        )
      })()}

      {xLabelIndices.map(i => (
        <text
          key={i}
          x={xOf(i)} y={PAD_TOP + chartH + 14}
          textAnchor="middle" fontSize="8.5" fill="#9ca3af"
        >
          {points[i].label}
        </text>
      ))}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// LoadingSpinner — shown in chart panels while data is loading
// ---------------------------------------------------------------------------

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-32 text-gray-400 text-sm gap-2">
      <svg
        className="animate-spin"
        width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      Loading…
    </div>
  )
}

// ---------------------------------------------------------------------------
// Export Panel
// ---------------------------------------------------------------------------

function ExportPanel({ onClose }: { onClose: () => void }) {
  const [filters, setFilters] = useState<ExportFilters>({
    dateRange: 'today',
    customFrom: '',
    customTo: '',
    station: 'all',
    result: 'all',
  })

  function update<K extends keyof ExportFilters>(key: K, val: ExportFilters[K]) {
    setFilters(prev => ({ ...prev, [key]: val }))
  }

  function handleExport() {
    downloadCsv(filters)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div
        className="mt-16 mr-6 rounded-xl shadow-2xl p-6 w-80 flex flex-col gap-4"
        style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">Export Report</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-lg leading-none"
            aria-label="Close export panel"
          >
            &times;
          </button>
        </div>

        {/* Date range */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date range</label>
          <div className="grid grid-cols-2 gap-1">
            {(['today', 'last7', 'last30', 'custom'] as DateRange[]).map(dr => (
              <button
                key={dr}
                onClick={() => update('dateRange', dr)}
                className="rounded-lg py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: filters.dateRange === dr ? 'var(--color-primary)' : '#f3f4f6',
                  color: filters.dateRange === dr ? '#fff' : '#374151',
                }}
              >
                {dr === 'today' ? 'Today' : dr === 'last7' ? 'Last 7 days' : dr === 'last30' ? 'Last 30 days' : 'Custom'}
              </button>
            ))}
          </div>
          {filters.dateRange === 'custom' && (
            <div className="flex flex-col gap-1 mt-1">
              <input
                type="date"
                value={filters.customFrom}
                onChange={e => update('customFrom', e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
              />
              <input
                type="date"
                value={filters.customTo}
                onChange={e => update('customTo', e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
              />
            </div>
          )}
        </div>

        {/* Station filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Station</label>
          <select
            value={filters.station}
            onChange={e => update('station', e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
          >
            {STATION_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Result filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Result</label>
          <div className="flex gap-1">
            {(['all', 'passed', 'rework'] as ResultFilter[]).map(rf => (
              <button
                key={rf}
                onClick={() => update('result', rf)}
                className="flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition-colors"
                style={{
                  background: filters.result === rf ? 'var(--color-primary)' : '#f3f4f6',
                  color: filters.result === rf ? '#fff' : '#374151',
                }}
              >
                {rf === 'rework' ? 'Rework only' : rf.charAt(0).toUpperCase() + rf.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleExport}
          className="rounded-lg py-2 text-sm font-semibold text-white transition-colors"
          style={{ background: 'var(--color-primary)' }}
        >
          Export CSV
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main dashboard page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { role, loading } = useAuth()
  const router = useRouter()
  const [showExport, setShowExport] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(() => new Date())
  const [timeAgoLabel, setTimeAgoLabel] = useState<string>('just now')
  const [refreshKey, setRefreshKey] = useState(0)
  const [throughputView, setThroughputView] = useState<ThroughputView>('month')
  const [stationFailureView, setStationFailureView] = useState<'day' | 'week' | 'month'>('day')
  const [operatorFailureView, setOperatorFailureView] = useState<'day' | 'week' | 'month'>('day')

  // Update the "N min ago" label every minute — does NOT re-fetch data
  useEffect(() => {
    setTimeAgoLabel(formatTimeAgo(lastRefreshed))
    const id = setInterval(() => {
      setTimeAgoLabel(formatTimeAgo(lastRefreshed))
    }, 60000)
    return () => clearInterval(id)
  }, [lastRefreshed])

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1)
    setLastRefreshed(new Date())
  }, [])

  // Redirect operators and QA to their dedicated home screens
  useEffect(() => {
    if (!loading && role === 'operator') {
      router.replace('/operator')
    }
    if (!loading && role === 'qa') {
      router.replace('/qa')
    }
  }, [loading, role, router])

  // Live Firestore metrics
  const dashMetrics = useDashboardMetrics(refreshKey, stationFailureView, operatorFailureView)

  if (loading) {
    return (
      <div className="p-10 text-gray-400 text-sm">Loading…</div>
    )
  }

  // Operator and QA redirect to their own screens — show nothing while redirecting
  if (role === 'operator' || role === 'qa') {
    return null
  }

  const {
    inProgressByStation,
    failureRate,
    completedToday,
    stationFailureRates,
    throughputPerHour,
    committed,
    completed,
    operatorFailureRates,
    throughputByDay,
    throughputByHour,
  } = dashMetrics

  const maxInProgress = Math.max(...inProgressByStation.map(s => s.count), 1)
  const completedPct = committed > 0 ? Math.round((completed / committed) * 100) : 0
  const frColor = failureRateColor(failureRate.percentage)

  const maxStationReworks = Math.max(...stationFailureRates.map(s => s.failureRate), 1)
  const maxOperatorFailed = Math.max(...operatorFailureRates.map(o => o.failedCount), 1)

  return (
    <div className="p-6 md:p-8 flex flex-col gap-6 max-w-screen-xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">{formatDate(new Date())}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Refresh controls */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              Last refreshed: <span className="font-medium text-gray-500">{timeAgoLabel}</span>
            </span>
            <button
              onClick={handleRefresh}
              aria-label="Refresh dashboard data"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{
                background: 'var(--color-card-bg)',
                border: '1px solid var(--color-card-border)',
                color: 'var(--color-primary)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = '#eef0f7'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-card-bg)'
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Refresh
            </button>
          </div>
          <button
            onClick={() => setShowExport(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-colors"
            style={{ background: 'var(--color-primary)' }}
          >
            Export Report
          </button>
        </div>
      </div>

      {/* Row 1 — 4 metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Committed"
          value={String(committed)}
          subLabel="Total meters created"
          accentColor="#4361ee"
          trend={{ value: 3, direction: 'neutral', label: 'vs yesterday' }}
        />
        <MetricCard
          label="Completed Today"
          value={String(completedToday)}
          subLabel={`${completedPct}% of committed`}
          accentColor="#22c55e"
          trend={{ value: 2, direction: 'up', label: 'vs yesterday' }}
        />
        <MetricCard
          label="Throughput / hr"
          value={`${throughputPerHour}`}
          subLabel="Meters completed per hour"
          accentColor="#8b5cf6"
          trend={{ value: 8, direction: 'up', label: 'vs yesterday' }}
        />
        <MetricCard
          label="Failure Rate Today"
          value={`${failureRate.percentage}%`}
          subLabel={`${failureRate.reworkCount} rework tags (incl. corrected) of ${failureRate.totalSubmissions} submissions`}
          accentColor={frColor}
          trend={{ value: 5, direction: 'up', label: 'vs yesterday' }}
        />
      </div>

      {/* Row 2 — two side-by-side panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* In Progress by Station */}
        <div
          className="glass-card rounded-xl p-5 flex flex-col gap-3"
        >
          <h2 className="text-sm font-semibold text-gray-700">Meters In Progress by Station</h2>
          <p className="text-xs text-gray-400 -mt-2">
            Total: {inProgressByStation.reduce((s, st) => s + st.count, 0)} meters across 13 stages
          </p>
          {dashMetrics.loading ? <LoadingSpinner /> : (
            <div className="flex flex-col gap-0.5">
              {inProgressByStation.map(st => (
                <HorizontalBar
                  key={st.stageId}
                  label={stationLabel(st.stageId)}
                  value={st.count}
                  maxValue={maxInProgress}
                  color="var(--color-primary)"
                />
              ))}
            </div>
          )}
        </div>

        {/* Station vs Failure Rate */}
        <div
          className="glass-card rounded-xl p-5 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Station vs Failure Rate</h2>
              <p className="text-xs text-gray-400">Rework tags originated — corrected reworks included</p>
            </div>
            <div className="flex gap-1 shrink-0">
              {(['day', 'week', 'month'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setStationFailureView(v)}
                  className="text-xs px-2 py-1 rounded font-medium border transition-all"
                  style={stationFailureView === v
                    ? { background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }
                    : { background: 'transparent', color: '#6b7280', borderColor: '#d1d5db' }}
                >
                  {v === 'day' ? 'Today' : v === 'week' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>
          </div>
          {dashMetrics.loading ? <LoadingSpinner /> : stationFailureRates.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No reworks in this period</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {stationFailureRates.map(st => (
                <HorizontalBar
                  key={st.stageId}
                  label={stationLabel(st.stageId)}
                  value={st.failureRate}
                  maxValue={maxStationReworks}
                  color={failureRateColor(st.failureRate)}
                  suffix=" reworks"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 3 — Operator vs Failure Rate + Throughput line graph */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Operator vs Failure Rate */}
        <div
          className="glass-card rounded-xl p-5 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Operator vs Failure Rate</h2>
              <p className="text-xs text-gray-400">Raw failed count — corrected reworks included</p>
            </div>
            <div className="flex gap-1 shrink-0">
              {(['day', 'week', 'month'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setOperatorFailureView(v)}
                  className="text-xs px-2 py-1 rounded font-medium border transition-all"
                  style={operatorFailureView === v
                    ? { background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }
                    : { background: 'transparent', color: '#6b7280', borderColor: '#d1d5db' }}
                >
                  {v === 'day' ? 'Today' : v === 'week' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>
          </div>
          {dashMetrics.loading ? <LoadingSpinner /> : operatorFailureRates.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No operator failures in this period</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {operatorFailureRates.map(op => (
                <HorizontalBar
                  key={op.operatorId}
                  label={op.name}
                  value={op.failedCount}
                  maxValue={maxOperatorFailed}
                  color={failureRateColor(op.failedCount)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Throughput line graph */}
        <div
          className="glass-card rounded-xl p-5 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Throughput</h2>
              <p className="text-xs text-gray-400">
                Meters packed (stage 13 passed) per {throughputView === 'day' ? 'hour (today)' : 'day (last 30 days)'}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              {(['day', 'month'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setThroughputView(v)}
                  className="text-xs px-2 py-1 rounded font-medium border transition-all"
                  style={throughputView === v
                    ? { background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }
                    : { background: 'transparent', color: '#6b7280', borderColor: '#d1d5db' }}
                >
                  {v === 'day' ? 'Today' : 'Month'}
                </button>
              ))}
            </div>
          </div>
          {dashMetrics.loading ? <LoadingSpinner /> : (
            <ThroughputChart
              points={throughputView === 'month' ? throughputByDay : throughputByHour}
              lineColor="var(--color-primary)"
            />
          )}
        </div>
      </div>

      {/* Export panel overlay */}
      {showExport && <ExportPanel onClose={() => setShowExport(false)} />}
    </div>
  )
}
