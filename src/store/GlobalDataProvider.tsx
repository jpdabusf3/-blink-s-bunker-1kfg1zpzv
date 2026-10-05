import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  useRealtimeDataContext,
  type RealtimeDataContextValue,
  type RealtimeCollection,
  useRealtimeData,
} from '@/hooks/useRealtimeData'
import { useAppContext } from '@/store/AppContext'
import type { Factory, Order, Task, Visit, AppNotification } from '@/types'
import { getAllFactories } from '@/services/factories'
import { listOrders } from '@/services/orders'
import { listTasks } from '@/services/tasks'
import { listVisits } from '@/services/visits'
import { produtosService, type Produto } from '@/services/produtos-service'
import { getFaturamentos, type FaturamentoRecord } from '@/services/resumo-vendas'
import { getPedidosCarteira, type PedidoCarteira } from '@/services/pedidos-carteira'
import { getMetas, type Meta } from '@/services/metas'
import { getImportHistory, type ImportHistoryRecord } from '@/services/import-history'
import { agendaService, type AgendaTask } from '@/services/agenda-service'
import { getNotifications } from '@/services/notifications'
import { getHistoricoVendas, type HistoricoVenda } from '@/services/historico-vendas'
import { getGestaoTecnica, type GestaoTecnica } from '@/services/gestao-tecnica'
import { gestaoPedidosService, type PedidoRecord } from '@/services/gestao-pedidos'
import { getAtividades } from '@/services/atividades'
import type { Atividade } from '@/types'
import { toast } from 'sonner'

export type GlobalSyncStatus = 'idle' | 'loading' | 'success' | 'error'

export interface CollectionState<T> {
  data: T[]
  loading: boolean
  error: string | null
  lastSyncTime: number | null
}

export interface GlobalDataContextValue {
  /** Coleções fundamentais (compatibilidade direta com AppContext e páginas existentes) */
  factories: Factory[]
  orders: Order[]
  tasks: Task[]
  visits: Visit[]
  isOnline: boolean

  /** Coleções de negócio sincronizadas com estado próprio */
  // 1. factories (alias clientes)
  factoriesState: CollectionState<Factory>
  clientes: Factory[]
  // 2. orders
  ordersState: CollectionState<Order>
  // 3. tasks (alias tarefas)
  tasksState: CollectionState<Task>
  tarefas: Task[]
  // 4. visits (alias visitas)
  visitsState: CollectionState<Visit>
  visitas: Visit[]
  // 5. produtos
  produtos: Produto[]
  produtosState: CollectionState<Produto>
  // 6. faturamento
  faturamento: FaturamentoRecord[]
  faturamentoState: CollectionState<FaturamentoRecord>
  // 7. pedidos_carteira
  pedidos_carteira: PedidoCarteira[]
  pedidosCarteira: PedidoCarteira[]
  pedidosCarteiraState: CollectionState<PedidoCarteira>
  // 8. metas (alias goals)
  metas: Meta[]
  goals: Meta[]
  metasState: CollectionState<Meta>
  // 9. import_history
  import_history: ImportHistoryRecord[]
  importHistory: ImportHistoryRecord[]
  importHistoryState: CollectionState<ImportHistoryRecord>
  // 10. agenda_tasks
  agenda_tasks: AgendaTask[]
  agendaTasks: AgendaTask[]
  agendaTasksState: CollectionState<AgendaTask>
  // 11. notifications
  notifications: AppNotification[]
  notificationsState: CollectionState<AppNotification>
  // 12. historico_vendas
  historico_vendas: HistoricoVenda[]
  historicoVendas: HistoricoVenda[]
  historicoVendasState: CollectionState<HistoricoVenda>
  // 13. gestao_tecnica
  gestao_tecnica: GestaoTecnica[]
  gestaoTecnica: GestaoTecnica[]
  gestaoTecnicaState: CollectionState<GestaoTecnica>
  // 14. pedidos (pedidos da coleção 'pedidos')
  pedidos: PedidoRecord[]
  pedidosState: CollectionState<PedidoRecord>
  // 15. atividades
  atividades: Atividade[]
  atividadesState: CollectionState<Atividade>

  /** Estado de sincronização global */
  isSyncing: boolean
  syncStatus: GlobalSyncStatus
  lastSyncTime: number | null
  syncError: string | null

  /** Força uma ressincronização completa de todas as fontes */
  syncAll: () => Promise<boolean>

