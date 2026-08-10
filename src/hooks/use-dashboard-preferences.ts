import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  getDashboardPreferences,
  saveDashboardPreferences,
  savePeriodView,
  DEFAULT_DASHBOARD_BLOCKS,
} from '@/services/dashboard-preferences'

export function useDashboardPreferences() {
  const { user } = useAuth()
  const [blocks, setBlocksState] = useState<string[]>(DEFAULT_DASHBOARD_BLOCKS)
  const [periodView, setPeriodViewState] = useState<'mensal' | 'trimestral'>('mensal')
  const [loading, setLoading] = useState(true)
  const periodViewRef = useRef(periodView)
  periodViewRef.current = periodView

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    const prefs = await getDashboardPreferences()
    if (prefs?.blocks?.length) {
      setBlocksState(prefs.blocks)
    }
    if (prefs?.period_view) {
      setPeriodViewState(prefs.period_view as 'mensal' | 'trimestral')
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const setBlocks = useCallback((newBlocks: string[]) => {
    setBlocksState(newBlocks)
    saveDashboardPreferences(newBlocks, periodViewRef.current).catch(() => {})
  }, [])

  const toggleBlock = useCallback((blockId: string) => {
    setBlocksState((prev) => {
      const next = prev.includes(blockId) ? prev.filter((b) => b !== blockId) : [...prev, blockId]
      saveDashboardPreferences(next, periodViewRef.current).catch(() => {})
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setBlocksState(DEFAULT_DASHBOARD_BLOCKS)
    saveDashboardPreferences(DEFAULT_DASHBOARD_BLOCKS, periodViewRef.current).catch(() => {})
  }, [])

  const setPeriodView = useCallback((view: 'mensal' | 'trimestral') => {
    setPeriodViewState(view)
    savePeriodView(view).catch(() => {})
  }, [])

  return { blocks, setBlocks, toggleBlock, reset, loading, periodView, setPeriodView }
}
