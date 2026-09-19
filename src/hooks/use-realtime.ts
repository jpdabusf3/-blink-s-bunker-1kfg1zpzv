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
export function useRealtime<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord>) => void,
  enabled: boolean = true,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    let unsubscribeFn: (() => Promise<void>) | undefined
    let cancelled = false

    pb.collection<TRecord>(collectionName)
      .subscribe('*', (e) => {
        callbackRef.current(e)
      })
      .then((fn) => {
        if (cancelled) {
          fn().catch(() => {})
        } else {
          unsubscribeFn = fn
        }
      })
      .catch(() => {})

    // Ouve também o barramento global de sincronização para responder a mutações manuais ou sync geral
    const handleGlobalSync = (e: Event) => {
      if (cancelled) return
      const customEvent = e as CustomEvent<{ entity?: string; collection?: string }>
      const col = customEvent.detail?.collection || customEvent.detail?.entity || 'all'
      if (col === 'all' || col === collectionName) {
        // Dispara o callback com um payload sintético de sincronização
        try {
          callbackRef.current({
            action: 'update',
            record: {} as TRecord,
          })
        } catch {
          // ignore
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('blink:datasync', handleGlobalSync)
    }

    return () => {
      cancelled = true
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('blink:datasync', handleGlobalSync)
      }
    }
  }, [collectionName, enabled])
}

export default useRealtime
