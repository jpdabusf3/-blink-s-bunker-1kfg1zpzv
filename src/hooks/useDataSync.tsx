import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'

/**
 * Entidades e coleções do ecossistema que disparam eventos de sincronização
 */
export type SyncEntity =
  | 'faturamento'
  | 'historico_vendas'
  | 'pedidos_carteira'
  | 'clientes'
  | 'factories'
  | 'metas'
  | 'pedidos'
  | 'nfe_pedidos'
  | 'notas_fiscais'
  | 'atividades'
  | 'matriz_vendas'
  | 'gestao_tecnica'
  | 'equipe'
  | 'all'

export interface SyncEvent {
  entity: SyncEntity
  source?: 'realtime' | 'mutation' | 'manual' | 'polling'
  timestamp: number
  details?: Record<string, unknown>
}

type SyncListener = (event: SyncEvent) => void | Promise<void>

export interface DataSyncContextValue {
  /**
   * Notifica a plataforma de que dados foram criados, atualizados ou excluídos.
   * Aciona todos os assinantes interessados e agenda a exibição do toast sutil agrupado.
   */
  notifyDataChanged: (entity?: SyncEntity, details?: Record<string, unknown>) => void

  /**
   * Força uma sincronização geral imediata
   */
  syncNow: () => void

  /**
   * Inscreve um callback para ser executado quando houver atualização de dados.
   * Retorna uma função de cancelamento de inscrição (cleanup).
   */
  subscribe: (listener: SyncListener, entities?: SyncEntity[]) => () => void

  /**
   * Dispara o toast agrupado "Dados atualizados." com debounce para evitar múltiplos toasts simultâneos.
   */
  triggerUpdateToast: () => void

  /**
   * Timestamp da última sincronização realizada
   */
  lastSyncTime: number
}

const DataSyncContext = createContext<DataSyncContextValue | null>(null)

// Coleções essenciais para escutar via PocketBase realtime
const CRITICAL_COLLECTIONS: SyncEntity[] = [
  'faturamento',
  'historico_vendas',
  'pedidos_carteira',
  'factories',
  'metas',
  'pedidos',
  'nfe_pedidos',
  'notas_fiscais',
  'atividades',
  'matriz_vendas',
  'gestao_tecnica',
]

interface ListenerRegistration {
  id: number
  listener: SyncListener
  entities?: Set<SyncEntity>
}

