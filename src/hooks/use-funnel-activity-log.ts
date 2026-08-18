import { useState, useEffect, useCallback, useRef } from 'react'
import {
  funnelActivityService,
  type FunnelActivityLog,
  type FunnelActionType,
  type FunnelEntityType,
  type FunnelActivityFilters,
} from '@/services/funnel-activity'

const PAGE_SIZE = 20

export interface LogActionParams {
  action_type: FunnelActionType
  entity_type: FunnelEntityType
  entity_id: string
  entity_name?: string
  old_value?: string
  new_value?: string
  description: string
}

export function useFunnelActivityLog() {
  const [data, setData] = useState<FunnelActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const pageRef = useRef(1)
  const filtersRef = useRef<FunnelActivityFilters>({})
  const loadingRef = useRef(false)

  const fetchActivity = useCallback(async (filters: FunnelActivityFilters, page: number = 1) => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      setError(null)
      const result = await funnelActivityService.getAll(filters, page, PAGE_SIZE)
      filtersRef.current = filters
      pageRef.current = page
      if (page === 1) {
        setData(result.items)
      } else {
        setData((prev) => [...prev, ...result.items])
      }
      setHasMore(result.items.length >= PAGE_SIZE)
      setLoading(false)
    } catch (err) {
      const isAuth =
        err instanceof Error &&
        (err.message.toLowerCase().includes('unauthorized') ||
          err.message.toLowerCase().includes('forbidden') ||
          err.message.toLowerCase().includes('permiss'))
      setError(
        isAuth
          ? 'Você não tem permissão para ver este histórico.'
          : 'Erro de conexão. Verifique sua internet.',
      )
      setLoading(false)
      setHasMore(false)
    } finally {
      loadingRef.current = false
    }
  }, [])

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return
    fetchActivity(filtersRef.current, pageRef.current + 1)
  }, [loading, hasMore, fetchActivity])

  const subscribeToChanges = useCallback((callback: (record: FunnelActivityLog) => void) => {
    let unsubscribe: (() => Promise<void>) | undefined
    let cancelled = false
    funnelActivityService
      .subscribe((e) => {
        if (e.action === 'create') callback(e.record)
      })
      .then((fn) => {
        if (cancelled) {
          fn().catch(() => {})
        } else {
          unsubscribe = fn
        }
      })
      .catch((err) => {
        console.error('funnel activity realtime error', err)
      })
    return () => {
      cancelled = true
      if (unsubscribe) unsubscribe().catch(() => {})
    }
  }, [])

  const logAction = useCallback(async (params: LogActionParams) => {
    try {
      await funnelActivityService.create(params)
    } catch (err) {
      console.error('logAction failed', err)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchActivity({})
  }, [fetchActivity])

  return {
    data,
    loading,
    error,
    hasMore,
    loadMore,
    fetchActivity,
    subscribeToChanges,
    logAction,
  }
}
