'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { stationLabel } from '@/lib/stages'

// ---------------------------------------------------------------------------
// Mock data — will be replaced with Firestore queries once data layer merges
//
// FAILURE ATTRIBUTION MODEL (Issue #13):
// Every rework tag = 1 permanent failure attributed to the station that
// *tagged* the item for rework (reworkDoc.taggedFromStageId), NOT the
// downstream station that identified/caught the error.
// Corrected reworks are NOT excluded — they still count as 1 failure each.
//
// When wiring to Firestore:
//   - Query all rework documents created today (no status filter — include corrected)
//   - Group by reworkDoc.taggedFromStageId to build stationFailureRates
//   - failureRate.reworkCount = total rework docs created today (all statuses)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Throughput mock data
// TODO (Issue #17): Replace with Firestore query — collection('submissions')
//   where result == 'OK' AND stageId == 'stage_13' (Packing — the final
//   station), grouped by:
//     Month view: day for rolling 30 days  → x = 'DD MMM', y = count per day
//     Day view:   hour (0–23) for today    → x = 'HH:00', y = count per hour
//   Empty days/hours must produce value = 0 (no gaps).
// ---------------------------------------------------------------------------

function buildMonthMockData(): { label: string; value: number }[] {
  const today = new Date()
  const points: { label: string; value: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    // Realistic numbers: ~40–80 units/day; weekends idle
    const isWeekend = d.getDay() === 0 || d.getDay() === 6
    const value = isWeekend
      ? 0
      : Math.max(0, Math.round(58 + Math.sin(i * 1.3) * 18 + (i % 7) * 1.5))
    points.push({ label, value })
  }
  return points
}

function buildDayMockData(): { label: string; value: number }[] {
  const points: { label: string; value: number }[] = []
  const currentHour = new Date().getHours()
  for (let h = 0; h <= 23; h++) {
    const label = `${String(h).padStart(2, '0')}:00`
    let value = 0
    // Production shift 08:00–20:00
    if (h >= 8 && h < 20) {
      if (h < currentHour) {
        value = Math.max(0, Math.round(5 + Math.sin(h * 0.7) * 3 + (h % 3)))
      } else if (h === currentHour) {
        value = Math.max(0, Math.round((5 + Math.sin(h * 0.7) * 3) * 0.5))
      }
    }
    points.push({ label, value })
  }
  return points
}

const MOCK_THROUGHPUT_MONTH = buildMonthMockData()
const MOCK_THROUGHPUT_DAY   = buildDayMockData()

// ---------------------------------------------------------------------------
// Operator vs Failure Rate mock data
// TODO (Issue #17): Replace with Firestore query — group submissions by
//   operatorId for today, compute failureRate = NOT_OK / total, sort
//   descending, take top 5.
// ---------------------------------------------------------------------------

const MOCK_OPERATOR_FAILURE: { operatorId: string; name: string; failureRate: number }[] = [
  { operatorId: 'OP-003', name: 'Operator 003', failureRate: 22 },
  { operatorId: 'OP-005', name: 'Operator 005', failureRate: 14 },
  { operatorId: 'OP-004', name: 'Operator 004', failureRate: 9 },
  { operatorId: 'OP-001', name: 'Operator 001', failureRate: 6 },
  { operatorId: 'OP-007', name: 'Operator 007', failureRate: 3 },
]

