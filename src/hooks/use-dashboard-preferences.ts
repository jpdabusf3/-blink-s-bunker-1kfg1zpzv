import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  getDashboardPreferences,
  saveDashboardPreferences,
  DEFAULT_DASHBOARD_BLOCKS,
} from '@/services/dashboard-preferences'

export function useDashboardPreferences() {
  const { user } = useAuth()
  const [blocks, setBlocksState] = useState<string[]>(DEFAULT_DASHBOARD_BLOCKS)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    const prefs = await getDashboardPreferences()
    if (prefs?.blocks?.length) {
      setBlocksState(prefs.blocks)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const setBlocks = useCallback((newBlocks: string[]) => {
    setBlocksState(newBlocks)
    saveDashboardPreferences(newBlocks).catch(() => {})
  }, [])

  const toggleBlock = useCallback((blockId: string) => {
    setBlocksState((prev) => {
      const next = prev.includes(blockId) ? prev.filter((b) => b !== blockId) : [...prev, blockId]
      saveDashboardPreferences(next).catch(() => {})
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setBlocksState(DEFAULT_DASHBOARD_BLOCKS)
    saveDashboardPreferences(DEFAULT_DASHBOARD_BLOCKS).catch(() => {})
  }, [])

  return { blocks, setBlocks, toggleBlock, reset, loading }
}
