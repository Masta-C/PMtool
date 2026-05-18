import {
  collection,
  onSnapshot,
  query,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { Meter, MeterStatus, DraftResults } from '@/lib/firebase/meters'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Subscribe to real-time updates for meters at a given station.
 * Only includes meters with status `queued` or `rework`.
 *
 * @returns Unsubscribe function — call on component unmount.
 */
export function subscribeToStationQueue(
  stageId: string,
  onUpdate: (meters: Meter[]) => void,
): () => void {
  const q = query(
    collection(db, 'meters'),
    where('currentStageId', '==', stageId),
    where('status', 'in', ['queued', 'rework']),
  )

  return onSnapshot(q, (snap) => {
    const meters = snap.docs.map((d) =>
      docToMeter(d.id, d.data() as Record<string, unknown>),
    )
    onUpdate(meters)
  })
}

/**
 * Subscribe to real-time queue counts across ALL stations.
 * Returns a map of stageId → { total, reworkCount }.
 *
 * Implemented as a single query over all active (queued + rework) meters,
 * then aggregated client-side — this avoids 13 parallel listeners.
 *
 * @returns Unsubscribe function — call on component unmount.
 */
export function subscribeToAllStationCounts(
  onUpdate: (counts: Record<string, { total: number; reworkCount: number }>) => void,
): () => void {
  const q = query(
    collection(db, 'meters'),
    where('status', 'in', ['queued', 'rework']),
  )

  return onSnapshot(q, (snap) => {
    const counts: Record<string, { total: number; reworkCount: number }> = {}

    snap.docs.forEach((d) => {
      const data = d.data() as Record<string, unknown>
      const stageId = data.currentStageId as string
      const status = data.status as MeterStatus

      if (!counts[stageId]) {
        counts[stageId] = { total: 0, reworkCount: 0 }
      }
      counts[stageId].total += 1
      if (status === 'rework') {
        counts[stageId].reworkCount += 1
      }
    })

    onUpdate(counts)
  })
}
