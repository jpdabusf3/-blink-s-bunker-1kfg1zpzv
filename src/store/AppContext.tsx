import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { getAllFactories } from '@/services/factories'
import {
  listOrders,
  createOrder,
  updateOrder as updateOrderApi,
  removeOrder,
} from '@/services/orders'
import { listTasks, createTask, updateTask as updateTaskApi, removeTask } from '@/services/tasks'
import { listVisits, createVisit, removeVisit } from '@/services/visits'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { toast } from '@/hooks/use-toast'
import type { Factory, Order, Task, Visit } from '../types'

interface AppContextData {
  factories: Factory[]
  setFactories: Dispatch<SetStateAction<Factory[]>>
  orders: Order[]
  setOrders: Dispatch<SetStateAction<Order[]>>
  tasks: Task[]
  setTasks: Dispatch<SetStateAction<Task[]>>
  visits: Visit[]
  setVisits: Dispatch<SetStateAction<Visit[]>>
  isOnline: boolean
  addFactory: (data: Partial<Factory>) => void
  updateFactory: (id: string, data: Partial<Factory>) => void
  deleteFactory: (id: string) => void
  addTask: (data: Omit<Task, 'id' | 'createdAt'>) => Promise<Task | null> | void
  updateTask: (id: string, data: Partial<Task>) => Promise<Task | null> | void
  deleteTask: (id: string) => Promise<boolean> | void
  addVisit: (data: Omit<Visit, 'id'>) => Promise<Visit | null> | void
  addOrder: (data: Omit<Order, 'id' | 'totalValue' | 'orderDate'>) => Promise<Order | null> | void
  updateOrder: (id: string, data: Partial<Order>) => Promise<Order | null> | void
  deleteOrder: (id: string) => Promise<boolean> | void
}

export const AppContext = createContext<AppContextData>({} as AppContextData)

function deduplicateFactories(data: Factory[]): Factory[] {
  const seen = new Set<string>()
  return data.filter((f) => {
    if (seen.has(f.id)) return false
    seen.add(f.id)
    return true
  })
}

