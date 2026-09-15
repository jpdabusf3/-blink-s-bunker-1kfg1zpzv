import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
  type ReactNode,
} from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'

/**
 * Entidades e coleções suportadas pelo sistema de tempo real.
 * Cobre estritamente todas as coleções citadas na especificação:
 * - invoices / notas fiscais: 'notas_fiscais', 'nf_itens', 'nfe_pedidos'
 * - import history / histórico de importações: 'activity_logs', 'fila_processamento', 'maestro_uploads'
 * - clients / clientes: 'factories', 'atividades', 'atribuicao_clientes', 'planos_acao'
 * - report data / relatórios: 'faturamento', 'historico_vendas', 'pedidos_carteira', 'pedidos', 'metas', 'matriz_vendas', 'gestao_tecnica', 'targets', 'orders', 'documents'
 */
export type RealtimeCollection =
  | 'faturamento'
  | 'historico_vendas'
  | 'pedidos_carteira'
  | 'factories'
  | 'clientes' // alias semântico para factories
  | 'metas'
  | 'pedidos'
  | 'nfe_pedidos'
  | 'notas_fiscais'
  | 'nf_itens'
  | 'atividades'
  | 'matriz_vendas'
  | 'gestao_tecnica'
  | 'equipe'
  | 'activity_logs'
  | 'targets'
  | 'orders'
  | 'documents'
  | 'notifications'
  | 'dashboard_preferences'
  | 'client_reports'
  | 'planos_acao'
  | 'funnel_activity_log'
  | 'historico_pedidos'
  | 'users'
  | 'invitations'
  | 'produtos'
  | 'all'

/**
 * Normaliza aliases de coleções para o nome real da coleção no PocketBase
 */
export function normalizeCollectionName(name: string): string {
  if (name === 'clientes') return 'factories'
  if (name === 'invoices') return 'notas_fiscais'
  if (name === 'import_history') return 'activity_logs'
  if (name === 'reports' || name === 'report_data') return 'historico_vendas'
  return name
}

// Lista canônica de coleções que o provedor assina no PocketBase
export const WATCHED_COLLECTIONS: string[] = [
  'faturamento',
  'historico_vendas',
  'pedidos_carteira',
  'factories',
  'metas',
  'pedidos',
  'nfe_pedidos',
  'notas_fiscais',
  'nf_itens',
  'atividades',
  'matriz_vendas',
  'gestao_tecnica',
  'equipe',
  'activity_logs',
  'targets',
  'orders',
  'documents',
  'notifications',
  'dashboard_preferences',
  'client_reports',
  'planos_acao',
  'funnel_activity_log',
  'historico_pedidos',
  'users',
  'invitations',
  'produtos',
]

export interface RealtimeEvent<TRecord extends RecordModel = RecordModel> {
  collection: string
  action: 'create' | 'update' | 'delete' | 'sync' | 'reconnect'
  record?: TRecord
  source: 'realtime' | 'mutation' | 'reconnect' | 'manual' | 'polling'
  timestamp: number
  details?: Record<string, unknown>
}

export type RealtimeListener = (event: RealtimeEvent) => void | Promise<void>

export interface RealtimeDataContextValue {
  /**
   * Notifica que dados foram criados/atualizados/excluídos.
   * Aciona todos os assinantes interessados de forma silenciosa.
   */
  notifyDataChanged: (
    collection?: RealtimeCollection | string,
    details?: Record<string, unknown>,
  ) => void

  /**
   * Força uma sincronização geral imediata
   */
  syncNow: () => void

  /**
   * Inscreve um ouvinte para coleções específicas (ou todas se omitido).
   * Retorna a função de cleanup.
   */
  subscribe: (
    listener: RealtimeListener,
    collections?: Array<RealtimeCollection | string>,
  ) => () => void

  /**
   * Indica se a conexão SSE com o backend PocketBase caiu e está tentando reconectar
   */
  isReconnecting: boolean

  /**
   * Timestamp da última sincronização ou evento recebido
   */
  lastSyncTime: number
}

const RealtimeDataContext = createContext<RealtimeDataContextValue | null>(null)

