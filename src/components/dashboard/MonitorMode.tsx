import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Modo Monitor (kiosk) do Painel.
 * Estado global leve: sem contexto, sem provider — um store de módulo lido
 * via useSyncExternalStore pelo Layout (para esconder o chrome) e pelo Index
 * (para renderizar a apresentação).
 */

export const MONITOR_SECTION_DURATION_S = 30
const EXIT_IDLE_MS = 3000
const STORAGE_KEY = 'blink-monitor-mode'

function urlWantsMonitor(): boolean {
  try {
    return (
      window.location.pathname === '/' &&
      new URLSearchParams(window.location.search).get('monitor') === '1'
    )
  } catch {
    return false
  }
}

// Inicialização síncrona: ?monitor=1 na URL raiz liga o modo já no primeiro paint
// (atalho de TV). Sem o parâmetro, o modo nunca religa sozinho — navegação normal
// permanece no modo padrão, mesmo que a preferência esteja salva.
let active = typeof window !== 'undefined' && urlWantsMonitor()

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function isMonitorActive() {
  return active
}

export function enterMonitorMode() {
  if (active) return
  active = true
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* storage indisponível: segue em memória */
  }
  syncBodyClass()
  emit()
}

/** Sincroniza a classe anti-scroll do body com o estado do modo. */
function syncBodyClass() {
  if (typeof document === 'undefined') return
  document.body.classList.toggle('blink-monitor-mode', active)
}
// Primeira sincronização (cobre o auto-start via ?monitor=1 no primeiro paint).
if (typeof document !== 'undefined') syncBodyClass()

export function exitMonitorMode() {
  if (!active) return
  active = false
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* idem */
  }
  syncBodyClass()
  emit()
}

/** Somente leitura do estado — usado pelo Layout para esconder o chrome. */
export function useMonitorActive() {
  return useSyncExternalStore(subscribe, isMonitorActive, () => false)
}

/**
 * Estado + comportamentos do modo monitor na página do Painel:
 * auto-start via ?monitor=1, tecla Esc e saída automática quando a rota muda
 * (o componente que usa este hook desmonta ao navegar).
 */
export function useMonitorMode() {
  const isActive = useSyncExternalStore(subscribe, isMonitorActive, () => false)

  useEffect(() => {
    if (active) {
      try {
        localStorage.setItem(STORAGE_KEY, '1')
      } catch {
        /* idem */
      }
    }
    return () => {
      if (isMonitorActive()) exitMonitorMode()
    }
  }, [])

  useEffect(() => {
    if (!isActive) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitMonitorMode()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isActive])

  return isActive
}

const SECTION_LABELS: Record<string, string> = {
  metrics: 'Indicadores',
  executive: 'Executivo',
  consolidated: 'Consolidado',
  targets: 'Metas',
  'role-widgets': 'Destaques do dia',
  maps: 'Evolução de Score',
  distribution: 'Distribuição',
  charts: 'Gráficos',
  historical: 'Histórico',
  list: 'Carteira de Clientes',
  'gestor-comparison': 'Gestão Técnica',
  geographic: 'Visão Geográfica',
}

export function monitorSectionLabel(id: string) {
  return SECTION_LABELS[id] || id
}

interface MonitorChromeProps {
  sections: string[]
  sectionIndex: number
  /** 0..1 — progresso do tempo da seção atual */
  sectionProgress: number
  children: React.ReactNode
}

/**
 * Moldura do modo monitor: barra superior fixa com título, relógio em pt-BR e
 * indicador de progresso da rotação; botão flutuante de saída que aparece ao
 * mover o mouse (ou tocar) e some após alguns segundos de inatividade.
 */
export function MonitorChrome({
  sections,
  sectionIndex,
  sectionProgress,
  children,
}: MonitorChromeProps) {
  const [now, setNow] = useState(() => new Date())
  const [showExit, setShowExit] = useState(false)
  const idleTimer = useRef<number | null>(null)

  // Relógio: atualiza a cada 10s e recomputa imediatamente quando a aba
  // recupera o foco (visibilitychange).
  useEffect(() => {
    setNow(new Date())
    const interval = window.setInterval(() => setNow(new Date()), 10_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') setNow(new Date())
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // Botão de saída aparece ao mover o mouse / tocar e some após inatividade.
  useEffect(() => {
    const wake = () => {
      setShowExit(true)
      if (idleTimer.current) window.clearTimeout(idleTimer.current)
      idleTimer.current = window.setTimeout(() => setShowExit(false), EXIT_IDLE_MS)
    }
    wake()
    window.addEventListener('mousemove', wake)
    window.addEventListener('touchstart', wake)
    return () => {
      window.removeEventListener('mousemove', wake)
      window.removeEventListener('touchstart', wake)
      if (idleTimer.current) window.clearTimeout(idleTimer.current)
    }
  }, [])

  const dataStr = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const horaStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const label = monitorSectionLabel(sections[sectionIndex] || sections[0] || '')

  return (
    <div>
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-[#3A3A42] px-1 pb-2 pt-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#E85635] shrink-0 animate-pulse" />
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-[#A1A1AA] truncate">
              Blink Biotech — Inteligência Comercial
            </span>
          </div>
          <div className="text-xs md:text-sm text-[#A1A1AA] tabular-nums text-right shrink-0">
            <span className="capitalize">{dataStr}</span>
            <span className="mx-2 text-[#E5B64E]">•</span>
            <span className="text-white font-semibold">{horaStr}</span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-[11px] text-[#E5B64E] font-semibold uppercase tracking-wider truncate max-w-[140px] md:max-w-none">
            {label}
          </span>
          <div className="flex gap-1.5 shrink-0">
            {sections.map((s, i) => (
              <span
                key={s}
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-colors',
                  i === sectionIndex ? 'bg-[#E5B64E]' : 'bg-[#3A3A42]',
                )}
              />
            ))}
          </div>
          <div className="flex-1 h-[3px] bg-[#3A3A42] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#E5B64E] rounded-full"
              style={{
                width: `${Math.min(100, Math.max(0, Math.round(sectionProgress * 100)))}%`,
                transition: 'width 1s linear',
              }}
            />
          </div>
        </div>
      </div>
      <div className="monitor-section-anchor" aria-hidden="true" style={{ height: 0 }} />

      {children}

      <button
        type="button"
        onClick={exitMonitorMode}
        className={cn(
          'fixed bottom-6 right-6 z-[80] flex items-center gap-2 h-10 px-4 rounded-[12px] text-xs font-semibold bg-[#232329] border border-[#3A3A42] text-white shadow-lg transition-opacity duration-500 hover:bg-[#3A3A42]',
          showExit ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      >
        <X className="w-4 h-4" /> Sair do modo monitor
      </button>
    </div>
  )
}
