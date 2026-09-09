import { useEffect, useRef } from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'

import pb from '@/lib/pocketbase/client'

/**
 * Hook for real-time subscriptions to a PocketBase collection.
 * ALWAYS use this hook instead of subscribing inline.
 * Uses the per-listener UnsubscribeFunc so multiple components
 * can safely subscribe to the same collection without conflicts.
 *
 * Generic over the record type: pass your collection's interface as
 * `useRealtime<MyRecord>(...)` to get a typed subscription payload
 * instead of `unknown`.
 */
export interface UseRealtimeOptions {
  enabled?: boolean
  /** Debounce delay in ms to coalesce bursts of events into a single callback invocation. Default: 400ms */
  debounceMs?: number
}

export function useRealtime<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord>) => void,
  enabledOrOptions: boolean | UseRealtimeOptions = true,
) {
  const enabled =
    typeof enabledOrOptions === 'boolean' ? enabledOrOptions : (enabledOrOptions.enabled ?? true)
  const debounceMs =
    typeof enabledOrOptions === 'object' && typeof enabledOrOptions.debounceMs === 'number'
      ? enabledOrOptions.debounceMs
      : 400

  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastEventRef = useRef<RecordSubscription<TRecord> | null>(null)

  useEffect(() => {
    if (!enabled) return

    let unsubscribeFn: (() => Promise<void>) | undefined
    let cancelled = false

    const handleEvent = (e: RecordSubscription<TRecord>) => {
      lastEventRef.current = e

      if (debounceMs <= 0) {
        callbackRef.current(e)
        return
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null
        if (lastEventRef.current) {
          callbackRef.current(lastEventRef.current)
          lastEventRef.current = null
        }
      }, debounceMs)
    }

    pb.collection<TRecord>(collectionName)
      .subscribe('*', handleEvent)
      .then((fn) => {
        if (cancelled) {
          fn().catch(() => {})
        } else {
          unsubscribeFn = fn
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      lastEventRef.current = null
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      }
    }
  }, [collectionName, enabled, debounceMs])
}

export default useRealtime
