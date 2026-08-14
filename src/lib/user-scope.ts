import type { Factory, Order, Target } from '@/types'

const ALLOWED_DOMAINS = ['blinkbiotech.com']
const SUPER_ADMIN_EMAIL = 'joaopedro_zoo@hotmail.com'

export function isAllowedDomain(_email: string): boolean {
  // Acesso liberado para qualquer domínio de email.
  return true
}

const LEADERSHIP_TITLES = ['ceo', 'diretor', 'gestor', 'gerente', 'manager']

export function isSuperAdmin(user: any): boolean {
  if (!user) return false
  const normalizedEmail = (user.email || '').toLowerCase().trim()
  return normalizedEmail === SUPER_ADMIN_EMAIL
}

export function isManager(user: any): boolean {
  if (!user) return false
  if (isSuperAdmin(user)) return true
  const title = (user.job_title || '').toLowerCase().trim()
  return LEADERSHIP_TITLES.includes(title)
}

export function isMasterOrCeo(user: any): boolean {
  if (!user) return false
  const title = (user.job_title || '').toLowerCase()
  return isSuperAdmin(user) || title === 'ceo' || title === 'diretor'
}

export function getScopedFactories(factories: Factory[], user: any): Factory[] {
  // CEO, Diretor, Gestor, Gerente, Manager and Super Admin have total global data visibility
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
