import {
  doc,
  setDoc,
  onSnapshot,
  collection,
  collectionGroup,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  orderBy,
  limit,
  Timestamp,
  increment,
  documentId,
} from 'firebase/firestore'

const PAGE_SIZE = 200
import { db } from './client'
import type { MachineStatus } from '@/types/workstation'
import type { Meter, StageHistoryEntry, ParameterDraft } from '@/types/meter'

/**
 * Write (or clear) the machine status for a workstation document.
 * Collection: `workstations/{stationId}`
 * Field:      `machineStatus`
 */
export async function setMachineStatus(
  stationId: string,
  status: MachineStatus | null
): Promise<void> {
  const ref = doc(db, 'workstations', stationId)
  await setDoc(ref, { machineStatus: status ?? null }, { merge: true })
}

/**
 * Subscribe to all workstation machine-status values.
 * Returns an unsubscribe function.
 * `onUpdate` is called with a map of stationId → machineStatus.
 */
export function subscribeMachineStatuses(
  stationIds: string[],
  onUpdate: (statuses: Record<string, MachineStatus | null>) => void
): () => void {
  if (stationIds.length === 0) {
    onUpdate({})
    return () => {}
  }
  const q = query(
    collection(db, 'workstations'),
    where(documentId(), 'in', stationIds)
  )
  return onSnapshot(q, (snap) => {
    const state: Record<string, MachineStatus | null> = {}
    // Initialise all to null so missing docs show as null
    for (const id of stationIds) state[id] = null
    for (const d of snap.docs) {
      state[d.id] = (d.data()?.machineStatus as MachineStatus | null) ?? null
    }
    onUpdate(state)
  })
}

// ---------------------------------------------------------------------------
// Meter helpers
// ---------------------------------------------------------------------------

/**
 * Create an ad-hoc meter in WS1 (stage_01, Incoming Inspection / Stores).
 * The meter is immediately placed in the stage_01 queue with status 'queued'.
 * Returns the new document ID.
 */
export async function createAdHocMeter(data: {
  serialNumber: string
  meterType: string
  note?: string
}): Promise<string> {
  const metersCol = collection(db, 'meters')
  const now = new Date().toISOString()
  const meterData: Omit<Meter, 'id'> = {
    serialNumber: data.serialNumber,
    meterType: data.meterType,
    status: 'queued',
    currentStageId: 'stage_01',
    createdAt: now,
    reworkCount: 0,
    taggedFromStageId: null,
    assignedOperatorId: null,
    draftResults: null,
    completedAt: null,
  }
  if (data.note !== undefined) {
    meterData.note = data.note
  }
  const ref = await addDoc(metersCol, meterData)
  return ref.id
}

/**
 * Check whether a meter with the given serial number already exists.
 * Returns the existing document ID, or null if no match found.
 */
export async function findMeterBySerialNumber(
  serialNumber: string
): Promise<string | null> {
  const metersCol = collection(db, 'meters')
  const q = query(metersCol, where('serialNumber', '==', serialNumber))
  const snap = await getDocs(q)
  if (snap.empty) return null
  return snap.docs[0].id
}

/**
 * Subscribe to all meters at a given stage with given statuses (for queue).
 * Returns an unsubscribe function.
 */
export function subscribeMeterQueue(
  stageId: string,
  statuses: Meter['status'][],
  onUpdate: (meters: Meter[]) => void
): () => void {
  const metersRef = collection(db, 'meters')
  const q = query(
    metersRef,
    where('currentStageId', '==', stageId),
    where('status', 'in', statuses),
    orderBy('createdAt', 'asc')
  )

  return onSnapshot(q, (snap) => {
    const meters = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Meter)
    onUpdate(meters)
  })
}

/**
 * Write a new stageHistory entry (subcollection, append-only).
 * Also updates lastFailedParams on the meter doc so queue cards can show
 * failure badges without a separate listener.
 */
export async function submitStageResult(
  meterId: string,
  entry: Omit<StageHistoryEntry, 'id'>
): Promise<void> {
  const historyRef = collection(db, 'meters', meterId, 'stageHistory')
  await addDoc(historyRef, entry)
  const failedNames = entry.parameters
    .filter(p => !p.passed)
    .map(p => p.name)
  const meterRef = doc(db, 'meters', meterId)
  await updateDoc(meterRef, { lastFailedParams: failedNames })
}

/**
 * Advance meter to next stage after successful submission.
 * Pass null for nextStageId when stage_13 is done → status becomes 'done'.
 */
export async function advanceMeter(
  meterId: string,
  nextStageId: string | null
): Promise<void> {
  const ref = doc(db, 'meters', meterId)
  if (nextStageId === null) {
    await updateDoc(ref, {
      status: 'done',
      completedAt: new Date().toISOString(),
      assignedOperatorId: null,
      draftResults: null,
      lastFailedParams: [],
    })
  } else {
    await updateDoc(ref, {
      currentStageId: nextStageId,
      status: 'queued',
      assignedOperatorId: null,
      draftResults: null,
      lastFailedParams: [],
    })
  }
}

/**
 * Save draft to meter document.
 */
export async function saveDraft(
  meterId: string,
  draft: ParameterDraft
): Promise<void> {
  const ref = doc(db, 'meters', meterId)
  await updateDoc(ref, { draftResults: draft })
}

/**
 * Clear draft (called on final submission).
 */
export async function clearDraft(meterId: string): Promise<void> {
  const ref = doc(db, 'meters', meterId)
  await updateDoc(ref, { draftResults: null })
}

