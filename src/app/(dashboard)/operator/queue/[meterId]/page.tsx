'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/hooks/useAuth'
import {
  saveDraft,
  clearDraft,
  advanceMeter,
  submitStageResult,
  subscribeStageHistory,
  routeToRework,
} from '@/lib/firebase/firestore'
import { STAGES, getStageById, getNextStageId, stationLabel } from '@/lib/stages'
import type { Meter, StageHistoryEntry, ParameterDraft, ParameterResult } from '@/types/meter'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParameterRowState {
  parameterId: string
  name: string
  numericValue: string
  passed: boolean | null // null = not yet toggled
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stationIdToStageId(stationId: string): string {
  return stationId.replace('ws_', 'stage_')
}

// ---------------------------------------------------------------------------
// LoadingSpinner
// ---------------------------------------------------------------------------

function LoadingSpinner() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--color-content-bg)' }}
    >
      <div
        className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
        aria-label="Loading"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// ErrorState
// ---------------------------------------------------------------------------

function ErrorState({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ background: 'var(--color-content-bg)' }}
    >
      <p className="text-gray-500 text-sm">{message}</p>
      <button
        onClick={onBack}
        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
        style={{ background: 'var(--color-primary)', minHeight: '44px' }}
      >
        Back to Queue
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAttemptDate(iso: string): string {
  const d = new Date(iso)
  const day = d.getDate()
  const month = d.toLocaleString('en-GB', { month: 'short' })
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${month}, ${hh}:${mm}`
}

// ---------------------------------------------------------------------------
// PreviousAttempts — expanded by default, shows attempts at the current stage
// ---------------------------------------------------------------------------

interface PreviousAttemptsSectionProps {
  attempts: StageHistoryEntry[]
}

function PreviousAttemptsSection({ attempts }: PreviousAttemptsSectionProps) {
  const [expanded, setExpanded] = useState(true)

  if (attempts.length === 0) return null

  function resultBorderColor(result: StageHistoryEntry['overallResult']): string {
    if (result === 'PASSED') return '#16a34a'
    if (result === 'FAILED_ACCEPTED') return '#d97706'
    return '#dc2626'
  }

  function resultBadge(result: StageHistoryEntry['overallResult']) {
    if (result === 'PASSED') {
      return (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>
          PASSED
        </span>
      )
    }
    if (result === 'FAILED_ACCEPTED') {
      return (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#d97706' }}>
          Passed within tolerance
        </span>
      )
    }
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#dc2626' }}>
        REWORK
      </span>
    )
  }

  // Attempts are stored most-recent-first from subscribeStageHistory; reverse
  // to display chronologically (attempt 1 first)
  const sorted = [...attempts].sort((a, b) => a.attemptNumber - b.attemptNumber)

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--color-card-bg)',
        border: '1px solid var(--color-card-border)',
      }}
    >
      {/* Section header */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 text-left gap-2"
        style={{ minHeight: '44px' }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
          Previous Attempts at this station ({attempts.length})
        </span>
        <svg
          className="w-4 h-4 shrink-0 transition-transform"
          style={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            color: 'var(--color-primary)',
          }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {sorted.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg overflow-hidden"
              style={{
                borderLeft: `4px solid ${resultBorderColor(entry.overallResult)}`,
                background: 'var(--color-content-bg)',
                border: `1px solid var(--color-card-border)`,
                borderLeftWidth: '4px',
                borderLeftColor: resultBorderColor(entry.overallResult),
              }}
            >
              {/* Attempt header */}
              <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-gray-800">
                    Attempt {entry.attemptNumber}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatAttemptDate(entry.submittedAt)}
                  </span>
                  <span className="text-xs text-gray-400">{entry.operatorName}</span>
                </div>
                {resultBadge(entry.overallResult)}
              </div>

              {/* Parameter rows */}
              {entry.parameters.length > 0 && (
                <div className="px-3 pb-2 flex flex-col gap-1">
                  {entry.parameters.map((p) => (
                    <div key={p.parameterId} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-600">{p.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-gray-500">{p.numericValue}</span>
                        {p.passed ? (
                          <span className="text-xs font-bold" style={{ color: '#16a34a' }}>✓</span>
                        ) : (
                          <span className="text-xs font-bold" style={{ color: '#dc2626' }}>✗</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Comment */}
              {entry.comment && (
                <p className="px-3 pb-3 text-xs italic mt-1" style={{ color: '#6b7280' }}>
                  {entry.comment}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PriorFailures — collapsible section
// ---------------------------------------------------------------------------

interface PriorFailure {
  parameterName: string
  stageName: string
}

function PriorFailuresSection({ failures }: { failures: PriorFailure[] }) {
  const [expanded, setExpanded] = useState(false)

  if (failures.length === 0) return null

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--color-card-bg)',
        border: '1px solid #f87171', // red-400
      }}
    >
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 text-left gap-2"
        style={{ minHeight: '44px' }}
      >
        <span className="text-sm font-semibold text-red-600">
          ⚠ Prior failures ({failures.length}) — tap to {expanded ? 'collapse' : 'expand'}
        </span>
        <svg
          className="w-4 h-4 text-red-400 shrink-0 transition-transform"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-3 flex flex-col gap-2">
          {failures.map((f, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-800">{f.parameterName}</span>
              <span className="text-xs text-gray-400 shrink-0">{f.stageName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ParameterRow
// ---------------------------------------------------------------------------

interface ParameterRowProps {
  param: ParameterRowState
  onChange: (parameterId: string, field: 'numericValue' | 'passed', value: string | boolean) => void
  onBlur: () => void
}

function ParameterRow({ param, onChange, onBlur }: ParameterRowProps) {
  return (
    <div
      className="rounded-xl px-4 py-4 flex flex-col gap-3"
      style={{
        background: 'var(--color-card-bg)',
        border: '1px solid var(--color-card-border)',
      }}
    >
      {/* Parameter name */}
      <p className="text-sm font-semibold text-gray-800">{param.name}</p>

      {/* Numeric value input */}
      <input
        type="text"
        inputMode="decimal"
        placeholder="Enter reading"
        value={param.numericValue}
        onChange={(e) => onChange(param.parameterId, 'numericValue', e.target.value)}
        onBlur={onBlur}
        className="w-full rounded-lg px-3 py-2.5 text-base border outline-none transition-colors"
        style={{
          background: 'var(--color-content-bg)',
          border: '1px solid var(--color-card-border)',
          color: '#111827',
          minHeight: '44px',
        }}
      />

      {/* Pass / Fail toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => onChange(param.parameterId, 'passed', true)}
          onBlur={onBlur}
          className="flex-1 rounded-lg text-sm font-semibold border transition-all"
          style={{
            minHeight: '44px',
            background: param.passed === true ? '#16a34a' : 'transparent',
            color: param.passed === true ? '#fff' : '#6b7280',
            borderColor: param.passed === true ? '#16a34a' : '#d1d5db',
          }}
        >
          Pass
        </button>
        <button
          onClick={() => onChange(param.parameterId, 'passed', false)}
          onBlur={onBlur}
          className="flex-1 rounded-lg text-sm font-semibold border transition-all"
          style={{
            minHeight: '44px',
            background: param.passed === false ? '#dc2626' : 'transparent',
            color: param.passed === false ? '#fff' : '#6b7280',
            borderColor: param.passed === false ? '#dc2626' : '#d1d5db',
          }}
        >
          Fail
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReworkModal — station picker bottom sheet
// ---------------------------------------------------------------------------

interface ReworkModalProps {
  currentStageId: string
  onCancel: () => void
  onConfirm: (selectedStageId: string) => void
  submitting: boolean
}

function ReworkModal({ currentStageId, onCancel, onConfirm, submitting }: ReworkModalProps) {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)

  const currentIndex = STAGES.findIndex((s) => s.stageId === currentStageId)
  const upstreamStages = currentIndex > 0 ? STAGES.slice(0, currentIndex) : []

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl shadow-xl"
        style={{
          background: '#fff',
          maxHeight: '70vh',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Send to Rework — Select Station"
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 shrink-0">
          <div
            className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4"
            aria-hidden="true"
          />
          <h2 className="text-base font-bold text-gray-900">Send to Rework — Select Station</h2>
          <p className="text-sm text-gray-500 mt-1">
            Choose which station should receive this meter for rework
          </p>
        </div>

        {/* Station list — scrollable */}
        <div className="flex-1 overflow-y-auto px-5">
          {upstreamStages.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No upstream stations available.</p>
          ) : (
            <div className="flex flex-col divide-y divide-gray-100">
              {upstreamStages.map((stage) => {
                const isSelected = selectedStageId === stage.stageId
                return (
                  <button
                    key={stage.stageId}
                    onClick={() => setSelectedStageId(stage.stageId)}
                    className="w-full flex items-center gap-3 text-left transition-colors"
                    style={{
                      minHeight: '52px',
                      paddingTop: '12px',
                      paddingBottom: '12px',
                      background: isSelected ? 'var(--color-primary)' : 'transparent',
                      borderRadius: isSelected ? '10px' : '0',
                      paddingLeft: isSelected ? '12px' : '0',
                      paddingRight: isSelected ? '12px' : '0',
                      color: isSelected ? '#fff' : '#111827',
                    }}
                  >
                    {isSelected && (
                      <svg
                        className="w-4 h-4 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <span className="text-sm font-medium">{stationLabel(stage.stageId)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="px-5 py-4 flex flex-col gap-2 shrink-0 border-t border-gray-100">
          <button
            onClick={() => {
              if (selectedStageId) onConfirm(selectedStageId)
            }}
            disabled={!selectedStageId || submitting}
            className="w-full rounded-xl text-sm font-semibold text-white transition-all"
            style={{
              minHeight: '48px',
              background: selectedStageId && !submitting ? 'var(--color-primary)' : '#9ca3af',
              opacity: selectedStageId && !submitting ? 1 : 0.6,
              cursor: selectedStageId && !submitting ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'Routing…' : 'Confirm Rework'}
          </button>
          <button
            onClick={onCancel}
            disabled={submitting}
            className="w-full rounded-xl text-sm font-semibold border transition-all"
            style={{
              minHeight: '48px',
              background: 'transparent',
              color: '#6b7280',
              borderColor: '#e5e7eb',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function MeterParameterFormPage() {
  const router = useRouter()
  const params = useParams()
  const meterId = params.meterId as string
  const { user } = useAuth()

  // -- Core state --
  const [meter, setMeter] = useState<Meter | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // -- Operator's stageId (fetched from user doc) --
  const [operatorStageId, setOperatorStageId] = useState<string | null>(null)

  // -- Stage history for prior failures --
  const [stageHistory, setStageHistory] = useState<StageHistoryEntry[]>([])

  // -- Parameter row state --
  const [paramRows, setParamRows] = useState<ParameterRowState[]>([])

  // -- Comment field --
  const [comment, setComment] = useState('')

  // -- Tamper test (stage_08) --
  const [tamperDecision, setTamperDecision] = useState<'will' | 'wont' | null>(null)

  // -- Save draft button feedback --
  const [saveDraftStatus, setSaveDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  // -- Tag as Done submission state --
  const [submitting, setSubmitting] = useState(false)

  // -- Rework modal state --
  const [reworkModalOpen, setReworkModalOpen] = useState(false)
  const [reworkSubmitting, setReworkSubmitting] = useState(false)

  // -- Page opened at (for startedAt field) --
  const pageOpenedAt = useRef<string>(new Date().toISOString())

  // ---------------------------------------------------------------------------
  // Mount: fetch operator stage + meter doc
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!user) return

    let cancelled = false

    async function load() {
      try {
        // 1. Fetch operator's stationId → stageId
        const userSnap = await getDoc(doc(db, 'users', user!.uid))
        if (cancelled) return
        const userData = userSnap.data()
        const stationIds: string[] = userData?.workstationIds ?? []
        const resolvedStageId = stationIds[0] ? stationIdToStageId(stationIds[0]) : null
        setOperatorStageId(resolvedStageId)

        // 2. Fetch meter doc
        const meterSnap = await getDoc(doc(db, 'meters', meterId))
        if (cancelled) return

        if (!meterSnap.exists()) {
          setError('Meter not found.')
          setLoading(false)
          return
        }

        const meterData = { id: meterSnap.id, ...meterSnap.data() } as Meter

        // 3. Validate meter is at operator's station
        if (resolvedStageId && meterData.currentStageId !== resolvedStageId) {
          setError('This meter is not at your station.')
          setLoading(false)
          return
        }

        setMeter(meterData)

        // 4. Resolve stage parameters
        const stage = getStageById(meterData.currentStageId)
        if (!stage) {
          setError('Stage configuration not found.')
          setLoading(false)
          return
        }

        // 5. Pre-fill from draft if stageId matches
        const draft = meterData.draftResults
        const hasDraft = draft && draft.stageId === meterData.currentStageId

        const rows: ParameterRowState[] = stage.parameters.map((p) => {
          if (hasDraft) {
            const draftParam = draft.parameters.find((d) => d.parameterId === p.parameterId)
            if (draftParam) {
              return {
                parameterId: p.parameterId,
                name: p.name,
                numericValue: draftParam.numericValue,
                passed: draftParam.passed,
              }
            }
          }
          return {
            parameterId: p.parameterId,
            name: p.name,
            numericValue: '',
            passed: null,
          }
        })

        setParamRows(rows)
        setLoading(false)
      } catch {
        if (!cancelled) {
          setError('Failed to load meter data.')
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user, meterId])

  // ---------------------------------------------------------------------------
  // Subscribe to stageHistory for prior failures
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!meterId) return
    const unsub = subscribeStageHistory(meterId, (entries) => {
      setStageHistory(entries)
    })
    return unsub
  }, [meterId])

  // ---------------------------------------------------------------------------
  // Derived: prior failures
  // ---------------------------------------------------------------------------

  const priorFailures: PriorFailure[] = React.useMemo(() => {
    const seen = new Set<string>()
    const result: PriorFailure[] = []
    // stageHistory is ordered desc (most recent first)
    for (const entry of stageHistory) {
      const stage = getStageById(entry.stageId)
      const stageName = stage?.name ?? entry.stageId
      for (const param of entry.parameters) {
        if (!param.passed && !seen.has(param.parameterId)) {
          seen.add(param.parameterId)
          result.push({ parameterName: param.name, stageName })
        }
      }
    }
    return result
  }, [stageHistory])

  // ---------------------------------------------------------------------------
  // Derived: previous attempts at the current stage (for rework history view)
  // ---------------------------------------------------------------------------

  const previousAttemptsAtStage: StageHistoryEntry[] = React.useMemo(() => {
    if (!meter) return []
    return stageHistory.filter((e) => e.stageId === meter.currentStageId)
  }, [stageHistory, meter])

  // ---------------------------------------------------------------------------
  // Derived: stage info
  // ---------------------------------------------------------------------------

  const stage = meter ? getStageById(meter.currentStageId) : undefined
  const isTamperStage = stage?.stageId === 'stage_08'
  const isRework = meter?.status === 'rework'

  // ---------------------------------------------------------------------------
  // Derived: upstream stages for rework routing
  // ---------------------------------------------------------------------------

  const upstreamStages = React.useMemo(() => {
    if (!meter) return []
    const currentIndex = STAGES.findIndex((s) => s.stageId === meter.currentStageId)
    if (currentIndex <= 0) return []
    return STAGES.slice(0, currentIndex)
  }, [meter])

  const hasUpstreamStages = upstreamStages.length > 0

  // ---------------------------------------------------------------------------
  // Derived: failure counts & threshold check
  // ---------------------------------------------------------------------------

  const { failedCount, toggledCount, thresholdExceeded } = React.useMemo(() => {
    // Only count parameters that have been toggled (passed is not null)
    const toggled = paramRows.filter((p) => p.passed !== null)
    const failed = toggled.filter((p) => p.passed === false)

    const fc = failed.length
    const tc = toggled.length

    // Threshold only applies when ALL params have been toggled
    const allToggled = paramRows.length > 0 && tc === paramRows.length
    let exceeded = false
    if (allToggled && tc > 0) {
      exceeded = fc === tc || fc / tc >= 0.5
    }

    return { failedCount: fc, toggledCount: tc, thresholdExceeded: exceeded }
  }, [paramRows])

  // ---------------------------------------------------------------------------
  // canSubmit — all params filled + comment non-empty
  // ---------------------------------------------------------------------------

  const canSubmit = React.useMemo(() => {
    if (!comment.trim()) return false

    // Tamper test: if "will not perform" selected, no params needed
    if (isTamperStage && tamperDecision === 'wont') return true

    // Otherwise all params need a value and a pass/fail selection
    if (paramRows.length === 0) return false
    return paramRows.every((p) => p.numericValue.trim() !== '' && p.passed !== null)
  }, [comment, isTamperStage, tamperDecision, paramRows])

  // "Tag as Done" is further gated by threshold check
  const canTagAsDone = canSubmit && !thresholdExceeded

  // ---------------------------------------------------------------------------
  // Build current draft object
  // ---------------------------------------------------------------------------

  const buildDraft = useCallback((): ParameterDraft => {
    return {
      stageId: meter!.currentStageId,
      parameters: paramRows.map((p) => ({
        parameterId: p.parameterId,
        numericValue: p.numericValue,
        passed: p.passed,
      })),
      savedAt: new Date().toISOString(),
    }
  }, [meter, paramRows])

  // ---------------------------------------------------------------------------
  // Auto-save on blur
  // ---------------------------------------------------------------------------

  const handleAutoSave = useCallback(async () => {
    if (!meter) return
    try {
      await saveDraft(meterId, buildDraft())
    } catch {
      // silent — auto-save failures shouldn't interrupt the user
    }
  }, [meter, meterId, buildDraft])

  // ---------------------------------------------------------------------------
  // Manual Save Draft button
  // ---------------------------------------------------------------------------

  const handleSaveDraft = useCallback(async () => {
    if (!meter || saveDraftStatus === 'saving') return
    setSaveDraftStatus('saving')
    try {
      await saveDraft(meterId, buildDraft())
      setSaveDraftStatus('saved')
      setTimeout(() => setSaveDraftStatus('idle'), 1500)
    } catch {
      setSaveDraftStatus('idle')
    }
  }, [meter, meterId, buildDraft, saveDraftStatus])

  // ---------------------------------------------------------------------------
  // Parameter change handler
  // ---------------------------------------------------------------------------

  const handleParamChange = useCallback(
    (parameterId: string, field: 'numericValue' | 'passed', value: string | boolean) => {
      setParamRows((prev) =>
        prev.map((p) =>
          p.parameterId === parameterId ? { ...p, [field]: value } : p
        )
      )
    },
    []
  )

  // ---------------------------------------------------------------------------
  // Tag as Done submission
  // ---------------------------------------------------------------------------

  const handleTagAsDone = useCallback(async () => {
    if (!meter || !user || !canTagAsDone || submitting) return
    setSubmitting(true)

    try {
      const currentStageId = meter.currentStageId
      const stageDef = getStageById(currentStageId)
      const stageName = stageDef?.name ?? currentStageId
      const nextStageId = getNextStageId(currentStageId)

      // Build parameters array
      let parameters: ParameterResult[] = []
      let computedFailedCount = 0
      let totalCount = 0

      if (isTamperStage && tamperDecision === 'wont') {
        // Will not perform: empty params
        parameters = []
        computedFailedCount = 0
        totalCount = 0
      } else {
        parameters = paramRows.map((p) => ({
          parameterId: p.parameterId,
          name: p.name,
          numericValue: p.numericValue,
          passed: p.passed === true,
        }))
        computedFailedCount = parameters.filter((p) => !p.passed).length
        totalCount = parameters.length
      }

      const overallResult: 'PASSED' | 'FAILED_ACCEPTED' =
        computedFailedCount === 0 ? 'PASSED' : 'FAILED_ACCEPTED'

      const attemptsAtThisStage = stageHistory.filter((e) => e.stageId === currentStageId).length
      const attemptNumber = attemptsAtThisStage + 1

      await submitStageResult(meterId, {
        stageId: currentStageId,
        stageName,
        operatorId: user.uid,
        operatorName: user.displayName ?? user.email ?? '',
        attemptNumber,
        parameters,
        failedCount: computedFailedCount,
        totalCount,
        overallResult,
        comment: comment.trim(),
        startedAt: pageOpenedAt.current,
        submittedAt: new Date().toISOString(),
      })

      await clearDraft(meterId)
      await advanceMeter(meterId, nextStageId)

      router.replace('/operator')
    } catch {
      setSubmitting(false)
    }
  }, [
    meter,
    user,
    canTagAsDone,
    submitting,
    isTamperStage,
    tamperDecision,
    paramRows,
    stageHistory,
    meterId,
    comment,
    router,
  ])

  // ---------------------------------------------------------------------------
  // Tag as Rework — confirm handler (called from modal)
  // ---------------------------------------------------------------------------

  const handleConfirmRework = useCallback(async (selectedStageId: string) => {
    if (!meter || !user || !canSubmit || reworkSubmitting) return
    setReworkSubmitting(true)

    try {
      const currentStageId = meter.currentStageId
      const stageDef = getStageById(currentStageId)
      const stageName = stageDef?.name ?? currentStageId

      // Build parameters array
      const parameters: ParameterResult[] = paramRows.map((p) => ({
        parameterId: p.parameterId,
        name: p.name,
        numericValue: p.numericValue,
        passed: p.passed === true,
      }))
      const computedFailedCount = parameters.filter((p) => !p.passed).length
      const totalCount = parameters.length

      const attemptsAtThisStage = stageHistory.filter((e) => e.stageId === currentStageId).length
      const attemptNumber = attemptsAtThisStage + 1

      // 1. Submit stage result with REWORK outcome
      await submitStageResult(meterId, {
        stageId: currentStageId,
        stageName,
        operatorId: user.uid,
        operatorName: user.displayName ?? user.email ?? '',
        attemptNumber,
        parameters,
        failedCount: computedFailedCount,
        totalCount,
        overallResult: 'REWORK',
        reworkTargetStageId: selectedStageId,
        comment: comment.trim(),
        startedAt: pageOpenedAt.current,
        submittedAt: new Date().toISOString(),
      })

      // 2. Clear draft
      await clearDraft(meterId)

      // 3. Route meter to rework target stage
      await routeToRework(meterId, selectedStageId, currentStageId)

      // 4. Navigate back to queue
      router.replace('/operator')
    } catch {
      setReworkSubmitting(false)
    }
  }, [
    meter,
    user,
    canSubmit,
    reworkSubmitting,
    paramRows,
    stageHistory,
    meterId,
    comment,
    router,
  ])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) return <LoadingSpinner />

  if (error || !meter || !stage) {
    return (
      <ErrorState
        message={error ?? 'Meter not found.'}
        onBack={() => router.replace('/operator')}
      />
    )
  }

  const headerTitle = meter.serialNumber
  const stationName = stationLabel(meter.currentStageId)

  const saveDraftLabel =
    saveDraftStatus === 'saving'
      ? 'Saving…'
      : saveDraftStatus === 'saved'
      ? 'Saved ✓'
      : 'Save Draft'

  // Suppress unused variable warning — operatorStageId is kept for potential
  // future use (e.g. displaying the operator's station in UI)
  void operatorStageId

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--color-content-bg)' }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Rework station picker modal                                          */}
      {/* ------------------------------------------------------------------ */}
      {reworkModalOpen && (
        <ReworkModal
          currentStageId={meter.currentStageId}
          onCancel={() => {
            if (!reworkSubmitting) setReworkModalOpen(false)
          }}
          onConfirm={handleConfirmRework}
          submitting={reworkSubmitting}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="sticky top-0 z-40 px-4 flex items-center gap-3 border-b"
        style={{
          background: 'var(--color-card-bg)',
          borderColor: 'var(--color-card-border)',
          minHeight: '56px',
        }}
      >
        <button
          onClick={() => router.replace('/operator')}
          className="flex items-center justify-center rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
          style={{ width: '44px', height: '44px' }}
          aria-label="Back to queue"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <h1 className="flex-1 text-base font-semibold text-gray-900 truncate">
          {headerTitle}
        </h1>

        {isRework && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-600 text-white shrink-0">
            REWORK
          </span>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Scrollable body                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex flex-col px-4 py-4 gap-4 max-w-2xl mx-auto w-full pb-72">

        {/* Meter identity strip */}
        <div
          className="rounded-xl px-4 py-4 flex flex-col gap-1"
          style={{
            background: 'var(--color-card-bg)',
            border: '1px solid var(--color-card-border)',
          }}
        >
          <p className="text-xl font-bold text-gray-900">{meter.serialNumber}</p>
          <p className="text-sm text-gray-500">{meter.meterType}</p>
          <p className="text-xs text-gray-400 mt-0.5">{stationName}</p>
        </div>

        {/* Previous attempts at this station (rework history) — expanded by default */}
        <PreviousAttemptsSection attempts={previousAttemptsAtStage} />

        {/* Prior failures (collapsible) */}
        <PriorFailuresSection failures={priorFailures} />

        {/* ---------------------------------------------------------------- */}
        {/* Tamper Test special case (stage_08)                              */}
        {/* ---------------------------------------------------------------- */}
        {isTamperStage && (
          <div
            className="rounded-xl px-4 py-4 flex flex-col gap-3"
            style={{
              background: 'var(--color-card-bg)',
              border: '1px solid var(--color-card-border)',
            }}
          >
            <p className="text-sm font-semibold text-gray-800">Tamper Test Decision</p>
            <div className="flex gap-2">
              <button
                onClick={() => setTamperDecision('will')}
                className="flex-1 rounded-lg text-sm font-semibold border transition-all"
                style={{
                  minHeight: '44px',
                  background: tamperDecision === 'will' ? 'var(--color-primary)' : 'transparent',
                  color: tamperDecision === 'will' ? '#fff' : '#6b7280',
                  borderColor: tamperDecision === 'will' ? 'var(--color-primary)' : '#d1d5db',
                }}
              >
                Will perform Tamper Test
              </button>
              <button
                onClick={() => setTamperDecision('wont')}
                className="flex-1 rounded-lg text-sm font-semibold border transition-all"
                style={{
                  minHeight: '44px',
                  background: tamperDecision === 'wont' ? '#6b7280' : 'transparent',
                  color: tamperDecision === 'wont' ? '#fff' : '#6b7280',
                  borderColor: tamperDecision === 'wont' ? '#6b7280' : '#d1d5db',
                }}
              >
                Will not perform
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Parameter list                                                    */}
        {/* ---------------------------------------------------------------- */}
        {(!isTamperStage || tamperDecision === 'will' || tamperDecision === null) && (
          <div className="flex flex-col gap-3">
            {paramRows.map((param) => (
              <ParameterRow
                key={param.parameterId}
                param={param}
                onChange={handleParamChange}
                onBlur={handleAutoSave}
              />
            ))}
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Comment field                                                     */}
        {/* ---------------------------------------------------------------- */}
        <div
          className="rounded-xl px-4 py-4 flex flex-col gap-2"
          style={{
            background: 'var(--color-card-bg)',
            border: '1px solid var(--color-card-border)',
          }}
        >
          <label className="text-sm font-semibold text-gray-800" htmlFor="observation-notes">
            Observation / Notes
          </label>
          <textarea
            id="observation-notes"
            rows={3}
            placeholder="Required before submitting — add any observations or notes"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onBlur={handleAutoSave}
            className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none resize-none transition-colors"
            style={{
              background: 'var(--color-content-bg)',
              border: '1px solid var(--color-card-border)',
              color: '#111827',
              minHeight: '80px',
            }}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Sticky action buttons                                               */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-4 py-4 flex flex-col gap-2 max-w-2xl mx-auto"
        style={{
          background: 'var(--color-content-bg)',
          borderTop: '1px solid var(--color-card-border)',
        }}
      >
        {/* Save Draft */}
        <button
          onClick={handleSaveDraft}
          disabled={saveDraftStatus === 'saving'}
          className="w-full rounded-xl text-sm font-semibold border transition-all"
          style={{
            minHeight: '48px',
            background: 'transparent',
            color: saveDraftStatus === 'saved' ? '#16a34a' : 'var(--color-primary)',
            borderColor: saveDraftStatus === 'saved' ? '#16a34a' : 'var(--color-primary)',
            opacity: saveDraftStatus === 'saving' ? 0.6 : 1,
          }}
        >
          {saveDraftLabel}
        </button>

        {/* Tag as Done */}
        <div className="flex flex-col gap-1">
          <button
            onClick={handleTagAsDone}
            disabled={!canTagAsDone || submitting}
            className="w-full rounded-xl text-sm font-semibold text-white transition-all"
            style={{
              minHeight: '48px',
              background: canTagAsDone && !submitting ? '#16a34a' : '#9ca3af',
              opacity: canTagAsDone && !submitting ? 1 : 0.6,
              cursor: canTagAsDone && !submitting ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'Submitting…' : 'Tag as Done'}
          </button>

          {/* Threshold warning — shown only when threshold is exceeded */}
          {thresholdExceeded && (
            <p className="text-xs text-red-600 text-center px-2">
              Too many failures — meter must be sent for rework
            </p>
          )}
        </div>

        {/* Tag as Rework */}
        {hasUpstreamStages ? (
          <button
            onClick={() => setReworkModalOpen(true)}
            disabled={!canSubmit || submitting || reworkSubmitting}
            className="w-full rounded-xl text-sm font-semibold border transition-all"
            style={{
              minHeight: '48px',
              background: 'transparent',
              color: canSubmit && !submitting && !reworkSubmitting ? '#dc2626' : '#9ca3af',
              borderColor: canSubmit && !submitting && !reworkSubmitting ? '#dc2626' : '#e5e7eb',
              cursor: canSubmit && !submitting && !reworkSubmitting ? 'pointer' : 'not-allowed',
              opacity: canSubmit && !submitting && !reworkSubmitting ? 1 : 0.6,
            }}
          >
            {reworkSubmitting ? 'Routing…' : 'Tag as Rework'}
          </button>
        ) : (
          <button
            disabled
            className="w-full rounded-xl text-sm font-medium border"
            style={{
              minHeight: '48px',
              background: 'transparent',
              color: '#9ca3af',
              borderColor: '#e5e7eb',
              cursor: 'not-allowed',
            }}
            title="No upstream stations available"
          >
            Tag as Rework (no upstream stations)
          </button>
        )}
      </div>
    </div>
  )
}
