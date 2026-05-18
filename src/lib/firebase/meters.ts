import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { writeAuditLog } from '@/lib/firebase/auditLog'

// ---------------------------------------------------------------------------
// Local type definitions (will be reconciled with central types in a later phase)
// ---------------------------------------------------------------------------

export type MeterStatus = 'queued' | 'in_progress' | 'rework' | 'done'

export interface DraftResults {
  parameters: Record<string, { value: string; result: 'OK' | 'NOT OK' | 'REMARK' }>
  savedAt: string
}

export interface Meter {
  id: string
  serialNumber: string
  meterType: string
  status: MeterStatus
  currentStageId: string
  assignedOperatorId: string | null
  draftResults: DraftResults | null
  createdAt: string
  completedAt: string | null
}

export interface StageHistoryEntry {
  stageId: string
  stageName: string
  operatorId: string
  parameters: Array<{
    parameterId: string
    name: string
    value: string
    result: 'OK' | 'NOT OK' | 'REMARK'
  }>
  overallResult: 'PASSED' | 'FAILED' | 'OVERRIDDEN'
  overrideComment: string | null
  overriddenBy: string | null
  startedAt: string
  submittedAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a Firestore document data object to a typed Meter. */
function docToMeter(id: string, data: Record<string, unknown>): Meter {
  const toIso = (v: unknown): string => {
    if (v instanceof Timestamp) return v.toDate().toISOString()
    if (typeof v === 'string') return v
    return new Date().toISOString()
  }

  return {
    id,
    serialNumber: data.serialNumber as string,
    meterType: data.meterType as string,
    status: data.status as MeterStatus,
    currentStageId: data.currentStageId as string,
    assignedOperatorId: (data.assignedOperatorId as string | null) ?? null,
    draftResults: (data.draftResults as DraftResults | null) ?? null,
    createdAt: toIso(data.createdAt),
    completedAt: data.completedAt ? toIso(data.completedAt) : null,
  }
}

const METERS = 'meters'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a single meter with status `queued` at `stage_01`.
 * Throws if a meter with the same serial number already exists.
 */
export async function createMeter(
  serialNumber: string,
  meterType: string,
): Promise<void> {
  const existing = await getMeter(serialNumber)
  if (existing) {
    throw new Error(`Meter with serial number "${serialNumber}" already exists`)
  }

  const ref = doc(collection(db, METERS))
  const batch = writeBatch(db)

  batch.set(ref, {
    serialNumber,
    meterType,
    status: 'queued',
    currentStageId: 'stage_01',
    assignedOperatorId: null,
    draftResults: null,
    createdAt: serverTimestamp(),
    completedAt: null,
  })

  await batch.commit()
}

/**
 * Bulk-create meters from Excel upload data.
 * Skips serial numbers that already exist.
 * Returns counts of created and skipped meters.
 */
export async function bulkCreateMeters(
  meters: Array<{ serialNumber: string; meterType: string }>,
): Promise<{ created: number; skipped: number }> {
  if (meters.length === 0) return { created: 0, skipped: 0 }

  // Fetch existing serial numbers in batches of 30 (Firestore `in` limit)
  const existingSerials = new Set<string>()
  const serialNumbers = meters.map((m) => m.serialNumber)

  for (let i = 0; i < serialNumbers.length; i += 30) {
    const chunk = serialNumbers.slice(i, i + 30)
    const q = query(collection(db, METERS), where('serialNumber', 'in', chunk))
    const snap = await getDocs(q)
    snap.forEach((d) => existingSerials.add(d.data().serialNumber as string))
  }

  const toCreate = meters.filter((m) => !existingSerials.has(m.serialNumber))
  const skipped = meters.length - toCreate.length

  // Commit in batches of 500 (Firestore batch limit)
  for (let i = 0; i < toCreate.length; i += 500) {
    const chunk = toCreate.slice(i, i + 500)
    const batch = writeBatch(db)
    for (const meter of chunk) {
      const ref = doc(collection(db, METERS))
      batch.set(ref, {
        serialNumber: meter.serialNumber,
        meterType: meter.meterType,
        status: 'queued',
        currentStageId: 'stage_01',
        assignedOperatorId: null,
        draftResults: null,
        createdAt: serverTimestamp(),
        completedAt: null,
      })
    }
    await batch.commit()
  }

  return { created: toCreate.length, skipped }
}

/**
 * Get a meter by serial number.
 * Returns null if not found.
 */
export async function getMeter(serialNumber: string): Promise<Meter | null> {
  const q = query(collection(db, METERS), where('serialNumber', '==', serialNumber))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return docToMeter(d.id, d.data() as Record<string, unknown>)
}

/**
 * Advance a meter to the next stage.
 * Updates status to `queued` and currentStageId to nextStageId.
 * Writes an audit log entry in the same batch.
 */
export async function advanceMeter(
  meterId: string,
  nextStageId: string,
  actorUid: string,
  actorRole: string,
): Promise<void> {
  const meterRef = doc(db, METERS, meterId)
  const snap = await getDoc(meterRef)
  if (!snap.exists()) throw new Error(`Meter "${meterId}" not found`)

  const before = snap.data() as Record<string, unknown>
  const after = {
    status: 'queued',
    currentStageId: nextStageId,
  }

  const batch = writeBatch(db)
  batch.update(meterRef, { ...after })

  // Audit log doc
  const auditRef = doc(collection(db, 'auditLog'))
  batch.set(auditRef, {
    action: 'meter_advanced',
    actorUid,
    actorRole,
    targetMeterId: meterId,
    stageId: nextStageId,
    before: { status: before.status, currentStageId: before.currentStageId },
    after,
    timestamp: serverTimestamp(),
  })

  await batch.commit()
}

/**
 * Tag a meter for rework at a previous stage.
 * Sets status to `rework` and currentStageId to targetStageId.
 * Writes an audit log entry in the same batch.
 */
export async function tagMeterForRework(
  meterId: string,
  targetStageId: string,
  actorUid: string,
  actorRole: string,
): Promise<void> {
  const meterRef = doc(db, METERS, meterId)
  const snap = await getDoc(meterRef)
  if (!snap.exists()) throw new Error(`Meter "${meterId}" not found`)

  const before = snap.data() as Record<string, unknown>
  const after = {
    status: 'rework',
    currentStageId: targetStageId,
  }

  const batch = writeBatch(db)
  batch.update(meterRef, { ...after })

  const auditRef = doc(collection(db, 'auditLog'))
  batch.set(auditRef, {
    action: 'meter_tagged_for_rework',
    actorUid,
    actorRole,
    targetMeterId: meterId,
    stageId: targetStageId,
    before: { status: before.status, currentStageId: before.currentStageId },
    after,
    timestamp: serverTimestamp(),
  })

  await batch.commit()
}

/**
 * Mark a meter as done (called after stage_13 passes).
 * Sets status to `done` and completedAt to now.
 * Writes an audit log entry in the same batch.
 */
export async function completeMeter(
  meterId: string,
  actorUid: string,
  actorRole: string,
): Promise<void> {
  const meterRef = doc(db, METERS, meterId)
  const snap = await getDoc(meterRef)
  if (!snap.exists()) throw new Error(`Meter "${meterId}" not found`)

  const before = snap.data() as Record<string, unknown>
  const after = {
    status: 'done',
    completedAt: serverTimestamp(),
  }

  const batch = writeBatch(db)
  batch.update(meterRef, { ...after })

  const auditRef = doc(collection(db, 'auditLog'))
  batch.set(auditRef, {
    action: 'meter_completed',
    actorUid,
    actorRole,
    targetMeterId: meterId,
    stageId: null,
    before: { status: before.status },
    after: { status: 'done' },
    timestamp: serverTimestamp(),
  })

  await batch.commit()
}

/**
 * Save a draft for the current stage.
 * Does not change routing or status.
 */
export async function saveDraft(meterId: string, draftResults: DraftResults): Promise<void> {
  const meterRef = doc(db, METERS, meterId)
  const batch = writeBatch(db)
  batch.update(meterRef, { draftResults })

  const auditRef = doc(collection(db, 'auditLog'))
  batch.set(auditRef, {
    action: 'draft_saved',
    actorUid: 'system',
    actorRole: 'system',
    targetMeterId: meterId,
    stageId: null,
    before: null,
    after: { draftSavedAt: draftResults.savedAt },
    timestamp: serverTimestamp(),
  })

  await batch.commit()
}

/**
 * Clear the draft for a meter (called after submit or explicit discard).
 */
export async function clearDraft(meterId: string): Promise<void> {
  const meterRef = doc(db, METERS, meterId)
  const batch = writeBatch(db)
  batch.update(meterRef, { draftResults: null })
  await batch.commit()
}

// Re-export writeAuditLog so callers don't need a separate import when they
// already import from meters.ts.
export { writeAuditLog }
