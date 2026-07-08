import type { Factory, Order, Target } from '@/types'

const ALLOWED_DOMAINS = ['blinkbiotech.com']

export function isAllowedDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() || ''
  return ALLOWED_DOMAINS.includes(domain)
}

const LEADERSHIP_TITLES = ['ceo', 'diretor', 'gestor', 'gerente', 'manager']

export function isManager(user: any): boolean {
  if (!user) return false
  const title = (user.job_title || '').toLowerCase()
  return LEADERSHIP_TITLES.includes(title)
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
  return orders.filter((o) => allowedFactoryIds.has(o.factoryId) || o.region === area)
}

export function getScopedTargets(targets: Target[], user: any): Target[] {
  if (!user || isManager(user)) return targets
  const area = user.geographicArea || ''
  if (!area) return targets
  return targets.filter(
    (t) =>
      t.categoryType === 'General' || (t.categoryType === 'Region' && t.categoryValue === area),
  )
}