function deduplicateById<T extends { id: string }>(data: T[]): T[] {
  const seen = new Set<string>()
  return data.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const { isAuthenticated, loading: authLoading } = useAuth()

  const [factories, setFactories] = useState<Factory[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [visits, setVisits] = useState<Visit[]>([])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('blink_factories_v3', JSON.stringify(factories))
  }, [factories])

  const refreshFactories = useCallback(() => {
    getAllFactories()
      .then((data) => setFactories(deduplicateFactories(data)))
      .catch(() => {})
  }, [])

  const refreshOrders = useCallback(() => {
    listOrders()
      .then((data) => setOrders(deduplicateById(data)))
      .catch((err) => {
        console.warn('[AppContext] Falha ao carregar pedidos do PocketBase:', err)
      })
  }, [])

  const refreshTasks = useCallback(() => {
    listTasks()
      .then((data) => setTasks(deduplicateById(data)))
      .catch((err) => {
        console.warn('[AppContext] Falha ao carregar tarefas do PocketBase:', err)
      })
  }, [])

  const refreshVisits = useCallback(() => {
    listVisits()
      .then((data) => setVisits(deduplicateById(data)))
      .catch((err) => {
        console.warn('[AppContext] Falha ao carregar visitas do PocketBase:', err)
      })
  }, [])

  // Carregar dados das coleções ao autenticar
  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    refreshFactories()
    refreshOrders()
    refreshTasks()
    refreshVisits()
  }, [isAuthenticated, authLoading, refreshFactories, refreshOrders, refreshTasks, refreshVisits])

  // Assinaturas em tempo real via useRealtime
  useRealtime('factories', refreshFactories, isAuthenticated && !authLoading)
  useRealtime('orders', refreshOrders, isAuthenticated && !authLoading)
  useRealtime('tasks', refreshTasks, isAuthenticated && !authLoading)
  useRealtime('visits', refreshVisits, isAuthenticated && !authLoading)

  // Ouve evento global de datasync (disparado pelo GlobalDataProvider/syncNow) para revalidar dados
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleGlobalDataSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ entity?: string; collection?: string }>
      const col = customEvent.detail?.collection || customEvent.detail?.entity || 'all'
      if (col === 'all' || col === 'factories' || col === 'clientes') {
        refreshFactories()
      }
      if (col === 'all' || col === 'orders' || col === 'pedidos') {
        refreshOrders()
      }
      if (col === 'all' || col === 'tasks' || col === 'tarefas') {
        refreshTasks()
      }
      if (col === 'all' || col === 'visits' || col === 'visitas') {
        refreshVisits()
      }
    }
    window.addEventListener('blink:datasync', handleGlobalDataSync)
    return () => {
      window.removeEventListener('blink:datasync', handleGlobalDataSync)
    }
  }, [refreshFactories, refreshOrders, refreshTasks, refreshVisits])

  const addFactory = (data: Partial<Factory>) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'factories' } }))
    }
    const newFactory: Factory = {
      id: Math.random().toString(36).substr(2, 9),
      name: data.name || '',
      city: data.city || '',
      country: data.country || 'Brasil',
      region: data.region || 'Norte',
      sector: data.sector || 'Bovinos em Geral',
      animalSpecies: data.animalSpecies,
      productLineAffinity: data.productLineAffinity || 'Adsorventes',
      capacity: data.capacity || 0,
      potentialValue: data.potentialValue || 0,
      status: data.status || 'Prospeção',
      priority: data.priority || 'Medium',
      focusLevel: data.focusLevel || 3,
      lastInteraction: data.lastInteraction || new Date().toISOString(),
      funnelStage: data.funnelStage || 'Lead',
      winProbability: data.winProbability || 10,
      contactName: data.contactName || '',
      contactPhone: data.contactPhone || '',
      operationTypes: data.operationTypes || '',
      productInterests: data.productInterests || '',
      state: data.state,
      salesOwner: data.salesOwner,
      salesOwnerName: data.salesOwnerName,
      profile_type: data.profile_type,
      created: new Date().toISOString(),
      swot: data.swot || {
        strengths: '',
        weaknesses: '',
        opportunities: '',
        threats: '',
        generalAttractiveness: 50,
      },
      matrix: data.matrix || {
        financial: 5,
        technical: 5,
        fit: 5,
        openness: 5,
        competition: 5,
        urgency: 5,
        roi: 5,
      },
      scoreHistory: data.scoreHistory || [{ date: new Date().toISOString(), score: 50 }],
    }
    setFactories((prev) => [newFactory, ...prev])
  }

  const updateFactory = (id: string, data: Partial<Factory>) => {
    setFactories((prev) => prev.map((f) => (f.id === id ? { ...f, ...data } : f)))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'factories' } }))
    }
  }

  const deleteFactory = (id: string) => {
    setFactories((prev) => prev.filter((f) => f.id !== id))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'factories' } }))
    }
  }

  const addTask = async (data: Omit<Task, 'id' | 'createdAt'>): Promise<Task | null> => {
    try {
      const created = await createTask({
        title: data.description,
        description: data.description,
        type: data.type,
        dueDate: data.dueDate,
        priority: data.priority,
        completed: data.completed,
        factoryId: data.factoryId,
        related_factory_id: data.factoryId,
      })
      setTasks((prev) => [created, ...prev.filter((t) => t.id !== created.id)])
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'tasks' } }))
      }
      return created
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao salvar tarefa.'
      toast({
        title: 'Erro ao cadastrar tarefa',
        description: message,
        variant: 'destructive',
      })
      return null
    }
  }

  const updateTask = async (id: string, data: Partial<Task>): Promise<Task | null> => {
    try {
      const updated = await updateTaskApi(id, {
        title: data.title ?? data.description,
        description: data.description,
        type: data.type,
        dueDate: data.dueDate ?? data.due_date,
        due_date: data.due_date ?? data.dueDate,
        completed: data.completed,
        status: data.status,
        priority: data.priority,
        factoryId: data.factoryId ?? data.related_factory_id,
        related_factory_id: data.related_factory_id ?? data.factoryId,
      })
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'tasks' } }))
      }
      return updated
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao atualizar tarefa.'
      toast({
        title: 'Erro ao atualizar tarefa',
        description: message,
        variant: 'destructive',
      })
      return null
    }
  }

  const deleteTask = async (id: string): Promise<boolean> => {
    try {
      await removeTask(id)
      setTasks((prev) => prev.filter((t) => t.id !== id))
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'tasks' } }))
      }
      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao excluir tarefa.'
      toast({
        title: 'Erro ao excluir tarefa',
        description: message,
        variant: 'destructive',
      })
      return false
    }
  }

  const addVisit = async (data: Omit<Visit, 'id'>): Promise<Visit | null> => {
    try {
      const created = await createVisit({
        factory_id: data.factoryId || data.factory_id,
        factoryId: data.factoryId || data.factory_id,
        visit_date: data.date || data.visit_date,
        date: data.date || data.visit_date,
        notes: data.summary || data.notes,
        summary: data.summary || data.notes,
        potential_value: data.potentialValue ?? data.potential_value,
        potentialValue: data.potentialValue ?? data.potential_value,
        outcome: data.outcome,
      })
      setVisits((prev) => [created, ...prev.filter((v) => v.id !== created.id)])

      if (data.potentialValue !== undefined && data.factoryId) {
        updateFactory(data.factoryId, { potentialValue: data.potentialValue })
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'visits' } }))
      }
      return created
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao registrar visita.'
      toast({
        title: 'Erro ao salvar visita',
        description: message,
        variant: 'destructive',
      })
      return null
    }
  }

  const addOrder = async (
    data: Omit<Order, 'id' | 'totalValue' | 'orderDate'>,
  ): Promise<Order | null> => {
    try {
      const created = await createOrder({
        product: data.product,
        quantity: data.quantity,
        unitValue: data.unitValue,
        unit_value: data.unitValue,
        totalValue: data.quantity * data.unitValue,
        total_value: data.quantity * data.unitValue,
        factoryId: data.factoryId,
        line: typeof data.line === 'string' ? data.line : undefined,
        country: data.country || 'Brasil',
        status: data.status || 'aberto',
        notes: data.notes || '',
      })
      setOrders((prev) => [created, ...prev.filter((o) => o.id !== created.id)])
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'pedidos' } }))
      }
      return created
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao registrar pedido.'
      toast({
        title: 'Erro ao salvar pedido',
        description: message,
        variant: 'destructive',
      })
      return null
    }
  }

  const updateOrder = async (id: string, data: Partial<Order>): Promise<Order | null> => {
    try {
      const updated = await updateOrderApi(id, {
        client_name: data.client_name,
        product: data.product,
        quantity: data.quantity,
        unitValue: data.unitValue,
        unit_value: data.unitValue,
        totalValue: data.totalValue,
        total_value: data.totalValue,
        status: data.status,
        notes: data.notes,
        factoryId: data.factoryId,
        line: typeof data.line === 'string' ? data.line : undefined,
        country: data.country,
        orderDate: data.orderDate,
        order_date: data.order_date ?? data.orderDate,
      })
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)))
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'pedidos' } }))
      }
      return updated
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao atualizar pedido.'
      toast({
        title: 'Erro ao atualizar pedido',
        description: message,
        variant: 'destructive',
      })
      return null
    }
  }

  const deleteOrder = async (id: string): Promise<boolean> => {
    try {
      await removeOrder(id)
      setOrders((prev) => prev.filter((o) => o.id !== id))
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'pedidos' } }))
      }
      return true
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao excluir pedido.'
      toast({
        title: 'Erro ao excluir pedido',
        description: message,
        variant: 'destructive',
      })
      return false
    }
  }

  return (
    <AppContext.Provider
      value={{
        factories,
        setFactories,
        orders,
        setOrders,
        tasks,
        setTasks,
        visits,
        setVisits,
        isOnline,
        addFactory,
        updateFactory,
        deleteFactory,
        addTask,
        updateTask,
        deleteTask,
        addVisit,
        addOrder,
        updateOrder,
        deleteOrder,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useAppContext = () => useContext(AppContext)
