'use client'

import { useState, useMemo, useEffect } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ParameterResult = 'OK' | 'NOT OK' | 'REMARK'

interface StageParameter {
  parameterId: string
  name: string
}

interface Stage {
  stageId: string
  name: string
  parameters: StageParameter[]
  isTamperTestStage?: boolean
}

interface ParameterEntry {
  value: string
  result: ParameterResult | null
}

type ParameterMap = Record<string, ParameterEntry>

interface DraftResults {
  parameters: Record<string, { value: string; result: string }>
  savedAt: string
}

interface QueueMeter {
  id: string
  serialNumber: string
  meterType: string
  status: 'queued' | 'rework'
  currentStageId: string
  draftResults: DraftResults | null
}

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const STAGES: Stage[] = [
  {
    stageId: 'stage_01',
    name: 'Incoming Inspection / Stores',
    parameters: [
      { parameterId: 'smd_components', name: 'SMD Components' },
      { parameterId: 'th_components', name: 'TH Components' },
      { parameterId: 'relay_shunt', name: 'Relay & Shunt' },
      { parameterId: 'battery', name: 'Battery' },
      { parameterId: 'cabinet', name: 'Cabinet' },
      { parameterId: 'nameplate', name: 'Nameplate' },
      { parameterId: 'screw_sp', name: 'Screw & SP. Components' },
      { parameterId: 'outer_box', name: 'Outer Box' },
    ],
  },
  {
    stageId: 'stage_02',
    name: 'SMD, TH Soldering & Testing / EMS',
    parameters: [
      { parameterId: 'smd_soldering', name: 'SMD Soldering' },
      { parameterId: 'aoi_testing', name: 'AOI Testing' },
      { parameterId: 'th_soldering', name: 'TH Soldering' },
      { parameterId: 'ict_testing', name: 'ICT Testing' },
      { parameterId: 'glueing_th', name: 'Glueing on TH' },
      { parameterId: 'nic_card_testing', name: 'NIC Card Testing' },
    ],
  },
  {
    stageId: 'stage_03',
    name: 'PCBA Incoming / Store',
    parameters: [
      { parameterId: 'visual_inspection', name: 'Visual Inspection' },
      { parameterId: 'passive_testing', name: 'Passive Testing' },
      { parameterId: 'power_supply_test', name: 'Power Supply Test' },
    ],
  },
  {
    stageId: 'stage_04',
    name: 'Base Assembly',
    parameters: [
      { parameterId: 'relay_terminal_assembly', name: 'Relay with Terminal Block Assembly' },
      { parameterId: 'base_relay_assembly', name: 'Base with Relay Assembly' },
      { parameterId: 'pcba_spring_soldering', name: 'PCBA & Spring on Base Assembly Soldering' },
    ],
  },
  {
    stageId: 'stage_05',
    name: 'Functional Testing',
    parameters: [
      { parameterId: 'programming', name: 'Programming' },
      { parameterId: 'scrolling_parameter', name: 'Scrolling Parameter' },
      { parameterId: 'push_button', name: 'Push Button Parameter' },
      { parameterId: 'relay_functional', name: 'Relay Functional Testing' },
    ],
  },
  {
    stageId: 'stage_06',
    name: 'Cover Assembly',
    parameters: [
      { parameterId: 'top_cover', name: 'Top Cover Assembly' },
      { parameterId: 'nic_insertion', name: 'NIC Card Insertion' },
    ],
  },
  {
    stageId: 'stage_07',
    name: 'Error Compensation',
    parameters: [
      { parameterId: 'error_testing', name: 'Error Testing' },
      { parameterId: 'compensation', name: 'Compensation' },
      { parameterId: 'tcpip_testing', name: 'TCP/IP Testing' },
      { parameterId: 'mobile_app_testing', name: 'Mobile App Testing' },
      { parameterId: 'optical_port_insertion', name: 'Optical Port Data Insertion (RTC, Date & Time)' },
    ],
  },
  {
    stageId: 'stage_08',
    name: 'Tamper Test',
    isTamperTestStage: true,
    parameters: [
      { parameterId: 'tamper_38', name: '38 Tamper Test' },
      { parameterId: 'magnetic_tamper', name: 'Magnetic Tamper Test' },
      { parameterId: 'esd_35kv', name: '35KV ESD Test' },
    ],
  },
  {
    stageId: 'stage_09',
    name: 'HV-IR Test',
    parameters: [
      { parameterId: 'ac_high_voltage', name: 'AC High Voltage Test' },
      { parameterId: 'insulation_test', name: 'Insulation Test' },
    ],
  },
  {
    stageId: 'stage_10',
    name: 'Soaking Test',
    parameters: [{ parameterId: 'meter_test', name: 'Meter Test' }],
  },
  {
    stageId: 'stage_11',
    name: 'Final Testing',
    parameters: [
      { parameterId: 'meter_constant', name: 'Meter Constant Test' },
      { parameterId: 'repeatability_error', name: 'Repeatability of Error Test' },
      { parameterId: 'no_load', name: 'No Load Condition Test' },
      { parameterId: 'starting_current', name: 'Starting Current Test' },
      { parameterId: 'limits_of_error', name: 'Limits of Error Test' },
    ],
  },
  {
    stageId: 'stage_12',
    name: 'Sealing',
    parameters: [
      { parameterId: 'sealing_adhesive', name: 'Sealing Adhesive' },
      { parameterId: 'hologram_seal', name: 'Hologram Seal' },
      { parameterId: 'plastic_seal', name: 'Plastic Seal' },
    ],
  },
  {
    stageId: 'stage_13',
    name: 'Packing',
    parameters: [
      { parameterId: 'label_sticker', name: 'Label Sticker' },
      { parameterId: 'box_packing', name: 'Box Packing' },
    ],
  },
]

