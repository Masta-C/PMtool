import { doc, setDoc, onSnapshot } from 'firebase/firestore'
import { db } from './client'
import type { MachineStatus } from '@/types/workstation'

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
  const state: Record<string, MachineStatus | null> = {}
  const unsubs: (() => void)[] = []

  for (const stationId of stationIds) {
    const ref = doc(db, 'workstations', stationId)
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data()
      state[stationId] = (data?.machineStatus as MachineStatus | null) ?? null
      onUpdate({ ...state })
    })
    unsubs.push(unsub)
  }

  return () => unsubs.forEach((u) => u())
}