const MOCK_METRICS = {
  inProgressByStation: [
    { stageId: 'stage_01', name: 'Incoming Inspection', count: 8 },
    { stageId: 'stage_02', name: 'SMD / EMS', count: 12 },
    { stageId: 'stage_03', name: 'PCBA Incoming', count: 3 },
    { stageId: 'stage_04', name: 'Base Assembly', count: 6 },
    { stageId: 'stage_05', name: 'Functional Testing', count: 9 },
    { stageId: 'stage_06', name: 'Cover Assembly', count: 4 },
    { stageId: 'stage_07', name: 'Error Compensation', count: 7 },
    { stageId: 'stage_08', name: 'Tamper Test', count: 2 },
    { stageId: 'stage_09', name: 'HV-IR Test', count: 5 },
    { stageId: 'stage_10', name: 'Soaking Test', count: 11 },
    { stageId: 'stage_11', name: 'Final Testing', count: 3 },
    { stageId: 'stage_12', name: 'Sealing', count: 2 },
    { stageId: 'stage_13', name: 'Packing', count: 1 },
  ],
  // reworkCount counts all rework tags today, including ones subsequently corrected.
  failureRate: { percentage: 12, reworkCount: 8, totalSubmissions: 65 },
  completedToday: 47,
  // Grouped by the station that *tagged* the meter for rework (taggedFromStageId),
  // not the station that caught the defect downstream.
  // Both active and corrected reworks are included in each station's tally.
  stationFailureRates: [
    { stageId: 'stage_02', name: 'SMD / EMS', failureRate: 22 },
    { stageId: 'stage_03', name: 'PCBA Incoming', failureRate: 18 },
    { stageId: 'stage_04', name: 'Base Assembly', failureRate: 14 },
    { stageId: 'stage_05', name: 'Functional Testing', failureRate: 10 },
    { stageId: 'stage_01', name: 'Incoming Inspection', failureRate: 6 },
  ],
  throughputPerHour: 5.9,
  committed: 120,
  completed: 47,
  dayStartedAt: new Date(Date.now() - 8 * 3600000).toISOString(),
}

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
}

function MetricCard({ label, value, subLabel, accentColor }: MetricCardProps) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-1 shadow-sm"
      style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
    >
      <div
        className="w-1 h-8 rounded-full mb-1 self-start"
        style={{ background: accentColor }}
      />
      <span className="text-3xl font-bold" style={{ color: accentColor }}>{value}</span>
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
// Consistent with the HorizontalBar aesthetic (same card-bg, gray-100 grid).
// ---------------------------------------------------------------------------

interface ThroughputPoint {
  label: string
  value: number
}

interface ThroughputChartProps {
  points: ThroughputPoint[]
  /** Logical SVG width — rendered responsive via viewBox */
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
  // Round y-axis ceiling up to a nice multiple of 10
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

  // Closed area path for gradient fill beneath the line
  const areaPath = [
    `M ${xOf(0).toFixed(1)} ${yOf(0).toFixed(1)}`,
    ...points.map((p, i) => `L ${xOf(i).toFixed(1)} ${yOf(p.value).toFixed(1)}`),
    `L ${xOf(n - 1).toFixed(1)} ${yOf(0).toFixed(1)}`,
    'Z',
  ].join(' ')

  // 4 y-axis gridlines
  const yTicks = [0, 1, 2, 3].map(t => Math.round((yMax / 3) * t))

  // At most 8 evenly-spaced x-axis labels
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

      {/* Y-axis gridlines + labels */}
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

      {/* Area fill */}
      <path d={areaPath} fill="url(#tp-area-fill)" />

      {/* Line */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={lineColor}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Invisible hover strips — one per data point */}
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

      {/* Hovered point + tooltip */}
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

      {/* X-axis labels */}
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
// Export Panel
// ---------------------------------------------------------------------------

const STATION_OPTIONS = [
  { value: 'all', label: 'All stations' },
  ...MOCK_METRICS.inProgressByStation.map(s => ({ value: s.name, label: stationLabel(s.stageId) })),
]

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
  const [stationFailureView, setStationFailureView] = useState<'day' | 'month'>('day')
  const [operatorFailureView, setOperatorFailureView] = useState<'day' | 'month'>('day')

  // Update the "N min ago" label every minute — does NOT re-fetch data
  useEffect(() => {
    setTimeAgoLabel(formatTimeAgo(lastRefreshed))
    const id = setInterval(() => {
      setTimeAgoLabel(formatTimeAgo(lastRefreshed))
    }, 60000)
    return () => clearInterval(id)
  }, [lastRefreshed])

  // Re-triggering all data fetches is done by bumping refreshKey.
  // Each data-fetching hook/call should depend on refreshKey once Firestore is wired.
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

  if (loading) {
    return (
      <div className="p-10 text-gray-400 text-sm">Loading…</div>
    )
  }

  // Operator and QA redirect to their own screens — show nothing while redirecting
  if (role === 'operator' || role === 'qa') {
    return null
  }

  // Admin and supervisor see full dashboard
  // refreshKey is bumped by handleRefresh; future Firestore hooks will depend on it
  void refreshKey
  const { inProgressByStation, failureRate, completedToday, stationFailureRates, throughputPerHour, committed, completed } = MOCK_METRICS

