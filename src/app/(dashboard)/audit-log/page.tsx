'use client'
import { useState, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import type { Role } from '@/types/user'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionType =
  | 'STAGE_SUBMITTED'
  | 'REWORK_TAGGED'
  | 'REWORK_ACCEPTED'
  | 'DRAFT_SAVED'
  | 'SUPERVISOR_OVERRIDE'
  | 'USER_CREATED'
  | 'USER_DELETED'
  | 'PASSWORD_RESET'
  | 'OPERATOR_ASSIGNED'

interface AuditEntry {
  id: string
  action: ActionType
  actorUid: string
  actorRole: Role
  targetMeterId: string | null
  stageId: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  timestamp: string
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_AUDIT_LOG: AuditEntry[] = [
  {
    id: 'log_001',
    action: 'STAGE_SUBMITTED',
    actorUid: 'test-operator',
    actorRole: 'operator',
    targetMeterId: 'WO-2026-00001',
    stageId: 'stage_01',
    before: { status: 'in_progress', currentStageId: 'stage_01' },
    after: { status: 'queued', currentStageId: 'stage_02', result: 'PASSED' },
    timestamp: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: 'log_002',
    action: 'REWORK_TAGGED',
    actorUid: 'test-operator',
    actorRole: 'operator',
    targetMeterId: 'WO-2026-00002',
    stageId: 'stage_05',
    before: { status: 'in_progress', currentStageId: 'stage_05' },
    after: { status: 'rework', currentStageId: 'stage_03', comment: 'Power supply irregular' },
    timestamp: new Date(Date.now() - 900000).toISOString(),
  },
  {
    id: 'log_003',
    action: 'SUPERVISOR_OVERRIDE',
    actorUid: 'test-supervisor',
    actorRole: 'supervisor',
    targetMeterId: 'WO-2026-00003',
    stageId: 'stage_09',
    before: { status: 'failed', result: 'FAILED' },
    after: { status: 'queued', currentStageId: 'stage_10', result: 'OVERRIDDEN', comment: 'Borderline reading, QE approved' },
    timestamp: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'log_004',
    action: 'DRAFT_SAVED',
    actorUid: 'test-operator',
    actorRole: 'operator',
    targetMeterId: 'WO-2026-00004',
    stageId: 'stage_02',
    before: null,
    after: { draftSavedAt: new Date(Date.now() - 3600000).toISOString(), parametersFilled: 3 },
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'log_005',
    action: 'USER_CREATED',
    actorUid: 'test-admin',
    actorRole: 'admin',
    targetMeterId: null,
    stageId: null,
    before: null,
    after: { displayName: 'OP-005', role: 'operator', email: 'op005@pmtool.dev' },
    timestamp: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'log_006',
    action: 'REWORK_ACCEPTED',
    actorUid: 'test-operator',
    actorRole: 'operator',
    targetMeterId: 'WO-2026-00002',
    stageId: 'stage_03',
    before: { status: 'rework' },
    after: { status: 'in_progress' },
    timestamp: new Date(Date.now() - 1200000).toISOString(),
  },
]

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<ActionType, string> = {
  STAGE_SUBMITTED: 'Stage Submitted',
  REWORK_TAGGED: 'Rework Tagged',
  REWORK_ACCEPTED: 'Rework Accepted',
  DRAFT_SAVED: 'Draft Saved',
  SUPERVISOR_OVERRIDE: 'Supervisor Override',
  USER_CREATED: 'User Created',
  USER_DELETED: 'User Deleted',
  PASSWORD_RESET: 'Password Reset',
  OPERATOR_ASSIGNED: 'Operator Assigned',
}

const ACTION_BADGE: Record<ActionType, string> = {
  STAGE_SUBMITTED: 'bg-green-100 text-green-700',
  REWORK_TAGGED: 'bg-amber-100 text-amber-700',
  REWORK_ACCEPTED: 'bg-yellow-100 text-yellow-700',
  SUPERVISOR_OVERRIDE: 'bg-red-100 text-red-700',
  DRAFT_SAVED: 'bg-gray-100 text-gray-600',
  USER_CREATED: 'bg-blue-100 text-blue-700',
  USER_DELETED: 'bg-red-100 text-red-700',
  PASSWORD_RESET: 'bg-amber-100 text-amber-700',
  OPERATOR_ASSIGNED: 'bg-blue-100 text-blue-700',
}

const ROLE_BADGE: Record<Role, string> = {
  admin: 'bg-blue-100 text-blue-700',
  supervisor: 'bg-blue-100 text-blue-700',
  operator: 'bg-green-100 text-green-700',
  qa: 'bg-orange-100 text-orange-700',
}

type DateFilter = 'today' | '7d' | '30d'
type RoleFilter = 'all' | Role

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function getOneLinerDetails(after: Record<string, unknown> | null): string {
  if (!after) return '—'
  const keys = Object.keys(after)
  if (keys.length === 0) return '—'
  // Prefer meaningful summary fields
  if (after.comment) return `comment: ${String(after.comment)}`
  if (after.result) return `result: ${String(after.result)}`
  if (after.status) return `status: ${String(after.status)}`
  if (after.role) return `role: ${String(after.role)}`
  // Fall back to first two fields
  return keys
    .slice(0, 2)
    .map(k => `${k}: ${String(after[k])}`)
    .join(', ')
}

function matchesDateFilter(iso: string, filter: DateFilter): boolean {
  const now = Date.now()
  const ts = new Date(iso).getTime()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  if (filter === 'today') return ts >= todayStart.getTime()
  if (filter === '7d') return ts >= now - 7 * 24 * 60 * 60 * 1000
  return ts >= now - 30 * 24 * 60 * 60 * 1000
}

/** Convert filtered log to CSV string */
function toCsv(entries: AuditEntry[]): string {
  const header = ['Timestamp', 'Action', 'Meter', 'Stage', 'Actor', 'Actor Role', 'Details'].join(',')
  const rows = entries.map(e =>
    [
      `"${formatTimestamp(e.timestamp)}"`,
      `"${ACTION_LABELS[e.action]}"`,
      `"${e.targetMeterId ?? '—'}"`,
      `"${e.stageId ?? '—'}"`,
      `"${e.actorUid}"`,
      `"${e.actorRole}"`,
      `"${getOneLinerDetails(e.after)}"`,
    ].join(',')
  )
  return [header, ...rows].join('\n')
}

// ---------------------------------------------------------------------------
// Before/After display component
// ---------------------------------------------------------------------------

function KvTable({ data, label }: { data: Record<string, unknown> | null; label: string }) {
  if (!data) {
    return (
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
        <p className="text-xs text-gray-400 italic">—</p>
      </div>
    )
  }
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <dl className="space-y-0.5">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="flex gap-2 text-xs">
            <dt className="font-medium text-gray-600 min-w-[120px]">{k}</dt>
            <dd className="text-gray-800 break-all">{String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Access-denied screen
// ---------------------------------------------------------------------------

function AccessDenied() {
  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[40vh]">
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center max-w-sm">
        <p className="text-lg font-semibold text-red-700 mb-2">Access Denied</p>
        <p className="text-sm text-red-600">
          The Audit Log is only accessible to admins and supervisors.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AuditLogPage() {
  const { role } = useAuth()

  // Access control
  const canView = role === 'admin' || role === 'supervisor'
  const canExport = role === 'admin'

  if (!canView) return <AccessDenied />

  return <AuditLogContent canExport={canExport} />
}

// Separate inner component so hooks are not called conditionally
function AuditLogContent({ canExport }: { canExport: boolean }) {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<ActionType | 'all'>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('30d')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return MOCK_AUDIT_LOG
      .filter(e => {
        if (search.trim()) {
          const q = search.trim().toLowerCase()
          if (!e.targetMeterId?.toLowerCase().includes(q)) return false
        }
        if (actionFilter !== 'all' && e.action !== actionFilter) return false
        if (!matchesDateFilter(e.timestamp, dateFilter)) return false
        if (roleFilter !== 'all' && e.actorRole !== roleFilter) return false
        return true
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [search, actionFilter, dateFilter, roleFilter])

  function handleExport() {
    const csv = toCsv(filtered)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function toggleRow(id: string) {
    setExpandedId(prev => (prev === id ? null : id))
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'} shown</p>
        </div>
        {canExport && (
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            Export CSV
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-end shadow-sm">
        {/* Serial number search */}
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Serial Number</label>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search meter..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Action filter */}
        <div className="min-w-[200px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Action Type</label>
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value as ActionType | 'all')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Actions</option>
            {(Object.keys(ACTION_LABELS) as ActionType[]).map(a => (
              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
            ))}
          </select>
        </div>

        {/* Date filter */}
        <div className="min-w-[160px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Date Range</label>
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value as DateFilter)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>

        {/* Role filter */}
        <div className="min-w-[160px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Actor Role</label>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as RoleFilter)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Roles</option>
            <option value="operator">operator</option>
            <option value="supervisor">supervisor</option>
            <option value="admin">admin</option>
            <option value="qa">qa</option>
          </select>
        </div>
      </div>

      {/* Log table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No audit entries match the current filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Timestamp', 'Action', 'Meter', 'Stage', 'Actor', 'Details'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(entry => (
                <>
                  <tr
                    key={entry.id}
                    onClick={() => toggleRow(entry.id)}
                    className="hover:bg-gray-50 cursor-pointer select-none"
                  >
                    {/* Timestamp */}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">
                      {formatTimestamp(entry.timestamp)}
                    </td>
                    {/* Action */}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${ACTION_BADGE[entry.action]}`}>
                        {ACTION_LABELS[entry.action]}
                      </span>
                    </td>
                    {/* Meter */}
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {entry.targetMeterId ?? '—'}
                    </td>
                    {/* Stage */}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {entry.stageId ?? '—'}
                    </td>
                    {/* Actor */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-gray-900 font-medium mr-1.5">{entry.actorUid}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[entry.actorRole]}`}>
                        {entry.actorRole}
                      </span>
                    </td>
                    {/* Details */}
                    <td className="px-4 py-3 text-gray-600 max-w-[240px] truncate">
                      {getOneLinerDetails(entry.after)}
                    </td>
                  </tr>
                  {expandedId === entry.id && (
                    <tr key={`${entry.id}-expand`} className="bg-gray-50">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="grid grid-cols-2 gap-8">
                          <KvTable data={entry.before} label="Before" />
                          <KvTable data={entry.after} label="After" />
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
