import { useMemo } from 'react'
import { useAppContext } from '@/store/AppContext'
import { useAuth } from '@/hooks/use-auth'
import { getScopedFactories, getScopedOrders } from '@/lib/user-scope'
import type { Factory, Order } from '@/types'

export function useScopedFactories(): Factory[] {
  const { factories } = useAppContext()
  const { user } = useAuth()
  const userId = user?.id
  const userRole = user?.job_title
  const userArea = user?.geographicArea
  const userCountry = user?.country

  return useMemo(
    () => getScopedFactories(factories, user),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [factories, user, userId, userRole, userArea, userCountry],
  )
}

export function useScopedOrders(): Order[] {
  const { orders, factories } = useAppContext()
  const { user } = useAuth()
  const userId = user?.id
  const userRole = user?.job_title
  const userArea = user?.geographicArea
  const userCountry = user?.country

  return useMemo(
    () => getScopedOrders(orders, factories, user),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, factories, user, userId, userRole, userArea, userCountry],
  )
}
