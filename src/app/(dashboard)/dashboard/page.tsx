'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

// ---------------------------------------------------------------------------
// Mock data — will be replaced with Firestore queries once data layer merges
// ---------------------------------------------------------------------------

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
  failureRate: { percentage: 12, reworkCount: 8, totalSubmissions: 65 },
  completedToday: 47,
  stationFailureRates: [
    { stageId: 'stage_05', name: 'Functional Testing', failureRate: 28 },
    { stageId: 'stage_02', name: 'SMD / EMS', failureRate: 15 },
    { stageId: 'stage_09', name: 'HV-IR Test', failureRate: 10 },
    { stageId: 'stage_07', name: 'Error Compensation', failureRate: 8 },
    { stageId: 'stage_01', name: 'Incoming Inspection', failureRate: 5 },
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
// Export Panel
// ---------------------------------------------------------------------------

const STATION_OPTIONS = [
  { value: 'all', label: 'All stations' },
  ...MOCK_METRICS.inProgressByStation.map(s => ({ value: s.name, label: s.name })),
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
// Simplified operator/QA view
// ---------------------------------------------------------------------------

function SimplifiedView() {
  return (
    <div className="p-6 md:p-10 flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-sm">
        <MetricCard
          label="Completed Today"
          value={String(MOCK_METRICS.completedToday)}
          accentColor="var(--color-success)"
        />
        <MetricCard
          label="Your Station Queue"
          value="9"
          subLabel="Functional Testing"
          accentColor="var(--color-primary)"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main dashboard page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { role, loading } = useAuth()
  const [showExport, setShowExport] = useState(false)

  if (loading) {
    return (
      <div className="p-10 text-gray-400 text-sm">Loading…</div>
    )
  }

  // Operator and QA see simplified view
  if (role === 'operator' || role === 'qa') {
    return <SimplifiedView />
  }

  // Admin, supervisor, super_admin see full dashboard
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
        <button
          onClick={() => setShowExport(true)}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-colors"
          style={{ background: 'var(--color-primary)' }}
        >
          Export Report
        </button>
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
          subLabel={`${failureRate.reworkCount} of ${failureRate.totalSubmissions} submissions`}
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
                label={st.name}
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
          <h2 className="text-sm font-semibold text-gray-700">Station vs Failure Rate</h2>
          <p className="text-xs text-gray-400 -mt-2">Top 5 stations by rework frequency</p>
          <div className="flex flex-col gap-1.5">
            {stationFailureRates.map(st => (
              <HorizontalBar
                key={st.stageId}
                label={st.name}
                value={st.failureRate}
                maxValue={100}
                color={failureRateColor(st.failureRate)}
                suffix="%"
              />
            ))}
          </div>

          {/* Table view as secondary reference */}
          <div className="mt-2 border-t border-gray-100 pt-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400">
                  <th className="text-left font-medium pb-1">Station</th>
                  <th className="text-right font-medium pb-1">Failure %</th>
                </tr>
              </thead>
              <tbody>
                {stationFailureRates.map(st => (
                  <tr key={st.stageId} className="border-t border-gray-50">
                    <td className="py-1 text-gray-600">{st.name}</td>
                    <td
                      className="py-1 text-right font-semibold"
                      style={{ color: failureRateColor(st.failureRate) }}
                    >
                      {st.failureRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 3 — Committed vs Completed progress bar */}
      <div
        className="rounded-xl p-6 shadow-sm flex flex-col gap-4"
        style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-gray-700">Committed vs Completed</h2>
          <span className="text-xs text-gray-400">
            {completed} of {committed} meters completed today ({completedPct}%)
          </span>
        </div>

        {/* Large progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-8 overflow-hidden">
          <div
            className="h-8 rounded-full flex items-center justify-end pr-4 transition-all duration-700"
            style={{
              width: `${Math.max(completedPct, 2)}%`,
              background: 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)',
            }}
          >
            <span className="text-white text-sm font-bold">{completedPct}%</span>
          </div>
        </div>

        {/* Labels */}
        <div className="flex justify-between text-xs text-gray-400">
          <span>0</span>
          <span className="font-medium text-gray-600">{completed} completed</span>
          <span>{committed} committed</span>
        </div>
      </div>

      {/* Export panel overlay */}
      {showExport && <ExportPanel onClose={() => setShowExport(false)} />}
    </div>
  )
}
