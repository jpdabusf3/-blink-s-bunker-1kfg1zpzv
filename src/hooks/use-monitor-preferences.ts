import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_MONITOR_SECTIONS,
  fetchMonitorPreferences,
  persistMonitorPreferences,
  type MonitorPreferences,
} from '@/services/monitor-preferences'
import { DEFAULT_DASHBOARD_BLOCKS } from '@/services/dashboard-preferences'

export type { MonitorPreferences }

/**
 * Lista de ids de seção NA ORDEM configurada, apenas as visíveis — é isso que
 * a rotação do monitor consome. Interseção com os blocos ativos do Painel
 * (desativar um bloco no Painel também o tira do monitor); seções desconhecidas
 * dos blocos do Painel (caso de prefs antigas) entram no fim.
 */
export function resolveMonitorSections(
  prefs: MonitorPreferences,
  dashboardBlocks: string[] | null,
): string[] {
  const base =
    dashboardBlocks && dashboardBlocks.length > 0 ? dashboardBlocks : DEFAULT_DASHBOARD_BLOCKS
  const known = new Set(prefs.sections.map((s) => s.id))
  const visible = new Set(prefs.sections.filter((s) => s.visible).map((s) => s.id))
  const main = base.filter((id) => visible.has(id))
  const extras = prefs.sections
    .filter((s) => s.visible && !base.includes(s.id) && known.has(s.id))
    .map((s) => s.id)
  return [...main, ...extras]
}

function defaultPrefs(): MonitorPreferences {
  return {
    sections: DEFAULT_MONITOR_SECTIONS.map((s) => ({ ...s })),
    durations: {},
  }
}

/**
 * Estado + persistência das preferências do Modo Monitor (ordem, visibilidade
 * e duração por seção). Primeiro paint usa o cache local; o carregamento do
 * PocketBase roda UMA vez por montagem do Painel (ref guard) e sobrescreve
 * quando há algo salvo no servidor. Cada mudança salva em ambos.
 */
export function useMonitorPreferences() {
  const [prefs, setPrefs] = useState<MonitorPreferences>(defaultPrefs)
  const [loaded, setLoaded] = useState(false)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    let cancelled = false
    fetchMonitorPreferences().then((saved) => {
      if (!cancelled) {
        setPrefs(saved)
        setLoaded(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const persist = useCallback((next: MonitorPreferences) => {
    setPrefs(next)
    void persistMonitorPreferences(next)
  }, [])

  const setSectionDuration = useCallback((id: string, durationS: number) => {
    setPrefs((prev) => {
      const next = { ...prev, durations: { ...prev.durations, [id]: durationS } }
      void persistMonitorPreferences(next)
      return next
    })
  }, [])

  const setSectionVisible = useCallback((id: string, visible: boolean) => {
    setPrefs((prev) => {
      const next = {
        ...prev,
        sections: prev.sections.map((s) => (s.id === id ? { ...s, visible } : s)),
      }
      void persistMonitorPreferences(next)
      return next
    })
  }, [])

  const moveSection = useCallback((id: string, direction: 'up' | 'down') => {
    setPrefs((prev) => {
      const idx = prev.sections.findIndex((s) => s.id === id)
      const to = direction === 'up' ? idx - 1 : idx + 1
      if (idx < 0 || to < 0 || to >= prev.sections.length) return prev
      const sections = [...prev.sections]
      const [moved] = sections.splice(idx, 1)
      sections.splice(to, 0, moved)
      const next = { ...prev, sections }
      void persistMonitorPreferences(next)
      return next
    })
  }, [])

  /** Restaura o padrão: todas as seções ativas, ordem original, 30s. */
  const resetMonitorPreferences = useCallback(() => {
    persist(defaultPrefs())
  }, [persist])

  return {
    prefs,
    loaded,
    setSectionVisible,
    setSectionDuration,
    moveSection,
    resetMonitorPreferences,
  }
}