interface ListenerRegistration {
  id: number
  listener: RealtimeListener
  collections?: Set<string>
}

export function RealtimeDataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now())
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false)

  const listenersRef = useRef<Map<number, ListenerRegistration>>(new Map())
  const listenerIdCounter = useRef(0)

  // Referência para cancelamento e backoff exponencial
  const isCancelledRef = useRef(false)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unsubsRef = useRef<Array<() => void>>([])
  const isConnectingRef = useRef(false)

  // Emite evento para todos os ouvintes registrados
  const emitRealtimeEvent = useCallback((event: RealtimeEvent) => {
    setLastSyncTime(event.timestamp)
    const currentListeners = Array.from(listenersRef.current.values())

    currentListeners.forEach(({ listener, collections }) => {
      try {
        const normCol = normalizeCollectionName(event.collection)
        if (
          !collections ||
          collections.size === 0 ||
          collections.has('all') ||
          collections.has(normCol) ||
          collections.has(event.collection) ||
          event.collection === 'all'
        ) {
          void listener(event)
        }
      } catch (err) {
        console.error('[useRealtimeData] Erro no listener:', err)
      }
    })
  }, [])

  // Disparo manual ou decorrente de mutação no client
  const notifyDataChanged = useCallback(
    (collection: RealtimeCollection | string = 'all', details?: Record<string, unknown>) => {
      const norm = normalizeCollectionName(collection)
      const event: RealtimeEvent = {
        collection: norm,
        action: 'sync',
        source: 'mutation',
        timestamp: Date.now(),
        details,
      }
      emitRealtimeEvent(event)
    },
    [emitRealtimeEvent],
  )

  const syncNow = useCallback(() => {
    notifyDataChanged('all')
  }, [notifyDataChanged])

  // Inscreve ouvintes locais através do contexto compartilhado
  const subscribe = useCallback(
    (listener: RealtimeListener, collections?: Array<RealtimeCollection | string>) => {
      const id = ++listenerIdCounter.current
      const normSet =
        collections && collections.length > 0
          ? new Set<string>(collections.map((c) => normalizeCollectionName(c)))
          : undefined

      listenersRef.current.set(id, {
        id,
        listener,
        collections: normSet,
      })

      return () => {
        listenersRef.current.delete(id)
      }
    },
    [],
  )

  // Limpa subscrições ativas
  const teardownSubscriptions = useCallback(() => {
    unsubsRef.current.forEach((fn) => {
      try {
        fn()
      } catch {
        // noop
      }
    })
    unsubsRef.current = []
  }, [])

  // Estabelece assinaturas compartilhadas no PocketBase com reconexão resiliente e backoff exponencial
  const connectSubscriptions = useCallback(() => {
    if (isCancelledRef.current || !isAuthenticated || authLoading || isConnectingRef.current) {
      return
    }

    isConnectingRef.current = true
    teardownSubscriptions()

    let failed = false
    const currentUnsubs: Array<() => void> = []

    const promises = WATCHED_COLLECTIONS.map(async (colName) => {
      try {
        const unsub = await pb.collection(colName).subscribe('*', (e) => {
          if (isCancelledRef.current) return
          const event: RealtimeEvent = {
            collection: colName,
            action: (e.action as 'create' | 'update' | 'delete') || 'update',
            record: e.record,
            source: 'realtime',
            timestamp: Date.now(),
          }
          emitRealtimeEvent(event)
        })

        if (isCancelledRef.current) {
          unsub().catch(() => {})
        } else {
          currentUnsubs.push(() => {
            unsub().catch(() => {})
          })
        }
      } catch (err) {
        failed = true
        console.warn(`[useRealtimeData] Falha ao assinar "${colName}":`, err)
      }
    })

    Promise.all(promises)
      .then(() => {
        isConnectingRef.current = false
        if (isCancelledRef.current) {
          currentUnsubs.forEach((fn) => fn())
          return
        }

        unsubsRef.current = currentUnsubs

        if (failed) {
          // Houve falha na conexão: aciona estado de reconexão com backoff exponencial
          scheduleReconnect()
        } else {
          // Conectado com sucesso
          if (reconnectAttemptsRef.current > 0) {
            // Se estava reconectando, dispara refetch único e remove badge
            setIsReconnecting(false)
            reconnectAttemptsRef.current = 0
            emitRealtimeEvent({
              collection: 'all',
              action: 'reconnect',
              source: 'reconnect',
              timestamp: Date.now(),
            })
          } else {
            setIsReconnecting(false)
          }
        }
      })
      .catch((err) => {
        isConnectingRef.current = false
        console.error('[useRealtimeData] Erro ao conectar realtime:', err)
        scheduleReconnect()
      })
  }, [isAuthenticated, authLoading, teardownSubscriptions, emitRealtimeEvent])

  // Agendador com backoff exponencial: 1s, 2s, 4s, 8s, até no máx 30s
  const scheduleReconnect = useCallback(() => {
    if (isCancelledRef.current || !isAuthenticated) return

    setIsReconnecting(true)
    const attempt = reconnectAttemptsRef.current
    const delay = Math.min(1000 * Math.pow(2, attempt), 30000)
    reconnectAttemptsRef.current = attempt + 1

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      connectSubscriptions()
    }, delay)
  }, [isAuthenticated, connectSubscriptions])

  // Ciclo de vida da conexão do RealtimeDataProvider
  useEffect(() => {
    isCancelledRef.current = false

    if (isAuthenticated && !authLoading) {
      connectSubscriptions()
    }

    // Monitoramento do evento online/offline do navegador
    const handleOnline = () => {
      setIsReconnecting(true)
      reconnectAttemptsRef.current = 0
      connectSubscriptions()
    }

    const handleOffline = () => {
      setIsReconnecting(true)
    }

    // Listener para eventos locais no Window (disparados por mutações imediatas no store)
    const handleLocalSyncEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ entity?: string; collection?: string }>
      const col = customEvent.detail?.collection || customEvent.detail?.entity || 'all'
      const norm = normalizeCollectionName(col)
      emitRealtimeEvent({
        collection: norm,
        action: 'sync',
        source: 'mutation',
        timestamp: Date.now(),
      })
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
      window.addEventListener('blink:datasync', handleLocalSyncEvent)
    }

    // Polling de backup suave a cada 60s quando a página está visível (redundância para SSE silencioso)
    const backupInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        emitRealtimeEvent({
          collection: 'all',
          action: 'sync',
          source: 'polling',
          timestamp: Date.now(),
        })
      }
    }, 60000)

    return () => {
      isCancelledRef.current = true
      teardownSubscriptions()
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      clearInterval(backupInterval)
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
        window.removeEventListener('blink:datasync', handleLocalSyncEvent)
      }
    }
  }, [isAuthenticated, authLoading, connectSubscriptions, teardownSubscriptions, emitRealtimeEvent])

  return (
    <RealtimeDataContext.Provider
      value={{
        notifyDataChanged,
        syncNow,
        subscribe,
        isReconnecting,
        lastSyncTime,
      }}
    >
      {children}
    </RealtimeDataContext.Provider>
  )
}