  /** Recarrega uma coleção específica sob demanda */
  refreshCollection: (collection: RealtimeCollection | string) => Promise<void>

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
 * GlobalDataProvider: Loja central única e canônica de dados de negócio da aplicação.
 * O Provider é o ÚNICO ponto que chama as funções dos arquivos em src/services/,
 * mantendo as services puras como camada de acesso a dados.
 *
 * Expõe todas as coleções do app através de useGlobalData, cada uma com:
 * - array de dados
 * - estado de loading
 * - estado de erro em pt-BR
 * - timestamp da última sincronização (lastSyncTime)
 */
export function GlobalDataProvider({ children }: GlobalDataProviderProps) {
  const realtimeCtx = useRealtimeDataContext()
  const appContext = useAppContext()

  const [syncStatus, setSyncStatus] = useState<GlobalSyncStatus>('idle')
  const [syncError, setSyncError] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)

  // 1. factories (clientes)
  const [factoriesLastSync, setFactoriesLastSync] = useState<number | null>(null)
  const {
    data: factoriesData,
    isLoading: factoriesLoading,
    isRefreshing: factoriesRefreshing,
    errorMessage: factoriesError,
    refetch: refetchFactories,
  } = useRealtimeData<Factory[]>({
    entities: ['factories', 'clientes'],
    fetcher: async () => {
      const res = await getAllFactories()
      setFactoriesLastSync(Date.now())
      return res
    },
    initialData:
      appContext?.factories && appContext.factories.length > 0 ? appContext.factories : undefined,
  })

  // 2. orders
  const [ordersLastSync, setOrdersLastSync] = useState<number | null>(null)
  const {
    data: ordersData,
    isLoading: ordersLoading,
    isRefreshing: ordersRefreshing,
    errorMessage: ordersError,
    refetch: refetchOrders,
  } = useRealtimeData<Order[]>({
    entities: ['orders'],
    fetcher: async () => {
      const res = await listOrders()
      setOrdersLastSync(Date.now())
      return res
    },
    initialData: appContext?.orders && appContext.orders.length > 0 ? appContext.orders : undefined,
  })

  // 3. tasks (tarefas)
  const [tasksLastSync, setTasksLastSync] = useState<number | null>(null)
  const {
    data: tasksData,
    isLoading: tasksLoading,
    isRefreshing: tasksRefreshing,
    errorMessage: tasksError,
    refetch: refetchTasks,
  } = useRealtimeData<Task[]>({
    entities: ['tasks', 'tarefas'],
    fetcher: async () => {
      const res = await listTasks()
      setTasksLastSync(Date.now())
      return res
    },
    initialData: appContext?.tasks && appContext.tasks.length > 0 ? appContext.tasks : undefined,
  })

  // 4. visits (visitas)
  const [visitsLastSync, setVisitsLastSync] = useState<number | null>(null)
  const {
    data: visitsData,
    isLoading: visitsLoading,
    isRefreshing: visitsRefreshing,
    errorMessage: visitsError,
    refetch: refetchVisits,
  } = useRealtimeData<Visit[]>({
    entities: ['visits', 'visitas'],
    fetcher: async () => {
      const res = await listVisits()
      setVisitsLastSync(Date.now())
      return res
    },
    initialData: appContext?.visits && appContext.visits.length > 0 ? appContext.visits : undefined,
  })

  // 5. produtos
  const [produtosLastSync, setProdutosLastSync] = useState<number | null>(null)
  const {
    data: produtosData,
    isLoading: produtosLoading,
    isRefreshing: produtosRefreshing,
    errorMessage: produtosError,
    refetch: refetchProdutos,
  } = useRealtimeData<Produto[]>({
    entities: ['produtos'],
    fetcher: async () => {
      const res = await produtosService.listAll()
      setProdutosLastSync(Date.now())
      return res
    },
  })

  // 6. faturamento
  const [faturamentoLastSync, setFaturamentoLastSync] = useState<number | null>(null)
  const {
    data: faturamentoData,
    isLoading: faturamentoLoading,
    isRefreshing: faturamentoRefreshing,
    errorMessage: faturamentoError,
    refetch: refetchFaturamento,
  } = useRealtimeData<FaturamentoRecord[]>({
    entities: ['faturamento'],
    fetcher: async () => {
      const res = await getFaturamentos('', '-data_documento')
      setFaturamentoLastSync(Date.now())
      return res
    },
  })

