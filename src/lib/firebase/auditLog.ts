import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  limit as firestoreLimit,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

// ---------------------------------------------------------------------------
// Local type definitions
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string
  action: string
  actorUid: string
  actorRole: string
  targetMeterId: string | null
  stageId: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  timestamp: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUDIT_LOG = 'auditLog'

function snapToEntry(id: string, data: Record<string, unknown>): AuditLogEntry {
  const toIso = (v: unknown): string => {
    if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
      return (v as { toDate: () => Date }).toDate().toISOString()
    }
    if (typeof v === 'string') return v
    return new Date().toISOString()
  }

  return {
    id,
    action: data.action as string,
    actorUid: data.actorUid as string,
    actorRole: data.actorRole as string,
    targetMeterId: (data.targetMeterId as string | null) ?? null,
    stageId: (data.stageId as string | null) ?? null,
    before: (data.before as Record<string, unknown> | null) ?? null,
    after: (data.after as Record<string, unknown> | null) ?? null,
    timestamp: toIso(data.timestamp),
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Write an audit log entry (append-only).
 * Uses a batch with a single set so callers can extend it if needed.
 */
export async function writeAuditLog(
  entry: Omit<AuditLogEntry, 'id' | 'timestamp'>,
): Promise<void> {
  const batch = writeBatch(db)
  const ref = doc(collection(db, AUDIT_LOG))
  batch.set(ref, {
    ...entry,
    timestamp: serverTimestamp(),
  })
  await batch.commit()
}

/**
 * Query audit log for a specific meter, ordered by timestamp descending.
 * Returns up to `limit` entries (default 50).
 */
export async function getMeterAuditLog(
  meterId: string,
  limit = 50,
): Promise<AuditLogEntry[]> {
  const q = query(
    collection(db, AUDIT_LOG),
    where('targetMeterId', '==', meterId),
    orderBy('timestamp', 'desc'),
    firestoreLimit(limit),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => snapToEntry(d.id, d.data() as Record<string, unknown>))
}

/**
 * Query the most recent 100 audit log entries (admin view).
 */
export async function getRecentAuditLog(): Promise<AuditLogEntry[]> {
  const q = query(
    collection(db, AUDIT_LOG),
    orderBy('timestamp', 'desc'),
    firestoreLimit(100),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => snapToEntry(d.id, d.data() as Record<string, unknown>))
}
