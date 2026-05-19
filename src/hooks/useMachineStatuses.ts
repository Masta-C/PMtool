'use client'

import { useState, useEffect, useCallback } from 'react'
import { subscribeMachineStatuses, setMachineStatus } from '@/lib/firebase/firestore'
import type { MachineStatus } from '@/types/workstation'

/**
 * Subscribes to machine-status Firestore documents for the given station IDs
 * and exposes an updater that persists changes immediately.
 */
export function useMachineStatuses(stationIds: string[]) {
  const [statuses, setStatuses] = useState<Record<string, MachineStatus | null>>(() =>
    Object.fromEntries(stationIds.map((id) => [id, null]))
  )

  useEffect(() => {
    if (stationIds.length === 0) return
    const unsub = subscribeMachineStatuses(stationIds, setStatuses)
    return unsub
    // stationIds is a static constant — eslint-disable-line exhaustive-deps is intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateStatus = useCallback(
    async (stationId: string, status: MachineStatus | null) => {
      // Optimistic update
      setStatuses((prev) => ({ ...prev, [stationId]: status }))
      try {
        await setMachineStatus(stationId, status)
      } catch (err) {
        console.error('Failed to persist machine status:', err)
        // Revert on failure — the Firestore snapshot listener will resync anyway
      }
    },
    []
  )

  return { statuses, updateStatus }
}
