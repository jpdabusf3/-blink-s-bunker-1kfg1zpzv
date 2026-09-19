import React, { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react'
import {
  useRealtimeDataContext,
  type RealtimeDataContextValue,
  type RealtimeCollection,
  type RealtimeEvent,
} from '@/hooks/useRealtimeData'
import { useAppContext } from '@/store/AppContext'
import type { Factory, Order, Task, Visit } from '@/types'
import { toast } from 'sonner'

export type GlobalSyncStatus = 'idle' | 'loading' | 'success' | 'error'

export interface GlobalDataContextValue {
  /** Coleções fundamentais sincronizadas */
  factories: Factory[]
  orders: Order[]
  tasks: Task[]
  visits: Visit[]
  isOnline: boolean

  /** Estado de sincronização global */
  isSyncing: boolean
  syncStatus: GlobalSyncStatus
  lastSyncTime: number | null
  syncError: string | null

  /** Força uma ressincronização completa de todas as fontes */
  syncAll: () => Promise<boolean>

  /** Notifica alterações manuais ou de mutação no client */
  notifyDataChanged: (
    collection?: RealtimeCollection | string,
    details?: Record<string, unknown>,
  ) => void

  /** Assinatura no barramento realtime */
  subscribe: RealtimeDataContextValue['subscribe']
  isReconnecting: boolean
}

const GlobalDataContext = createContext<GlobalDataContextValue | null>(null)

export interface GlobalDataProviderProps {
  children: ReactNode
}

/**
 * GlobalDataProvider: Loja central de dados única e compartilhada.
 * Construído diretamente SOBRE o hook/provedor `useRealtimeData` existente
 * e o `AppContext`, garantindo que todas as abas (Resumo, KPIs, tabelas, gráficos, etc.)
 * leiam da mesma fonte e recebam atualizações em tempo real sem recarregar a página
 * e sem criar assinaturas duplicadas no PocketBase.
 */
export function GlobalDataProvider({ children }: GlobalDataProviderProps) {
  const realtimeCtx = useRealtimeDataContext()
  const appContext = useAppContext()

  const [syncStatus, setSyncStatus] = React.useState<GlobalSyncStatus>('idle')
  const [syncError, setSyncError] = React.useState<string | null>(null)
  const [isSyncing, setIsSyncing] = React.useState<boolean>(false)

  // Disparo manual ou programático de sincronização completa
  const syncAll = useCallback(async (): Promise<boolean> => {
    setIsSyncing(true)
    setSyncStatus('loading')
    setSyncError(null)

    try {
      // Notifica o barramento de realtime global para refetch em cascata
      realtimeCtx.syncNow()

      // Pequeno yield assíncrono para acomodar a resolução das queries locais
      await new Promise((resolve) => setTimeout(resolve, 450))

      setSyncStatus('success')
      setSyncError(null)
      toast.success('Dados sincronizados')
      return true
    } catch (err: unknown) {
      console.error('[GlobalDataProvider] Falha ao sincronizar:', err)
      const message = err instanceof Error ? err.message : 'Falha ao sincronizar. Tente novamente.'
      setSyncStatus('error')
      setSyncError(message)
      toast.error('Falha ao sincronizar. Tente novamente.')
      return false
    } finally {
      setIsSyncing(false)
    }
  }, [realtimeCtx])

  const value = useMemo<GlobalDataContextValue>(() => {
    return {
      factories: appContext?.factories || [],
      orders: appContext?.orders || [],
      tasks: appContext?.tasks || [],
      visits: appContext?.visits || [],
      isOnline: appContext?.isOnline ?? true,

      isSyncing,
      syncStatus,
      lastSyncTime: realtimeCtx.lastSyncTime || null,
      syncError,

      syncAll,
      notifyDataChanged: realtimeCtx.notifyDataChanged,
      subscribe: realtimeCtx.subscribe,
      isReconnecting: realtimeCtx.isReconnecting,
    }
  }, [
    appContext?.factories,
    appContext?.orders,
    appContext?.tasks,
    appContext?.visits,
    appContext?.isOnline,
    isSyncing,
    syncStatus,
    realtimeCtx.lastSyncTime,
    realtimeCtx.notifyDataChanged,
    realtimeCtx.subscribe,
    realtimeCtx.isReconnecting,
    syncError,
    syncAll,
  ])

  return <GlobalDataContext.Provider value={value}>{children}</GlobalDataContext.Provider>
}

/**
 * Hook para consumir a loja global única em qualquer componente ou aba.
 */
export function useGlobalData(): GlobalDataContextValue {
  const ctx = useContext(GlobalDataContext)
  if (!ctx) {
    throw new Error('useGlobalData deve ser utilizado dentro de um <GlobalDataProvider>')
  }
  return ctx
}

export default GlobalDataProvider