const MOCK_STAGE_ID = 'stage_01'

const MOCK_QUEUE: QueueMeter[] = [
  {
    id: 'WO-2026-00001',
    serialNumber: 'WO-2026-00001',
    meterType: 'EM-400',
    status: 'rework',
    currentStageId: 'stage_01',
    draftResults: null,
  },
  {
    id: 'WO-2026-00002',
    serialNumber: 'WO-2026-00002',
    meterType: 'EM-400',
    status: 'queued',
    currentStageId: 'stage_01',
    draftResults: {
      parameters: {
        smd_components: { value: '100', result: 'OK' },
        th_components: { value: '50', result: 'NOT OK' },
      },
      savedAt: new Date(Date.now() - 7200000).toISOString(),
    },
  },
  {
    id: 'WO-2026-00003',
    serialNumber: 'WO-2026-00003',
    meterType: 'EM-500',
    status: 'queued',
    currentStageId: 'stage_01',
    draftResults: null,
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`
  const diffHrs = Math.floor(diffMins / 60)
  return `${diffHrs} hr${diffHrs !== 1 ? 's' : ''} ago`
}

function buildInitialParameters(stage: Stage, draft: DraftResults | null): ParameterMap {
  const map: ParameterMap = {}
  for (const p of stage.parameters) {
    const saved = draft?.parameters[p.parameterId]
    map[p.parameterId] = {
      value: saved?.value ?? '',
      result: (saved?.result as ParameterResult | null) ?? null,
    }
  }
  return map
}

// ---------------------------------------------------------------------------
// ParameterRow
// ---------------------------------------------------------------------------

interface ParameterRowProps {
  param: StageParameter
  entry: ParameterEntry
  onChange: (parameterId: string, entry: ParameterEntry) => void
}

function ParameterRow({ param, entry, onChange }: ParameterRowProps) {
  const setResult = (result: ParameterResult) => {
    onChange(param.parameterId, { ...entry, result: entry.result === result ? null : result })
  }
  const setValue = (value: string) => {
    onChange(param.parameterId, { ...entry, value })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-700 mb-3">{param.name}</p>

      {/* Value input */}
      <input
        type="text"
        value={entry.value}
        onChange={e => setValue(e.target.value)}
        placeholder="Enter value / observation..."
        className="w-full text-lg border border-gray-300 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-400 text-gray-900"
      />

      {/* Result buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setResult('OK')}
          className={`flex-1 min-h-[48px] min-w-[80px] rounded-lg text-sm font-bold transition-all border-2 ${
            entry.result === 'OK'
              ? 'bg-green-500 text-white border-green-500'
              : 'bg-white text-green-600 border-green-500 hover:bg-green-50'
          }`}
        >
          ✓ OK
        </button>
        <button
          type="button"
          onClick={() => setResult('NOT OK')}
          className={`flex-1 min-h-[48px] min-w-[80px] rounded-lg text-sm font-bold transition-all border-2 ${
            entry.result === 'NOT OK'
              ? 'bg-red-500 text-white border-red-500'
              : 'bg-white text-red-600 border-red-500 hover:bg-red-50'
          }`}
        >
          ✗ N/OK
        </button>
        <button
          type="button"
          onClick={() => setResult('REMARK')}
          className={`flex-1 min-h-[48px] min-w-[80px] rounded-lg text-sm font-bold transition-all border-2 ${
            entry.result === 'REMARK'
              ? 'bg-amber-400 text-white border-amber-400'
              : 'bg-white text-amber-600 border-amber-400 hover:bg-amber-50'
          }`}
        >
          ★ REM
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// NotOkOverrideModal
// ---------------------------------------------------------------------------

interface NotOkOverrideModalProps {
  notOkParams: string[]
  onConfirm: (comment: string) => void
  onCancel: () => void
}

function NotOkOverrideModal({ notOkParams, onConfirm, onCancel }: NotOkOverrideModalProps) {
  const [comment, setComment] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">⚠️</span>
          <h2 className="text-lg font-bold text-red-600">NOT OK Parameters Detected</h2>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          The following parameters are marked <strong>NOT OK</strong>. A comment is required before
          submitting:
        </p>
        <ul className="mb-4 space-y-1">
          {notOkParams.map(name => (
            <li key={name} className="text-sm text-red-600 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              {name}
            </li>
          ))}
        </ul>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Describe the issue and action taken..."
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 text-gray-900 placeholder:text-gray-400 resize-none mb-4"
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={comment.trim().length === 0}
            onClick={() => onConfirm(comment.trim())}
            className="flex-1 py-3 rounded-lg bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Anyway
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReworkTagModal
// ---------------------------------------------------------------------------

interface ReworkTagModalProps {
  currentStageId: string
  onConfirm: (targetStageId: string) => void
  onCancel: () => void
}

function ReworkTagModal({ currentStageId, onConfirm, onCancel }: ReworkTagModalProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const currentIndex = STAGES.findIndex(s => s.stageId === currentStageId)
  const priorStages = STAGES.slice(0, currentIndex)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">↩</span>
          <h2 className="text-lg font-bold text-amber-600">Flag for Rework</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Select the stage to which this meter should be sent back:
        </p>
        {priorStages.length === 0 ? (
          <p className="text-sm text-gray-500 italic mb-4">No prior stages available.</p>
        ) : (
          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            {priorStages.map(stage => (
              <button
                key={stage.stageId}
                type="button"
                onClick={() => setSelected(stage.stageId)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  selected === stage.stageId
                    ? 'border-amber-400 bg-amber-50 text-amber-800'
                    : 'border-gray-200 text-gray-700 hover:border-amber-300 hover:bg-amber-50'
                }`}
              >
                {stage.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selected === null && priorStages.length > 0}
            onClick={() => {
              if (selected) onConfirm(selected)
            }}
            className="flex-1 py-3 rounded-lg bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm Rework
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TamperTestGate
// ---------------------------------------------------------------------------

interface TamperTestGateProps {
  decision: 'will' | 'will_not' | null
  onDecide: (d: 'will' | 'will_not') => void
}

function TamperTestGate({ decision, onDecide }: TamperTestGateProps) {
  return (
    <div className="mb-6">
      <p className="text-sm font-semibold text-gray-700 mb-3">Tamper Test decision for this meter:</p>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => onDecide('will')}
          className={`w-full py-5 rounded-xl border-2 text-base font-bold transition-all ${
            decision === 'will'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-blue-700 border-blue-400 hover:bg-blue-50'
          }`}
        >
          ✓ Will perform Tamper Test for this meter
        </button>
        <button
          type="button"
          onClick={() => onDecide('will_not')}
          className={`w-full py-5 rounded-xl border-2 text-base font-bold transition-all ${
            decision === 'will_not'
              ? 'bg-gray-500 text-white border-gray-500'
              : 'bg-white text-gray-600 border-gray-400 hover:bg-gray-50'
          }`}
        >
          ✗ Will NOT perform Tamper Test
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StageExecutionForm
// ---------------------------------------------------------------------------

interface StageExecutionFormProps {
  meter: QueueMeter
  onBack: () => void
  onQueueUpdate: (updated: QueueMeter) => void
}

function StageExecutionForm({ meter, onBack, onQueueUpdate }: StageExecutionFormProps) {
  const stage = STAGES.find(s => s.stageId === meter.currentStageId)!
  const [parameters, setParameters] = useState<ParameterMap>(() =>
    buildInitialParameters(stage, meter.draftResults)
  )
  const [tamperDecision, setTamperDecision] = useState<'will' | 'will_not' | null>(null)
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(
    meter.draftResults?.savedAt ?? null
  )
  const [showDraftBanner, setShowDraftBanner] = useState(!!meter.draftResults)
  const [showNotOkModal, setShowNotOkModal] = useState(false)
  const [showReworkModal, setShowReworkModal] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [validationMsg, setValidationMsg] = useState<string | null>(null)
  const [draftFlash, setDraftFlash] = useState(false)

  const totalParams = stage.parameters.length
  const isTamper = !!stage.isTamperTestStage
  const skipParams = isTamper && tamperDecision === 'will_not'

  const filledCount = useMemo(() => {
    if (skipParams) return totalParams
    return stage.parameters.filter(p => {
      const e = parameters[p.parameterId]
      return e && e.value.trim() !== '' && e.result !== null
    }).length
  }, [parameters, stage.parameters, skipParams, totalParams])

  const isAllFilled = filledCount === totalParams

  const notOkParams = useMemo(() => {
    if (skipParams) return []
    return stage.parameters
      .filter(p => parameters[p.parameterId]?.result === 'NOT OK')
      .map(p => p.name)
  }, [parameters, stage.parameters, skipParams])

  const handleParamChange = (parameterId: string, entry: ParameterEntry) => {
    setParameters(prev => ({ ...prev, [parameterId]: entry }))
    setValidationMsg(null)
  }

  const handleSaveDraft = () => {
    const savedAt = new Date().toISOString()
    setDraftSavedAt(savedAt)
    setDraftFlash(true)
    setTimeout(() => setDraftFlash(false), 2000)
    const updatedDraft: DraftResults = {
      parameters: Object.fromEntries(
        Object.entries(parameters).map(([k, v]) => [
          k,
          { value: v.value, result: v.result ?? '' },
        ])
      ),
      savedAt,
    }
    onQueueUpdate({ ...meter, draftResults: updatedDraft })
    console.log('[Draft saved]', updatedDraft)
  }

  const handleSubmit = () => {
    if (!isAllFilled && !skipParams) {
      setValidationMsg(`Please fill all ${totalParams} parameters before submitting.`)
      return
    }
    if (notOkParams.length > 0) {
      setShowNotOkModal(true)
      return
    }
    doSubmit(null)
  }

  const doSubmit = (notOkComment: string | null) => {
    const result = {
      meterId: meter.id,
      stageId: stage.stageId,
      parameters: skipParams ? {} : parameters,
      tamperSkipped: skipParams,
      notOkComment,
      submittedAt: new Date().toISOString(),
    }
    console.log('[Stage submitted]', result)
    setSubmitted(true)
  }

  const handleRework = () => {
    if (notOkParams.length === 0 && !isAllFilled) {
      setValidationMsg('Fill at least one NOT OK parameter to flag for rework.')
      return
    }
    setShowReworkModal(true)
  }

  const doRework = (targetStageId: string) => {
    const result = {
      meterId: meter.id,
      fromStageId: stage.stageId,
      toStageId: targetStageId,
      parameters,
      taggedAt: new Date().toISOString(),
    }
    console.log('[Rework tagged]', result)
    setShowReworkModal(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Stage Recorded</h2>
        <p className="text-gray-500 mb-8">
          {meter.serialNumber} — {stage.name}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-8 py-3 rounded-xl bg-blue-600 text-white font-semibold text-base hover:bg-blue-700 transition-colors"
        >
          Back to Queue
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-blue-600 font-semibold text-sm hover:text-blue-800 transition-colors"
          >
            <span className="text-lg">←</span> Back
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-base truncate">{meter.serialNumber}</p>
            <p className="text-xs text-gray-500 truncate">
              {meter.meterType} · {stage.name}
            </p>
          </div>
        </div>
      </div>

      {/* Draft banner */}
      {showDraftBanner && draftSavedAt && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-amber-600 text-base">⚠️</span>
            <p className="text-xs font-medium text-amber-800">
              DRAFT SAVED — Tap to resume from where you left off · saved {timeAgo(draftSavedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDraftBanner(false)}
            className="text-amber-500 hover:text-amber-700 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 px-4 py-4 space-y-4 overflow-auto">
        {/* Tamper gate */}
        {isTamper && (
          <TamperTestGate decision={tamperDecision} onDecide={setTamperDecision} />
        )}

        {/* Parameters */}
        {!skipParams && (!isTamper || tamperDecision === 'will') && (
          <>
            {stage.parameters.map(param => (
              <ParameterRow
                key={param.parameterId}
                param={param}
                entry={parameters[param.parameterId]}
                onChange={handleParamChange}
              />
            ))}
          </>
        )}

        {skipParams && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
            <p className="text-gray-500 text-sm">
              Tamper Test skipped for this meter. Submit to proceed.
            </p>
          </div>
        )}

        {isTamper && tamperDecision === null && (
          <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-center">
            <p className="text-blue-600 text-sm">
              Select an option above to continue.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 px-4 py-4 sticky bottom-0">
        {/* Progress */}
        {!skipParams && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500">Progress</span>
              <span className="text-xs font-bold text-gray-700">
                {filledCount} / {totalParams} parameters filled
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${totalParams > 0 ? (filledCount / totalParams) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Validation message */}
        {validationMsg && (
          <p className="text-red-500 text-xs mb-2 font-medium">{validationMsg}</p>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={skipParams}
            className={`py-3 rounded-xl text-sm font-bold transition-all border-2 border-blue-400 ${
              skipParams
                ? 'opacity-40 cursor-not-allowed bg-white text-blue-400'
                : draftFlash
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-blue-600 hover:bg-blue-50'
            }`}
          >
            {draftFlash ? '✓ Saved!' : '💾 Save Draft'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isTamper ? tamperDecision === null : !isAllFilled}
            className="py-3 rounded-xl text-sm font-bold transition-all bg-green-500 text-white hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ✓ Submit
          </button>
          <button
            type="button"
            onClick={handleRework}
            disabled={skipParams || !isAllFilled}
            className="py-3 rounded-xl text-sm font-bold transition-all bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ↩ Rework
          </button>
        </div>
      </div>

      {/* Modals */}
      {showNotOkModal && (
        <NotOkOverrideModal
          notOkParams={notOkParams}
          onConfirm={comment => {
            setShowNotOkModal(false)
            doSubmit(comment)
          }}
          onCancel={() => setShowNotOkModal(false)}
        />
      )}
      {showReworkModal && (
        <ReworkTagModal
          currentStageId={meter.currentStageId}
          onConfirm={doRework}
          onCancel={() => setShowReworkModal(false)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MeterQueueList
// ---------------------------------------------------------------------------

interface MeterQueueListProps {
  queue: QueueMeter[]
  stageName: string
  onSelect: (meter: QueueMeter) => void
}

function MeterQueueList({ queue, stageName, onSelect }: MeterQueueListProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return queue
    return queue.filter(
      m =>
        m.serialNumber.toLowerCase().includes(q) ||
        m.meterType.toLowerCase().includes(q)
    )
  }, [queue, search])

  return (
    <div className="flex flex-col h-full">
      {/* Station header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-lg font-bold text-gray-900">Station: {stageName}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {queue.length} meter{queue.length !== 1 ? 's' : ''} waiting
        </p>
      </div>

      {/* Search / scan input */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base select-none">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Scan or type serial number..."
            className="w-full pl-9 pr-4 py-3 text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-900 placeholder:text-gray-400 bg-gray-50"
          />
        </div>
      </div>

      {/* Meter cards */}
      <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No meters found.</div>
        ) : (
          filtered.map(meter => (
            <button
              key={meter.id}
              type="button"
              onClick={() => onSelect(meter)}
              className={`w-full text-left bg-white rounded-xl shadow-sm border-l-4 border border-gray-200 px-4 py-4 min-h-[72px] transition-all hover:shadow-md active:scale-[0.99] ${
                meter.status === 'rework'
                  ? 'border-l-yellow-400'
                  : 'border-l-green-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl" aria-hidden>
                    {meter.status === 'rework' ? '🟡' : '🟢'}
                  </span>
                  <div>
                    <p className="font-bold text-gray-900 text-base">{meter.serialNumber}</p>
                    <p className="text-sm text-gray-500">Meter Type: {meter.meterType}</p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full ${
                      meter.status === 'rework'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {meter.status.toUpperCase()}
                  </span>
                  {meter.draftResults && (
                    <span className="text-xs text-amber-600 font-medium">
                      ⚠️ Draft saved
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// QueuePage (top-level)
// ---------------------------------------------------------------------------

export default function QueuePage() {
  const [queue, setQueue] = useState<QueueMeter[]>(MOCK_QUEUE)
  const [selectedMeter, setSelectedMeter] = useState<QueueMeter | null>(null)

  const currentStage = STAGES.find(s => s.stageId === MOCK_STAGE_ID)!

  const handleQueueUpdate = (updated: QueueMeter) => {
    setQueue(prev => prev.map(m => (m.id === updated.id ? updated : m)))
  }

  // Keep selectedMeter in sync if queue data changes (e.g. draft saved)
  useEffect(() => {
    if (selectedMeter) {
      const fresh = queue.find(m => m.id === selectedMeter.id)
      if (fresh && fresh !== selectedMeter) setSelectedMeter(fresh)
    }
  }, [queue, selectedMeter])

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-content-bg)' }}>
      {selectedMeter ? (
        <StageExecutionForm
          meter={selectedMeter}
          onBack={() => setSelectedMeter(null)}
          onQueueUpdate={updated => {
            handleQueueUpdate(updated)
            setSelectedMeter(updated)
          }}
        />
      ) : (
        <MeterQueueList
          queue={queue}
          stageName={currentStage.name}
          onSelect={setSelectedMeter}
        />
      )}
    </div>
  )
}