  const maxInProgress = Math.max(...inProgressByStation.map(s => s.count))
  const completedPct = committed > 0 ? Math.round((completed / committed) * 100) : 0
  const frColor = failureRateColor(failureRate.percentage)

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
              {/* Refresh icon */}
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
          subLabel="Target for today"
          accentColor="#4361ee"
        />
        <MetricCard
          label="Completed Today"
          value={String(completedToday)}
          subLabel={`${completedPct}% of target`}
          accentColor="#22c55e"
        />
        <MetricCard
          label="Throughput / hr"
          value={`${throughputPerHour}`}
          subLabel="Meters completed per hour"
          accentColor="#8b5cf6"
        />
        <MetricCard
          label="Failure Rate Today"
          value={`${failureRate.percentage}%`}
          subLabel={`${failureRate.reworkCount} rework tags (incl. corrected) of ${failureRate.totalSubmissions} submissions`}
          accentColor={frColor}
        />
      </div>

      {/* Row 2 — two side-by-side panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* In Progress by Station */}
        <div
          className="rounded-xl p-5 shadow-sm flex flex-col gap-3"
          style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
        >
          <h2 className="text-sm font-semibold text-gray-700">Meters In Progress by Station</h2>
          <p className="text-xs text-gray-400 -mt-2">
            Total: {inProgressByStation.reduce((s, st) => s + st.count, 0)} meters across 13 stages
          </p>
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
        </div>

        {/* Station vs Failure Rate */}
        <div
          className="rounded-xl p-5 shadow-sm flex flex-col gap-3"
          style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Station vs Failure Rate</h2>
              <p className="text-xs text-gray-400">Rework tags originated — corrected reworks included</p>
            </div>
            <div className="flex gap-1 shrink-0">
              {(['day', 'month'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setStationFailureView(v)}
                  className="text-xs px-2 py-1 rounded font-medium border transition-all"
                  style={stationFailureView === v
                    ? { background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }
                    : { background: 'transparent', color: '#6b7280', borderColor: '#d1d5db' }}
                >
                  {v === 'day' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {stationFailureRates.map(st => (
              <HorizontalBar
                key={st.stageId}
                label={stationLabel(st.stageId)}
                value={st.failureRate}
                maxValue={100}
                color={failureRateColor(st.failureRate)}
                suffix="%"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Row 3 — Operator vs Failure Rate + Throughput line graph */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Operator vs Failure Rate */}
        <div
          className="rounded-xl p-5 shadow-sm flex flex-col gap-3"
          style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Operator vs Failure Rate</h2>
              <p className="text-xs text-gray-400">Raw failed count — corrected reworks included</p>
            </div>
            <div className="flex gap-1 shrink-0">
              {(['day', 'month'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setOperatorFailureView(v)}
                  className="text-xs px-2 py-1 rounded font-medium border transition-all"
                  style={operatorFailureView === v
                    ? { background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }
                    : { background: 'transparent', color: '#6b7280', borderColor: '#d1d5db' }}
                >
                  {v === 'day' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {MOCK_OPERATOR_FAILURE.map(op => (
              <HorizontalBar
                key={op.operatorId}
                label={op.name}
                value={op.failureRate}
                maxValue={Math.max(...MOCK_OPERATOR_FAILURE.map(o => o.failureRate), 1)}
                color={failureRateColor(op.failureRate)}
              />
            ))}
          </div>
        </div>

        {/* Throughput line graph */}
        <div
          className="rounded-xl p-5 shadow-sm flex flex-col gap-3"
          style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Throughput</h2>
              <p className="text-xs text-gray-400">Meters completed per {throughputView === 'day' ? 'day (this week)' : 'day (this month)'}</p>
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
                  {v === 'day' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>
          </div>
          <ThroughputChart
            points={throughputView === 'month' ? MOCK_THROUGHPUT_MONTH : MOCK_THROUGHPUT_DAY}
            lineColor="var(--color-primary)"
          />
        </div>
      </div>

      {/* Export panel overlay */}
      {showExport && <ExportPanel onClose={() => setShowExport(false)} />}
    </div>
  )
}
