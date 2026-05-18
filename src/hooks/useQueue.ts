import { useEffect, useState } from 'react'
import { subscribeToStationQueue } from '@/lib/firebase/queue'
import type { Meter } from '@/lib/firebase/meters'

/**
 * Real-time hook for a station's queue.
 * Subscribes to all meters with status `queued` or `rework` at the given stage.
 * Cleans up the Firestore listener on unmount or when stageId changes.
 */
export function useStationQueue(stageId: string): {
  meters: Meter[]
  loading: boolean
  reworkCount: number
} {
  const [meters, setMeters] = useState<Meter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!stageId) {
      setMeters([])
      setLoading(false)
      return
    }

    setLoading(true)

    const unsubscribe = subscribeToStationQueue(stageId, (updated) => {
      setMeters(updated)
      setLoading(false)
    })

    return unsubscribe
  }, [stageId])

  const reworkCount = meters.filter((m) => m.status === 'rework').length

  return { meters, loading, reworkCount }
}