export function DataSyncProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now())

  // Registro de ouvintes
  const listenersRef = useRef<Map<number, ListenerRegistration>>(new Map())
  const listenerIdCounter = useRef(0)

  // Referência para agrupar múltiplos toasts (debounce 1.5s)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstLoadRef = useRef(true)

  // Dispara o toast sutil "Dados atualizados." agrupado
  const triggerUpdateToast = useCallback(() => {
    // Ignora na primeira carga
    if (isFirstLoadRef.current) {
      return
    }

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }

    toastTimeoutRef.current = setTimeout(() => {
      toast('Dados atualizados.', {
        id: 'blink-data-sync-toast', // id único evita duplicatas no Sonner
        duration: 2500,
      })
      toastTimeoutRef.current = null
    }, 1200)
  }, [])

  // Marca que a primeira carga inicial já passou após 3s do mount
  useEffect(() => {
    const timer = setTimeout(() => {
      isFirstLoadRef.current = false
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  // Emite evento para os inscritos
  const emitSyncEvent = useCallback((event: SyncEvent) => {
    setLastSyncTime(event.timestamp)
    const currentListeners = Array.from(listenersRef.current.values())

    currentListeners.forEach(({ listener, entities }) => {
      try {
        if (
          !entities ||
          entities.size === 0 ||
          entities.has('all') ||
          entities.has(event.entity) ||
          event.entity === 'all'
        ) {
          void listener(event)
        }
      } catch (err) {
        console.error('[DataSync] Erro no listener de sincronização:', err)
      }
    })
  }, [])

  // Disparo manual ou de mutação
  const notifyDataChanged = useCallback(
    (entity: SyncEntity = 'all', details?: Record<string, unknown>) => {
      const event: SyncEvent = {
        entity,
        source: 'mutation',
        timestamp: Date.now(),
        details,
      }
      emitSyncEvent(event)
      triggerUpdateToast()
    },
    [emitSyncEvent, triggerUpdateToast],
  )

  const syncNow = useCallback(() => {
    notifyDataChanged('all')
  }, [notifyDataChanged])

  // Inscreve ouvintes locais
  const subscribe = useCallback((listener: SyncListener, entities?: SyncEntity[]) => {
    const id = ++listenerIdCounter.current
    const entitySet = entities && entities.length > 0 ? new Set<SyncEntity>(entities) : undefined

    listenersRef.current.set(id, {
      id,
      listener,
      entities: entitySet,
    })

    return () => {
      listenersRef.current.delete(id)
    }
  }, [])

  // Assinaturas em tempo real do PocketBase para as coleções centrais
  useEffect(() => {
    if (authLoading || !isAuthenticated) return

    const unsubscribers: Array<() => void> = []
    let isCancelled = false

    CRITICAL_COLLECTIONS.forEach((colName) => {
      try {
        pb.collection(colName)
          .subscribe('*', (e) => {
            if (isCancelled) return
            // e.action pode ser 'create', 'update', 'delete'
            const event: SyncEvent = {
              entity: colName,
              source: 'realtime',
              timestamp: Date.now(),
              details: { action: e.action, recordId: e.record?.id },
            }
            emitSyncEvent(event)
            triggerUpdateToast()
          })
          .then((unsub) => {
            if (isCancelled) {
              unsub().catch(() => {})
            } else {
              unsubscribers.push(() => {
                unsub().catch(() => {})
              })
            }
          })
          .catch((err) => {
            console.warn(
              `[DataSync] Não foi possível assinar realtime na coleção "${colName}":`,
              err,
            )
          })
      } catch (err) {
        console.warn(`[DataSync] Erro ao registrar subscrição "${colName}":`, err)
      }
    })

    // Listener para eventos locais no Window (disparados por mutações imediatas em store)
    const handleLocalSyncEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ entity?: SyncEntity }>
      const entity = customEvent.detail?.entity || 'all'
      const event: SyncEvent = {
        entity,
        source: 'mutation',
        timestamp: Date.now(),
      }
      emitSyncEvent(event)
      triggerUpdateToast()
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('blink:datasync', handleLocalSyncEvent)
    }

    // Polling inteligente leve de backup a cada 45 segundos (em caso de desconexão SSE)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const event: SyncEvent = {
          entity: 'all',
          source: 'polling',
          timestamp: Date.now(),
        }
        emitSyncEvent(event)
      }
    }, 45000)

    return () => {
      isCancelled = true
      clearInterval(interval)
      if (typeof window !== 'undefined') {
        window.removeEventListener('blink:datasync', handleLocalSyncEvent)
      }
      unsubscribers.forEach((fn) => fn())
    }
  }, [isAuthenticated, authLoading, emitSyncEvent, triggerUpdateToast])

  return (
    <DataSyncContext.Provider
      value={{
        notifyDataChanged,
        syncNow,
        subscribe,
        triggerUpdateToast,
        lastSyncTime,
      }}
    >
      {children}
    </DataSyncContext.Provider>
  )
}

/**
 * Hook para acessar o contexto global de sincronização
 */
export function useDataSyncContext(): DataSyncContextValue {
  const context = useContext(DataSyncContext)
  if (!context) {
    throw new Error('useDataSyncContext deve ser usado dentro de um <DataSyncProvider>')
  }
  return context
}

export interface UseDataSyncOptions<T> {
  /**
   * Entidades/coleções que interessam para este componente.
   * Se omitido, reage a qualquer evento de sincronização.
   */
  entities?: SyncEntity[]

  /**
   * Função assíncrona responsável por carregar os dados.
   * Recebe um parâmetro booleano `isRefresh`: true quando é uma atualização em segundo plano.
   */
  fetcher: (isRefresh: boolean) => Promise<T>

  /**
   * Dados iniciais opcionais
   */
  initialData?: T

