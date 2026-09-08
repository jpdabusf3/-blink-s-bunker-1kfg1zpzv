import type { Factory } from '@/types'

/**
 * Normaliza strings para comparação case/acento-insensível.
 */
function normalizeStr(str?: string | null): string {
  if (!str) return ''
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * IDs e nomes associados ao vendedor Rodrigo Gardinal
 */
export const RODRIGO_GARDINAL_GT_ID = 'vscx4eb1s06fuiy'
export const RODRIGO_USER_IDS = ['i3jvhfdwufuwfe1', 'gee3174a0a6c6qx']
export const RODRIGO_NAMES = ['rodrigo gardinal', 'rodrigo garginal']

/**
 * Retorna todos os identificadores e nomes de vendedor associados à fábrica/cliente.
 *
 * Ordem de resolução:
 * 1. `vendedor_id` direto (relação para gestao_tecnica)
 * 2. `vendedor_name` ou `expand.vendedor_id.nome` ou `expand.vendedor.nome`
 * 3. Fallback: `salesOwner` expandido para usuário cuja `gestao_tecnica_id` ou nome do usuário
 * 4. Fallback especial para Rodrigo Gardinal: se salesOwner ou gestor_tecnico_id apontarem para Rodrigo
 */
export function getFactorySellerMatches(factory: Factory): {
  ids: string[]
  names: string[]
} {
  const ids = new Set<string>()
  const names = new Set<string>()

  // 1. Vendedor direto
  if (factory.vendedor_id && factory.vendedor_id.trim()) {
    ids.add(factory.vendedor_id.trim())
  }
  if (factory.vendedor_name && factory.vendedor_name.trim()) {
    names.add(factory.vendedor_name.trim())
  }

  // 2. Expansões diretas do vendedor
  const expandVendId = factory.expand?.vendedor_id
  if (expandVendId) {
    if (expandVendId.id) ids.add(expandVendId.id)
    if (expandVendId.nome) names.add(expandVendId.nome)
  }
  const expandVend = (factory.expand as any)?.vendedor
  if (expandVend) {
    if (expandVend.id) ids.add(expandVend.id)
    if (expandVend.nome) names.add(expandVend.nome)
  }

  // 3. Fallback: expand de salesOwner (usuário)
  const expandSalesOwner = (factory.expand as any)?.salesOwner
  if (expandSalesOwner) {
    // Se o usuário tem vínculo direto com gestao_tecnica
    if (expandSalesOwner.gestao_tecnica_id) {
      ids.add(expandSalesOwner.gestao_tecnica_id)
    }
    // Se expand de salesOwner.gestao_tecnica_id trouxe o objeto
    const gtExpand = expandSalesOwner.expand?.gestao_tecnica_id
    if (gtExpand) {
      if (gtExpand.id) ids.add(gtExpand.id)
      if (gtExpand.nome) names.add(gtExpand.nome)
    }
    if (expandSalesOwner.name) {
      names.add(expandSalesOwner.name)
    }
  }

  // Se salesOwner for uma das contas conhecidas do Rodrigo
  if (factory.salesOwner && RODRIGO_USER_IDS.includes(factory.salesOwner)) {
    ids.add(RODRIGO_GARDINAL_GT_ID)
    names.add('Rodrigo Gardinal')
  }

  // Se gestor_tecnico_id for do Rodrigo Gardinal e vendedor estiver associado/fallback
  if (factory.gestor_tecnico_id === RODRIGO_GARDINAL_GT_ID) {
    ids.add(RODRIGO_GARDINAL_GT_ID)
    names.add('Rodrigo Gardinal')
  }

  return {
    ids: Array.from(ids),
    names: Array.from(names),
  }
}

/**
 * Verifica se uma fábrica/cliente corresponde a um determinado vendedor (seja por ID ou por Nome).
 *
 * @param factory O registro da fábrica
 * @param targetIdOrName ID do vendedor na gestao_tecnica OU nome do vendedor (ex: "Rodrigo Gardinal")
 */
export function factoryMatchesVendedor(factory: Factory, targetIdOrName: string): boolean {
  if (!targetIdOrName || targetIdOrName === 'all' || targetIdOrName === 'Todos') {
    return true
  }

  const { ids, names } = getFactorySellerMatches(factory)

  // Checagem direta por ID
  if (ids.includes(targetIdOrName)) {
    return true
  }

  const normTarget = normalizeStr(targetIdOrName)

  // Checagem se target é Rodrigo Gardinal (por ID ou Nome)
  const isTargetRodrigo =
    targetIdOrName === RODRIGO_GARDINAL_GT_ID ||
    RODRIGO_NAMES.includes(normTarget) ||
    RODRIGO_USER_IDS.includes(targetIdOrName)

  if (isTargetRodrigo) {
    if (ids.includes(RODRIGO_GARDINAL_GT_ID)) return true
    if (names.some((n) => RODRIGO_NAMES.includes(normalizeStr(n)))) return true
  }

  // Checagem por nome
  for (const name of names) {
    if (normalizeStr(name) === normTarget) {
      return true
    }
  }

  return false
}

/**
 * Verifica se uma fábrica/cliente corresponde a QUALQUER UM dos vendedores selecionados na lista.
 * Se a lista estiver vazia, retorna true.
 *
 * @param factory O registro da fábrica
 * @param selectedVendedores Lista de nomes ou IDs de vendedores selecionados
 */
export function factoryMatchesAnyVendedor(factory: Factory, selectedVendedores: string[]): boolean {
  if (!selectedVendedores || selectedVendedores.length === 0) {
    return true
  }

  return selectedVendedores.some((sel) => factoryMatchesVendedor(factory, sel))
}
