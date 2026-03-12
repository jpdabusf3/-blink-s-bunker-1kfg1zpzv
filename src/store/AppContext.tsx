import React, { createContext, useContext, useState } from 'react'
import { mockFactories, mockOrders } from '../data/mock'
import type { Factory, Order } from '../types'

interface AppContextData {
  factories: Factory[]
  setFactories: React.Dispatch<React.SetStateAction<Factory[]>>
  orders: Order[]
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>
  addFactory: (data: Partial<Factory>) => void
  updateFactory: (id: string, data: Partial<Factory>) => void
  deleteFactory: (id: string) => void
}

export const AppContext = createContext<AppContextData>({} as AppContextData)

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [factories, setFactories] = useState<Factory[]>(mockFactories)
  const [orders, setOrders] = useState<Order[]>(mockOrders)

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

  return (
    <AppContext.Provider
      value={{
        factories,
        setFactories,
        orders,
        setOrders,
        addFactory,
        updateFactory,
        deleteFactory,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useAppContext = () => useContext(AppContext)