  /**
   * Se falso, não executa o carregamento inicial no mount. Padrão: true.
   */
  enabled?: boolean

  /**
   * Função para determinar se os dados carregados representam o estado vazio (EMPTY).
   */
  isEmpty?: (data: T | null) => boolean

  /**
   * Callback opcional ao concluir com sucesso
   */
  onSuccess?: (data: T) => void

  /**
   * Callback opcional em caso de erro
   */
  onError?: (error: unknown) => void
}

export interface UseDataSyncResult<T> {
  /** Dados atuais (preservados durante refresh) */
  data: T | null
  /** Carregamento inicial (LOADING state: skeletons) */
  isLoading: boolean
  /** Atualização silenciosa em andamento (sem skeleton, sem flicker) */
  isRefreshing: boolean
  /** Se ocorreu falha ao carregar/atualizar */
  isError: boolean
  /** Se os dados estão no estado EMPTY */
  isEmpty: boolean
  /** Mensagem de erro legível */
  errorMessage: string | null
  /** Função para forçar re-fetch manual */
  refetch: () => Promise<void>
  /** Altera os dados localmente */
  setData: React.Dispatch<React.SetStateAction<T | null>>
}

/**
 * Hook central de sincronização de dados usado por páginas, abas, cards e tabelas.
 *
 * Garante os 4 estados obrigatórios:
 * 1. LOADING: skeleton apenas na primeira carga quando ainda não há dados (`isLoading === true && !data`).
 * 2. EMPTY: preserva o empty state específico do componente quando não há registros (`isEmpty === true`).
 * 3. ERROR: mantém o último dado válido na tela (`data !== null`) e sinaliza falha com retry (`isError === true`).
 * 4. SUCCESS: atualização silenciosa in-place com o toast agrupado "Dados atualizados.".
 */
export function useDataSync<T>({
  entities,
  fetcher,
  initialData,
  enabled = true,
  isEmpty: checkIsEmpty,
  onSuccess,
  onError,
}: UseDataSyncOptions<T>): UseDataSyncResult<T> {
  const context = useContext(DataSyncContext)
  const [data, setData] = useState<T | null>(initialData ?? null)
  const [isLoading, setIsLoading] = useState<boolean>(!initialData && enabled)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isError, setIsError] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Guarda referência estável dos callbacks para não recriar efeitos
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess

  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const dataRef = useRef(data)
  dataRef.current = data

  const performFetch = useCallback(
    async (isBackground = false) => {
      if (!enabled) return

      const hasPreviousData = dataRef.current !== null

      if (!hasPreviousData && !isBackground) {
        setIsLoading(true)
      } else {
        setIsRefreshing(true)
      }

      setIsError(false)
      setErrorMessage(null)

      try {
        const result = await fetcherRef.current(hasPreviousData || isBackground)
        setData(result)
        setIsError(false)
        if (onSuccessRef.current) {
          onSuccessRef.current(result)
        }
      } catch (err: unknown) {
        console.error('[useDataSync] Erro ao carregar dados:', err)
        setIsError(true)
        const msg = err instanceof Error ? err.message : 'Falha ao atualizar os dados.'
        setErrorMessage(msg)
        if (onErrorRef.current) {
          onErrorRef.current(err)
        }
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [enabled],
  )

  // Carga inicial no mount
  useEffect(() => {
    if (enabled) {
      void performFetch(false)
    }
  }, [enabled, performFetch])

  // Inscrição no contexto global
  useEffect(() => {
    if (!context || !enabled) return

    const unsubscribe = context.subscribe(() => {
      // Ao receber evento de sync, refaz o fetch em segundo plano (in-place)
      void performFetch(true)
    }, entities)

    return unsubscribe
  }, [context, enabled, entities, performFetch])

  // Avaliação do estado EMPTY
  const computedIsEmpty = Boolean(
    !isLoading && !isError && data !== null && (checkIsEmpty ? checkIsEmpty(data) : false),
  )

  return {
    data,
    isLoading,
    isRefreshing,
    isError,
    isEmpty: computedIsEmpty,
    errorMessage,
    refetch: () => performFetch(data !== null),
    setData,
  }
}