  // 7. pedidos_carteira
  const [pedidosCarteiraLastSync, setPedidosCarteiraLastSync] = useState<number | null>(null)
  const {
    data: pedidosCarteiraData,
    isLoading: pedidosCarteiraLoading,
    isRefreshing: pedidosCarteiraRefreshing,
    errorMessage: pedidosCarteiraError,
    refetch: refetchPedidosCarteira,
  } = useRealtimeData<PedidoCarteira[]>({
    entities: ['pedidos_carteira'],
    fetcher: async () => {
      const res = await getPedidosCarteira()
      setPedidosCarteiraLastSync(Date.now())
      return res
    },
  })

  // 8. metas
  const [metasLastSync, setMetasLastSync] = useState<number | null>(null)
  const {
    data: metasData,
    isLoading: metasLoading,
    isRefreshing: metasRefreshing,
    errorMessage: metasError,
    refetch: refetchMetas,
  } = useRealtimeData<Meta[]>({
    entities: ['metas', 'goals'],
    fetcher: async () => {
      const res = await getMetas()
      setMetasLastSync(Date.now())
      return res
    },
  })

  // 9. import_history
  const [importHistoryLastSync, setImportHistoryLastSync] = useState<number | null>(null)
  const {
    data: importHistoryData,
    isLoading: importHistoryLoading,
    isRefreshing: importHistoryRefreshing,
    errorMessage: importHistoryError,
    refetch: refetchImportHistory,
  } = useRealtimeData<ImportHistoryRecord[]>({
    entities: ['import_history'],
    fetcher: async () => {
      const res = await getImportHistory()
      setImportHistoryLastSync(Date.now())
      return res
    },
  })

  // 10. agenda_tasks
  const [agendaTasksLastSync, setAgendaTasksLastSync] = useState<number | null>(null)
  const {
    data: agendaTasksData,
    isLoading: agendaTasksLoading,
    isRefreshing: agendaTasksRefreshing,
    errorMessage: agendaTasksError,
    refetch: refetchAgendaTasks,
  } = useRealtimeData<AgendaTask[]>({
    entities: ['agenda_tasks'],
    fetcher: async () => {
      const res = await agendaService.listTasks()
      setAgendaTasksLastSync(Date.now())
      return res
    },
  })

  // 11. notifications
  const [notificationsLastSync, setNotificationsLastSync] = useState<number | null>(null)
  const {
    data: notificationsData,
    isLoading: notificationsLoading,
    isRefreshing: notificationsRefreshing,
    errorMessage: notificationsError,
    refetch: refetchNotifications,
  } = useRealtimeData<AppNotification[]>({
    entities: ['notifications'],
    fetcher: async () => {
      const res = await getNotifications()
      setNotificationsLastSync(Date.now())
      return res
    },
  })

  // 12. historico_vendas
  const [historicoVendasLastSync, setHistoricoVendasLastSync] = useState<number | null>(null)
  const {
    data: historicoVendasData,
    isLoading: historicoVendasLoading,
    isRefreshing: historicoVendasRefreshing,
    errorMessage: historicoVendasError,
    refetch: refetchHistoricoVendas,
  } = useRealtimeData<HistoricoVenda[]>({
    entities: ['historico_vendas'],
    fetcher: async () => {
      const res = await getHistoricoVendas()
      setHistoricoVendasLastSync(Date.now())
      return res
    },
  })

  // 13. gestao_tecnica
  const [gestaoTecnicaLastSync, setGestaoTecnicaLastSync] = useState<number | null>(null)
  const {
    data: gestaoTecnicaData,
    isLoading: gestaoTecnicaLoading,
    isRefreshing: gestaoTecnicaRefreshing,
    errorMessage: gestaoTecnicaError,
    refetch: refetchGestaoTecnica,
  } = useRealtimeData<GestaoTecnica[]>({
    entities: ['gestao_tecnica'],
    fetcher: async () => {
      const res = await getGestaoTecnica()
      setGestaoTecnicaLastSync(Date.now())
      return res
    },
  })

  // 14. pedidos
  const [pedidosLastSync, setPedidosLastSync] = useState<number | null>(null)
  const {
    data: pedidosData,
    isLoading: pedidosLoading,
    isRefreshing: pedidosRefreshing,
    errorMessage: pedidosError,
    refetch: refetchPedidos,
  } = useRealtimeData<PedidoRecord[]>({
    entities: ['pedidos'],
    fetcher: async () => {
      const res = await gestaoPedidosService.listPedidos()
      setPedidosLastSync(Date.now())
      return res
    },
  })

