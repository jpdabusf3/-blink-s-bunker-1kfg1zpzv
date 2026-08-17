import { useState, useEffect, useCallback, useRef } from 'react'
import { layoutVersionService, type LayoutVersion } from '@/services/layout-versions'

const PAGE_SIZE = 10

export interface SaveVersionParams {
  page_name: string
  config_data: string
  version_label?: string
}

export function useLayoutVersions(pageName: string) {
  const [versions, setVersions] = useState<LayoutVersion[]>([])
  const [activeVersion, setActiveVersion] = useState<LayoutVersion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const pageRef = useRef(1)

  const fetchVersions = useCallback(async (pName: string, page: number = 1) => {
    setError(null)
    try {
      const result = await layoutVersionService.getByPage(pName, page, PAGE_SIZE)
      pageRef.current = page
      if (page === 1) {
        setVersions(result.items)
      } else {
        setVersions((prev) => [...prev, ...result.items])
      }
      setHasMore(result.items.length >= PAGE_SIZE)
      setLoading(false)
    } catch (err) {
      const isAuth =
        err instanceof Error &&
        (err.message.toLowerCase().includes('permiss') ||
          err.message.toLowerCase().includes('unauthorized') ||
          err.message.toLowerCase().includes('forbidden'))
      setError(isAuth ? 'Sem permissao.' : 'Erro de conexao. Verifique sua internet.')
      setLoading(false)
      setHasMore(false)
    }
  }, [])

  const refreshActive = useCallback(async (pName: string) => {
    try {
      const active = await layoutVersionService.getActive(pName)
      setActiveVersion(active)
    } catch {
      setActiveVersion(null)
    }
  }, [])

  const getActiveVersion = useCallback(
    async (pName: string) => {
      await refreshActive(pName)
    },
    [refreshActive],
  )

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return
    fetchVersions(pageName, pageRef.current + 1)
  }, [loading, hasMore, pageName, fetchVersions])

  const saveVersion = useCallback(
    async (params: SaveVersionParams): Promise<void> => {
      try {
        await layoutVersionService.create(params)
        await fetchVersions(params.page_name, 1)
        await refreshActive(params.page_name)
      } catch (err) {
        throw err instanceof Error
          ? err
          : new Error('Erro ao salvar configuracao. Tente novamente.')
      }
    },
    [fetchVersions, refreshActive],
  )

  const restoreVersion = useCallback(
    async (versionId: string): Promise<void> => {
      try {
        await layoutVersionService.setActive(versionId, pageName)
        await fetchVersions(pageName, 1)
        await refreshActive(pageName)
      } catch (err) {
        throw err instanceof Error
          ? err
          : new Error('Nao foi possivel restaurar esta versao. Tente novamente.')
      }
    },
    [pageName, fetchVersions, refreshActive],
  )

  const deleteVersion = useCallback(
    async (versionId: string): Promise<void> => {
      try {
        await layoutVersionService.deleteById(versionId)
        await fetchVersions(pageName, 1)
        await refreshActive(pageName)
      } catch (err) {
        throw err instanceof Error ? err : new Error('Erro de conexao. Verifique sua internet.')
      }
    },
    [pageName, fetchVersions, refreshActive],
  )

  // Load on pageName change
  useEffect(() => {
    setLoading(true)
    fetchVersions(pageName, 1)
    refreshActive(pageName)
  }, [pageName, fetchVersions, refreshActive])

  return {
    versions,
    activeVersion,
    loading,
    error,
    hasMore,
    loadMore,
    fetchVersions,
    getActiveVersion,
    saveVersion,
    restoreVersion,
    deleteVersion,
  }
}
