import type { Factory, Order } from '@/types'

const ALLOWED_DOMAINS = ['blinkbiotech.com.br', 'blink.com.br']

export function isAllowedDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() || ''
  return ALLOWED_DOMAINS.includes(domain)
}

export function isManager(user: any): boolean {
  if (!user) return false
  const title = (user.job_title || '').toLowerCase()
  return title === 'manager' || title === 'gestor'
}

export function getScopedFactories(factories: Factory[], user: any): Factory[] {
  if (!user || isManager(user)) return factories
  const area = user.geographicArea || ''
  if (!area) return factories
  return factories.filter((f) => f.stateRegion === area || f.region === area)
}

export function getScopedOrders(orders: Order[], factories: Factory[], user: any): Order[] {
  if (!user || isManager(user)) return orders
  const area = user.geographicArea || ''
  if (!area) return orders
  const allowedFactoryIds = new Set(
    factories.filter((f) => f.stateRegion === area || f.region === area).map((f) => f.id),
  )
  return orders.filter((o) => allowedFactoryIds.has(o.factoryId))
}