  // 15. atividades
  const [atividadesLastSync, setAtividadesLastSync] = useState<number | null>(null)
  const {
    data: atividadesData,
    isLoading: atividadesLoading,
    isRefreshing: atividadesRefreshing,
    errorMessage: atividadesError,
    refetch: refetchAtividades,
  } = useRealtimeData<Atividade[]>({
    entities: ['atividades'],
    fetcher: async () => {
      const res = await getAtividades()
      setAtividadesLastSync(Date.now())
      return res
    },
  })

  // Recarrega uma coleção específica
  const refreshCollection = useCallback(
    async (collection: RealtimeCollection | string): Promise<void> => {
      const col = collection.toLowerCase()
      if (col === 'factories' || col === 'clientes') await refetchFactories()
      else if (col === 'orders') await refetchOrders()
      else if (col === 'tasks' || col === 'tarefas') await refetchTasks()
      else if (col === 'visits' || col === 'visitas') await refetchVisits()
      else if (col === 'produtos') await refetchProdutos()
      else if (col === 'faturamento') await refetchFaturamento()
      else if (col === 'pedidos_carteira') await refetchPedidosCarteira()
      else if (col === 'metas' || col === 'goals') await refetchMetas()
      else if (col === 'import_history') await refetchImportHistory()
      else if (col === 'agenda_tasks') await refetchAgendaTasks()
      else if (col === 'notifications') await refetchNotifications()
      else if (col === 'historico_vendas') await refetchHistoricoVendas()
      else if (col === 'gestao_tecnica') await refetchGestaoTecnica()
      else if (col === 'pedidos') await refetchPedidos()
      else if (col === 'atividades') await refetchAtividades()
    },
    [
      refetchFactories,
      refetchOrders,
      refetchTasks,
      refetchVisits,
      refetchProdutos,
      refetchFaturamento,
      refetchPedidosCarteira,
      refetchMetas,
      refetchImportHistory,
      refetchAgendaTasks,
      refetchNotifications,
      refetchHistoricoVendas,
      refetchGestaoTecnica,
      refetchPedidos,
      refetchAtividades,
    ],
  )

