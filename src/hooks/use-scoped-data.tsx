import { useMemo } from 'react'
import { useAppContext } from '@/store/AppContext'
import { useAuth } from '@/hooks/use-auth'
import { getScopedFactories, getScopedOrders } from '@/lib/user-scope'
import type { Factory, Order } from '@/types'

export function useScopedFactories(): Factory[] {
  const { factories } = useAppContext()
  const { user } = useAuth()
  return useMemo(() => getScopedFactories(factories, user), [factories, user])
}

export function useScopedOrders(): Order[] {
  const { orders, factories } = useAppContext()
  const { user } = useAuth()
  return useMemo(() => getScopedOrders(orders, factories, user), [orders, factories, user])
}

export function useScopedFactories(): Factory[] {
  const { factories } = useAppContext()
  const { user } = useAuth()
  return useMemo(() => getScopedFactories(factories, user), [factories, user])
}

export function useScopedOrders(): Order[] {
  const { orders, factories } = useAppContext()
  const { user } = useAuth()
  return useMemo(() => getScopedOrders(orders, factories, user), [orders, factories, user])
}