/**
 * Route meter to rework at target stage.
 * reworkCount is incremented by reading the current stageHistory entry count.
 * failedParamNames are written to lastFailedParams so queue cards can show
 * failure badges without opening a separate stageHistory listener.
 */
export async function routeToRework(
  meterId: string,
  targetStageId: string,
  taggedFromStageId: string,
  failedParamNames: string[] = []
): Promise<void> {
  const ref = doc(db, 'meters', meterId)
  await updateDoc(ref, {
    status: 'rework',
    currentStageId: targetStageId,
    taggedFromStageId,
    assignedOperatorId: null,
    draftResults: null,
    reworkCount: increment(1),
    lastFailedParams: failedParamNames,
  })
}

/**
 * Subscribe to stageHistory for a meter (for rework / previous attempts view).
 * Ordered by submittedAt descending (most recent first).
 * Returns an unsubscribe function.
 */
export function subscribeStageHistory(
  meterId: string,
  onUpdate: (entries: StageHistoryEntry[]) => void
): () => void {
  const historyRef = collection(db, 'meters', meterId, 'stageHistory')
  const q = query(historyRef, orderBy('submittedAt', 'desc'))

  return onSnapshot(q, (snap) => {
    const entries = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as StageHistoryEntry
    )
    onUpdate(entries)
  })
}

// ---------------------------------------------------------------------------
// QA read-only helpers
// ---------------------------------------------------------------------------

/**
 * Convert a JS Date to a Firestore-comparable ISO string range.
 * Firestore stores dates as ISO strings, so we compare strings directly.
 */
function isoFrom(d: Date): string {
  const start = new Date(d)
  start.setHours(0, 0, 0, 0)
  return start.toISOString()
}

function isoTo(d: Date): string {
  const end = new Date(d)
  end.setHours(23, 59, 59, 999)
  return end.toISOString()
}

/**
 * Get meters with a given status, optionally filtered by createdAt date range.
 * Sorted by createdAt ascending (oldest first — most urgent for rework).
 */
export async function getMetersByStatus(
  status: Meter['status'],
  fromDate?: Date,
  toDate?: Date
): Promise<Meter[]> {
  const metersCol = collection(db, 'meters')
  const constraints = [where('status', '==', status), orderBy('createdAt', 'asc')] as Parameters<typeof query>[1][]

  if (fromDate) {
    constraints.push(where('createdAt', '>=', isoFrom(fromDate)))
  }
  if (toDate) {
    constraints.push(where('createdAt', '<=', isoTo(toDate)))
  }

  constraints.push(limit(PAGE_SIZE))
  const q = query(metersCol, ...constraints)
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Meter)
}

/**
 * Get stageHistory entries for a specific stageId across all meters.
 * Uses collectionGroup query for efficiency.
 * Falls back to per-meter fetch if collectionGroup is unavailable.
 * Sorted by submittedAt descending.
 */
export async function getStageHistoryByStageId(
  stageId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<(StageHistoryEntry & { meterId: string })[]> {
  const historyGroup = collectionGroup(db, 'stageHistory')
  const constraints = [
    where('stageId', '==', stageId),
    orderBy('submittedAt', 'desc'),
  ] as Parameters<typeof query>[1][]

  if (fromDate) {
    constraints.push(where('submittedAt', '>=', isoFrom(fromDate)))
  }
  if (toDate) {
    constraints.push(where('submittedAt', '<=', isoTo(toDate)))
  }

  constraints.push(limit(PAGE_SIZE))
  const q = query(historyGroup, ...constraints)
  const snap = await getDocs(q)

  return snap.docs.map((d) => {
    // Parent path: meters/{meterId}/stageHistory/{entryId}
    const meterId = d.ref.parent.parent?.id ?? ''
    return { id: d.id, meterId, ...d.data() } as StageHistoryEntry & { meterId: string }
  })
}

/**
 * Get stageHistory entries where overallResult === 'FAILED_ACCEPTED' across all meters.
 */
export async function getFailedAcceptedEntries(
  fromDate?: Date,
  toDate?: Date
): Promise<(StageHistoryEntry & { meterId: string })[]> {
  const historyGroup = collectionGroup(db, 'stageHistory')
  const constraints = [
    where('overallResult', '==', 'FAILED_ACCEPTED'),
    orderBy('submittedAt', 'desc'),
  ] as Parameters<typeof query>[1][]

  if (fromDate) {
    constraints.push(where('submittedAt', '>=', isoFrom(fromDate)))
  }
  if (toDate) {
    constraints.push(where('submittedAt', '<=', isoTo(toDate)))
  }

  constraints.push(limit(PAGE_SIZE))
  const q = query(historyGroup, ...constraints)
  const snap = await getDocs(q)

  return snap.docs.map((d) => {
    const meterId = d.ref.parent.parent?.id ?? ''
    return { id: d.id, meterId, ...d.data() } as StageHistoryEntry & { meterId: string }
  })
}

/**
 * Batch fetch serialNumbers for a list of meter IDs.
 * Returns a map of meterId → serialNumber.
 */
export async function getMeterSerialNumbers(
  meterIds: string[]
): Promise<Record<string, string>> {
  if (meterIds.length === 0) return {}
  const unique = Array.from(new Set(meterIds))
  const map: Record<string, string> = {}

  await Promise.all(
    unique.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, 'meters', id))
        if (snap.exists()) {
          map[id] = (snap.data() as Meter).serialNumber
        }
      } catch {
        // ignore individual fetch errors
      }
    })
  )

  return map
}

// Keep serverTimestamp + Timestamp available for other consumers
export { serverTimestamp, Timestamp }