  // Disparo manual ou programático de sincronização completa
  const syncAll = useCallback(async (): Promise<boolean> => {
    setIsSyncing(true)
    setSyncStatus('loading')
    setSyncError(null)

    try {
      // Dispara todas as recargas em paralelo
      await Promise.all([
        refetchFactories().catch(() => {}),
        refetchOrders().catch(() => {}),
        refetchTasks().catch(() => {}),
        refetchVisits().catch(() => {}),
        refetchProdutos().catch(() => {}),
        refetchFaturamento().catch(() => {}),
        refetchPedidosCarteira().catch(() => {}),
        refetchMetas().catch(() => {}),
        refetchImportHistory().catch(() => {}),
        refetchAgendaTasks().catch(() => {}),
        refetchNotifications().catch(() => {}),
        refetchHistoricoVendas().catch(() => {}),
        refetchGestaoTecnica().catch(() => {}),
        refetchPedidos().catch(() => {}),
        refetchAtividades().catch(() => {}),
      ])

      // Notifica o barramento de realtime global para quaisquer outros consumidores externos
      realtimeCtx.syncNow()

      setSyncStatus('success')
      setSyncError(null)
      toast.success('Dados sincronizados com sucesso')
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
  }, [
    refetchFactories,
    refetchOrders,
    refetchTasks,
    refetchVisits,
    refetchProdutos,
    refetchFaturamento,
    refetchPedidosCarteira,
    refetchMetas,
    refetchImportHistory,
    refetchAgendaTasks,
    refetchNotifications,
    refetchHistoricoVendas,
    refetchGestaoTecnica,
    refetchPedidos,
    refetchAtividades,
    realtimeCtx,
  ])

  // Dados consolidados e seguros
  const safeFactories = factoriesData ?? appContext?.factories ?? []
  const safeOrders = ordersData ?? appContext?.orders ?? []
  const safeTasks = tasksData ?? appContext?.tasks ?? []
  const safeVisits = visitsData ?? appContext?.visits ?? []
  const safeProdutos = produtosData ?? []
  const safeFaturamento = faturamentoData ?? []
  const safePedidosCarteira = pedidosCarteiraData ?? []
  const safeMetas = metasData ?? []
  const safeImportHistory = importHistoryData ?? []
  const safeAgendaTasks = agendaTasksData ?? []
  const safeNotifications = notificationsData ?? []
  const safeHistoricoVendas = historicoVendasData ?? []
  const safeGestaoTecnica = gestaoTecnicaData ?? []
  const safePedidos = pedidosData ?? []
  const safeAtividades = atividadesData ?? []

  // Último sync consolidado
  const computedLastSyncTime = useMemo(() => {
    const list = [
      factoriesLastSync,
      ordersLastSync,
      tasksLastSync,
      visitsLastSync,
      produtosLastSync,
      faturamentoLastSync,
      pedidosCarteiraLastSync,
      metasLastSync,
      importHistoryLastSync,
      agendaTasksLastSync,
      notificationsLastSync,
      historicoVendasLastSync,
      gestaoTecnicaLastSync,
      pedidosLastSync,
      atividadesLastSync,
      realtimeCtx.lastSyncTime,
    ].filter((t): t is number => typeof t === 'number' && t > 0)

    if (list.length === 0) return null
    return Math.max(...list)
  }, [
    factoriesLastSync,
    ordersLastSync,
    tasksLastSync,
    visitsLastSync,
    produtosLastSync,
    faturamentoLastSync,
    pedidosCarteiraLastSync,
    metasLastSync,
    importHistoryLastSync,
    agendaTasksLastSync,
    notificationsLastSync,
    historicoVendasLastSync,
    gestaoTecnicaLastSync,
    pedidosLastSync,
    atividadesLastSync,
    realtimeCtx.lastSyncTime,
  ])

  const value = useMemo<GlobalDataContextValue>(() => {
    return {
      // 1. factories
      factories: safeFactories,
      clientes: safeFactories,
      factoriesState: {
        data: safeFactories,
        loading: factoriesLoading || factoriesRefreshing,
        error: factoriesError,
        lastSyncTime: factoriesLastSync,
      },

      // 2. orders
      orders: safeOrders,
      ordersState: {
        data: safeOrders,
        loading: ordersLoading || ordersRefreshing,
        error: ordersError,
        lastSyncTime: ordersLastSync,
      },

      // 3. tasks
      tasks: safeTasks,
      tarefas: safeTasks,
      tasksState: {
        data: safeTasks,
        loading: tasksLoading || tasksRefreshing,
        error: tasksError,
        lastSyncTime: tasksLastSync,
      },

      // 4. visits
      visits: safeVisits,
      visitas: safeVisits,
      visitsState: {
        data: safeVisits,
        loading: visitsLoading || visitsRefreshing,
        error: visitsError,
        lastSyncTime: visitsLastSync,
      },

      // 5. produtos
      produtos: safeProdutos,
      produtosState: {
        data: safeProdutos,
        loading: produtosLoading || produtosRefreshing,
        error: produtosError,
        lastSyncTime: produtosLastSync,
      },

      // 6. faturamento
      faturamento: safeFaturamento,
      faturamentoState: {
        data: safeFaturamento,
        loading: faturamentoLoading || faturamentoRefreshing,
        error: faturamentoError,
        lastSyncTime: faturamentoLastSync,
      },

      // 7. pedidos_carteira
      pedidos_carteira: safePedidosCarteira,
      pedidosCarteira: safePedidosCarteira,
      pedidosCarteiraState: {
        data: safePedidosCarteira,
        loading: pedidosCarteiraLoading || pedidosCarteiraRefreshing,
        error: pedidosCarteiraError,
        lastSyncTime: pedidosCarteiraLastSync,
      },

      // 8. metas
      metas: safeMetas,
      goals: safeMetas,
      metasState: {
        data: safeMetas,
        loading: metasLoading || metasRefreshing,
        error: metasError,
        lastSyncTime: metasLastSync,
      },

      // 9. import_history
      import_history: safeImportHistory,
      importHistory: safeImportHistory,
      importHistoryState: {
        data: safeImportHistory,
        loading: importHistoryLoading || importHistoryRefreshing,
        error: importHistoryError,
        lastSyncTime: importHistoryLastSync,
      },

      // 10. agenda_tasks
      agenda_tasks: safeAgendaTasks,
      agendaTasks: safeAgendaTasks,
      agendaTasksState: {
        data: safeAgendaTasks,
        loading: agendaTasksLoading || agendaTasksRefreshing,
        error: agendaTasksError,
        lastSyncTime: agendaTasksLastSync,
      },

      // 11. notifications
      notifications: safeNotifications,
      notificationsState: {
        data: safeNotifications,
        loading: notificationsLoading || notificationsRefreshing,
        error: notificationsError,
        lastSyncTime: notificationsLastSync,
      },

      // 12. historico_vendas
      historico_vendas: safeHistoricoVendas,
      historicoVendas: safeHistoricoVendas,
      historicoVendasState: {
        data: safeHistoricoVendas,
        loading: historicoVendasLoading || historicoVendasRefreshing,
        error: historicoVendasError,
        lastSyncTime: historicoVendasLastSync,
      },

      // 13. gestao_tecnica
      gestao_tecnica: safeGestaoTecnica,
      gestaoTecnica: safeGestaoTecnica,
      gestaoTecnicaState: {
        data: safeGestaoTecnica,
        loading: gestaoTecnicaLoading || gestaoTecnicaRefreshing,
        error: gestaoTecnicaError,
        lastSyncTime: gestaoTecnicaLastSync,
      },

      // 14. pedidos
      pedidos: safePedidos,
      pedidosState: {
        data: safePedidos,
        loading: pedidosLoading || pedidosRefreshing,
        error: pedidosError,
        lastSyncTime: pedidosLastSync,
      },

      // 15. atividades
      atividades: safeAtividades,
      atividadesState: {
        data: safeAtividades,
        loading: atividadesLoading || atividadesRefreshing,
        error: atividadesError,
        lastSyncTime: atividadesLastSync,
      },

      // Estado de rede
      isOnline: appContext?.isOnline ?? true,

      // Estado global de sincronização
      isSyncing,
      syncStatus,
      lastSyncTime: computedLastSyncTime,
      syncError,

      // Ações
      syncAll,
      refreshCollection,
      notifyDataChanged: realtimeCtx.notifyDataChanged,
      subscribe: realtimeCtx.subscribe,
      isReconnecting: realtimeCtx.isReconnecting,
    }
  }, [
    safeFactories,
    factoriesLoading,
    factoriesRefreshing,
    factoriesError,
    factoriesLastSync,
    safeOrders,
    ordersLoading,
    ordersRefreshing,
    ordersError,
    ordersLastSync,
    safeTasks,
    tasksLoading,
    tasksRefreshing,
    tasksError,
    tasksLastSync,
    safeVisits,
    visitsLoading,
    visitsRefreshing,
    visitsError,
    visitsLastSync,
    safeProdutos,
    produtosLoading,
    produtosRefreshing,
    produtosError,
    produtosLastSync,
    safeFaturamento,
    faturamentoLoading,
    faturamentoRefreshing,
    faturamentoError,
    faturamentoLastSync,
    safePedidosCarteira,
    pedidosCarteiraLoading,
    pedidosCarteiraRefreshing,
    pedidosCarteiraError,
    pedidosCarteiraLastSync,
    safeMetas,
    metasLoading,
    metasRefreshing,
    metasError,
    metasLastSync,
    safeImportHistory,
    importHistoryLoading,
    importHistoryRefreshing,
    importHistoryError,
    importHistoryLastSync,
    safeAgendaTasks,
    agendaTasksLoading,
    agendaTasksRefreshing,
    agendaTasksError,
    agendaTasksLastSync,
    safeNotifications,
    notificationsLoading,
    notificationsRefreshing,
    notificationsError,
    notificationsLastSync,
    safeHistoricoVendas,
    historicoVendasLoading,
    historicoVendasRefreshing,
    historicoVendasError,
    historicoVendasLastSync,
    safeGestaoTecnica,
    gestaoTecnicaLoading,
    gestaoTecnicaRefreshing,
    gestaoTecnicaError,
    gestaoTecnicaLastSync,
    safePedidos,
    pedidosLoading,
    pedidosRefreshing,
    pedidosError,
    pedidosLastSync,
    safeAtividades,
    atividadesLoading,
    atividadesRefreshing,
    atividadesError,
    atividadesLastSync,
    appContext?.isOnline,
    isSyncing,
    syncStatus,
    computedLastSyncTime,
    syncError,
    syncAll,
    refreshCollection,
    realtimeCtx.notifyDataChanged,
    realtimeCtx.subscribe,
    realtimeCtx.isReconnecting,
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
