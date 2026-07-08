import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { mockFactories, mockOrders, mockTasks } from '../data/mock'
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
  addTask: (data: Omit<Task, 'id' | 'createdAt'>) => void
  updateTask: (id: string, data: Partial<Task>) => void
  deleteTask: (id: string) => void
  addVisit: (data: Omit<Visit, 'id'>) => void
  addOrder: (data: Omit<Order, 'id' | 'totalValue' | 'orderDate'>) => void
  updateOrder: (id: string, data: Partial<Order>) => void
  deleteOrder: (id: string) => void
}

export const AppContext = createContext<AppContextData>({} as AppContextData)

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  const [factories, setFactories] = useState<Factory[]>(() => {
    const saved = localStorage.getItem('blink_factories_v3')
    return saved ? JSON.parse(saved) : mockFactories
  })

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('blink_orders_v3')
    return saved ? JSON.parse(saved) : mockOrders
  })

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('blink_tasks_v3')
    return saved ? JSON.parse(saved) : mockTasks
  })

  const [visits, setVisits] = useState<Visit[]>(() => {
    const saved = localStorage.getItem('blink_visits_v3')
    return saved ? JSON.parse(saved) : []
  })

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

  useEffect(() => {
    localStorage.setItem('blink_orders_v3', JSON.stringify(orders))
  }, [orders])

  useEffect(() => {
    localStorage.setItem('blink_tasks_v3', JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    localStorage.setItem('blink_visits_v3', JSON.stringify(visits))
  }, [visits])

  const addFactory = (data: Partial<Factory>) => {
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
  }

  const deleteFactory = (id: string) => {
    setFactories((prev) => prev.filter((f) => f.id !== id))
  }

  const addTask = (data: Omit<Task, 'id' | 'createdAt'>) => {
    const newTask: Task = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    }
    setTasks((prev) => [newTask, ...prev])
  }

  const updateTask = (id: string, data: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)))
  }

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  const addVisit = (data: Omit<Visit, 'id'>) => {
    const newVisit: Visit = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
    }
    setVisits((prev) => [newVisit, ...prev])
    if (data.potentialValue !== undefined) {
      updateFactory(data.factoryId, { potentialValue: data.potentialValue })
    }
  }

  const addOrder = (data: Omit<Order, 'id' | 'totalValue' | 'orderDate'>) => {
    const newOrder: Order = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      totalValue: data.quantity * data.unitValue,
      orderDate: new Date().toISOString(),
    }
    setOrders((prev) => [newOrder, ...prev])
  }

  const updateOrder = (id: string, data: Partial<Order>) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === id) {
          const updated = { ...o, ...data }
          updated.totalValue = updated.quantity * updated.unitValue
          return updated
        }
        return o
      }),
    )
  }

  const deleteOrder = (id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id))
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
