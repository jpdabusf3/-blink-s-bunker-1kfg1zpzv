import React, { createContext, useContext, useState, useEffect } from 'react'
import { mockFactories, mockOrders, mockTasks } from '../data/mock'
import type { Factory, Order, Task } from '../types'

interface AppContextData {
  factories: Factory[]
  setFactories: React.Dispatch<React.SetStateAction<Factory[]>>
  orders: Order[]
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  isOnline: boolean
  addFactory: (data: Partial<Factory>) => void
  updateFactory: (id: string, data: Partial<Factory>) => void
  deleteFactory: (id: string) => void
  addTask: (data: Omit<Task, 'id' | 'createdAt'>) => void
  updateTask: (id: string, data: Partial<Task>) => void
  deleteTask: (id: string) => void
}

export const AppContext = createContext<AppContextData>({} as AppContextData)

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  const [factories, setFactories] = useState<Factory[]>(() => {
    const saved = localStorage.getItem('blink_factories')
    return saved ? JSON.parse(saved) : mockFactories
  })

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('blink_orders')
    return saved ? JSON.parse(saved) : mockOrders
  })

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('blink_tasks')
    return saved ? JSON.parse(saved) : mockTasks
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
    localStorage.setItem('blink_factories', JSON.stringify(factories))
  }, [factories])

  useEffect(() => {
    localStorage.setItem('blink_orders', JSON.stringify(orders))
  }, [orders])

  useEffect(() => {
    localStorage.setItem('blink_tasks', JSON.stringify(tasks))
  }, [tasks])

  const addFactory = (data: Partial<Factory>) => {
    const newFactory: Factory = {
      id: Math.random().toString(36).substr(2, 9),
      name: data.name || '',
      city: data.city || '',
      region: data.region || 'Norte',
      sector: data.sector || 'Bovinos em Geral',
      productLineAffinity: data.productLineAffinity || 'Adsorventes',
      capacity: data.capacity || 0,
      potentialValue: data.potentialValue || 0,
      status: data.status || 'Prospeção',
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

  return (
    <AppContext.Provider
      value={{
        factories,
        setFactories,
        orders,
        setOrders,
        tasks,
        setTasks,
        isOnline,
        addFactory,
        updateFactory,
        deleteFactory,
        addTask,
        updateTask,
        deleteTask,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useAppContext = () => useContext(AppContext)
