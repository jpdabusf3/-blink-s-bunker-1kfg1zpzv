import type { Factory, Order, Target } from '@/types'

const ALLOWED_DOMAINS = ['blinkbiotech.com']
const SUPER_ADMIN_EMAIL = 'joaopedro_zoo@hotmail.com'

export function isAllowedDomain(email: string): boolean {
  const normalizedEmail = email.toLowerCase().trim()
  const domain = normalizedEmail.split('@')[1] || ''
  return ALLOWED_DOMAINS.includes(domain) || normalizedEmail === SUPER_ADMIN_EMAIL
}

const LEADERSHIP_TITLES = ['ceo', 'diretor', 'gestor', 'gerente', 'manager']

export function isManager(user: any): boolean {
  if (!user) return false
  const title = (user.job_title || '').toLowerCase()
  return LEADERSHIP_TITLES.includes(title)
}

export function isSuperAdmin(user: any): boolean {
  if (!user) return false
  return user.email === SUPER_ADMIN_EMAIL
}

export function isMasterOrCeo(user: any): boolean {
  if (!user) return false
  return isSuperAdmin(user) || (user.job_title || '').toLowerCase() === 'ceo'
}

export function getScopedFactories(factories: Factory[], user: any): Factory[] {
  if (!user || isManager(user) || isSuperAdmin(user)) return factories
  const area = user.geographicArea || ''
  const country = user.country || ''
  if (!area && !country) return factories
  return factories.filter((f) => {
    const countryMatch = !country || f.country === country
    const regionMatch = !area || f.stateRegion === area || f.region === area
    return countryMatch && regionMatch
  })
}

export function getScopedOrders(orders: Order[], factories: Factory[], user: any): Order[] {
  if (!user || isManager(user) || isSuperAdmin(user)) return orders
  const area = user.geographicArea || ''
  const country = user.country || ''
  if (!area && !country) return orders
  const allowedFactoryIds = new Set(
    factories
      .filter((f) => {
        const countryMatch = !country || f.country === country
        const regionMatch = !area || f.stateRegion === area || f.region === area
        return countryMatch && regionMatch
      })
      .map((f) => f.id),
  )
  return orders.filter((o) => {
    const countryMatch = !country || o.country === country
    return allowedFactoryIds.has(o.factoryId) || (countryMatch && o.region === area)
  })
}

export function getScopedTargets(targets: Target[], user: any): Target[] {
  if (!user || isManager(user) || isSuperAdmin(user)) return targets
  const area = user.geographicArea || ''
  if (!area) return targets
  return targets.filter(
    (t) =>
      t.categoryType === 'General' || (t.categoryType === 'Region' && t.categoryValue === area),
  )
}