/**
 * Hook para acessar o contexto global de RealtimeData
 */
export function useRealtimeDataContext(): RealtimeDataContextValue {
  const context = useContext(RealtimeDataContext)
  if (!context) {
    throw new Error('useRealtimeDataContext deve ser usado dentro de um <RealtimeDataProvider>')
  }
  return context
}

// Assinatura flexível: aceita ou (collectionName, callback, enabled?) ou UseRealtimeDataQueryOptions<T>
export interface UseRealtimeDataQueryOptions<T> {
  /**
   * Entidades ou coleções que interessam para esta query (ex: 'faturamento', 'notas_fiscais', 'factories').
   */
  entities?: Array<RealtimeCollection | string>

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

export interface UseRealtimeDataQueryResult<T> {
  /** Dados atuais (preservados intactos durante refresh em segundo plano) */
  data: T | null
  /** Carregamento inicial (LOADING state: skeletons apenas quando não há dados prévios) */
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
 * Hook único `useRealtimeData`:
 *
 * Modo 1 (Query com silent refetch e fade in-place):
 *   const { data, isLoading, isRefreshing, refetch } = useRealtimeData<T>({
 *     entities: ['faturamento', 'historico_vendas'],
 *     fetcher: (isRefresh) => loadData(isRefresh),
 *   })
 *
 * Modo 2 (Listener de tabela simples, compatível com a assinatura (table, callback, enabled)):
 *   useRealtimeData('factories', (e) => {
 *     loadFactories()
 *   })
 */
export function useRealtimeData<T = unknown>(
  optionsOrCollection: UseRealtimeDataQueryOptions<T> | string,
  maybeCallback?: (e: RealtimeEvent) => void,
  maybeEnabled: boolean = true,
): UseRealtimeDataQueryResult<T> {
  const isQueryMode = typeof optionsOrCollection === 'object' && optionsOrCollection !== null

  // Defaults para query mode
  const queryOptions = isQueryMode
    ? (optionsOrCollection as UseRealtimeDataQueryOptions<T>)
    : undefined

  const entities = queryOptions?.entities
  const fetcher = queryOptions?.fetcher
  const initialData = queryOptions?.initialData
  const enabled = queryOptions ? (queryOptions.enabled ?? true) : maybeEnabled
  const checkIsEmpty = queryOptions?.isEmpty
  const onSuccess = queryOptions?.onSuccess
  const onError = queryOptions?.onError

  const context = useContext(RealtimeDataContext)

  // Estado interno para modo query
  const [data, setData] = useState<T | null>(initialData ?? null)
  const [isLoading, setIsLoading] = useState<boolean>(!initialData && enabled && isQueryMode)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [isError, setIsError] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Referências estáveis dos callbacks
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess

  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const dataRef = useRef(data)
  dataRef.current = data

  const listenerCallbackRef = useRef(maybeCallback)
  listenerCallbackRef.current = maybeCallback

  // Executa o fetch respeitando as regras de silent update (sem skeleton quando já existem dados)
  const performFetch = useCallback(
    async (isBackground = false) => {
      if (!enabled || !fetcherRef.current) return

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
        console.error('[useRealtimeData] Erro ao carregar dados:', err)
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

  // Carga inicial no mount (somente query mode)
  useEffect(() => {
    if (isQueryMode && enabled) {
      void performFetch(false)
    }
  }, [isQueryMode, enabled, performFetch])

  // Inscrição no contexto compartilhado
  useEffect(() => {
    if (!context || !enabled) return

    if (isQueryMode) {
      // Query mode: refetch silencioso in-place ao receber qualquer evento correspondente
      const unsubscribe = context.subscribe(() => {
        void performFetch(true)
      }, entities)
      return unsubscribe
    } else {
      // Listener mode: invoca o callback passando o evento (INSERT, UPDATE, DELETE, etc.)
      const collectionName = typeof optionsOrCollection === 'string' ? optionsOrCollection : 'all'
      const unsubscribe = context.subscribe(
        (event) => {
          if (listenerCallbackRef.current) {
            listenerCallbackRef.current(event)
          }
        },
        [collectionName],
      )
      return unsubscribe
    }
  }, [context, enabled, isQueryMode, entities, optionsOrCollection, performFetch])

  // Avaliação de Empty state
  const computedIsEmpty = Boolean(
    !isLoading && !isError && data !== null && (checkIsEmpty ? checkIsEmpty(data) : false),
  )

  const emptyRefetch = useCallback(async () => {}, [])

  if (!isQueryMode) {
    return {
      data: null,
      isLoading: false,
      isRefreshing: false,
      isError: false,
      isEmpty: false,
      errorMessage: null,
      refetch: emptyRefetch,
      setData: () => {},
    }
  }

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

// Aliases para compatibilidade estrita e migração limpa sem breaking changes
export const DataSyncProvider = RealtimeDataProvider
export const useDataSyncContext = useRealtimeDataContext
export const useDataSync = useRealtimeData
export const useRealtime = useRealtimeData
export default useRealtimeData
