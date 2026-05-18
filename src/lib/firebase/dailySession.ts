import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

// ---------------------------------------------------------------------------
// Local type definitions
// ---------------------------------------------------------------------------

export interface DailySession {
  date: string
  dayStarted: boolean
  committedCount: number
  stationAssignments: Record<string, string>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAILY_SESSIONS = 'dailySessions'

/**
 * Returns today's date key in YYYY-MM-DD format using the local calendar date.
 */
export function getTodayKey(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get today's session document.
 * Creates a default session document if one doesn't exist yet.
 */
export async function getTodaySession(): Promise<DailySession> {
  const key = getTodayKey()
  const ref = doc(db, DAILY_SESSIONS, key)
  const snap = await getDoc(ref)

  if (snap.exists()) {
    const data = snap.data() as Record<string, unknown>
    return {
      date: data.date as string,
      dayStarted: data.dayStarted as boolean,
      committedCount: data.committedCount as number,
      stationAssignments: (data.stationAssignments as Record<string, string>) ?? {},
    }
  }

  // Create a default session for today
  const defaultSession: DailySession = {
    date: key,
    dayStarted: false,
    committedCount: 0,
    stationAssignments: {},
  }

  await setDoc(ref, {
    ...defaultSession,
    createdAt: serverTimestamp(),
  })

  return defaultSession
}

/**
 * Assign an operator to a station for today's session.
 */
export async function setStationAssignment(
  stationId: string,
  operatorId: string,
): Promise<void> {
  const key = getTodayKey()
  const ref = doc(db, DAILY_SESSIONS, key)

  // Ensure session exists before updating
  await getTodaySession()

  await updateDoc(ref, {
    [`stationAssignments.${stationId}`]: operatorId,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Mark the day as started with the committed meter count snapshot.
 * Once started, operators can begin submitting stages.
 */
export async function startDay(committedCount: number): Promise<void> {
  const key = getTodayKey()
  const ref = doc(db, DAILY_SESSIONS, key)

  // Ensure session exists before updating
  await getTodaySession()

  await updateDoc(ref, {
    dayStarted: true,
    committedCount,
    startedAt: serverTimestamp(),
  })
}
