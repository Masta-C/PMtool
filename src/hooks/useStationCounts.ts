import { useEffect, useState } from 'react'
import { subscribeToAllStationCounts } from '@/lib/firebase/queue'

/**
 * Real-time hook for all station queue counts.
 * Used by the admin/supervisor board to show per-station totals and rework flags.
 * Subscribes to a single Firestore query and aggregates client-side.
 */
export function useStationCounts(): {
  counts: Record<string, { total: number; reworkCount: number }>
  loading: boolean
} {
  const [counts, setCounts] = useState<Record<string, { total: number; reworkCount: number }>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeToAllStationCounts((updated) => {
      setCounts(updated)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  return { counts, loading }
}
