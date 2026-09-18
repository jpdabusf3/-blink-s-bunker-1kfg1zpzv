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

export function getScopedFactories(factories: Factory[], _user: any): Factory[] {
  // Acesso irrestrito a todos os usuários da ferramenta (pedido literal do usuário)
  return factories
}

export function getScopedOrders(orders: Order[], _factories: Factory[], _user: any): Order[] {
  // Acesso irrestrito a todos os usuários da ferramenta (pedido literal do usuário)
  return orders
}

export function getScopedTargets(targets: Target[], _user: any): Target[] {
  // Acesso irrestrito a todos os usuários da ferramenta (pedido literal do usuário)
  return targets
}
