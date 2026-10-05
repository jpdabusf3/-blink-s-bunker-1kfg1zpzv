import type { Factory } from '@/types'
import type { GestaoTecnica } from '@/services/gestao-tecnica'
import type { UserListItem } from '@/services/users'

/**
 * Normaliza strings para comparação case/acento-insensível.
 */
export function normalizeStr(str?: string | null): string {
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
 * Normaliza o nome do vendedor para o padrão canônico final.
 * "João Pedro" -> "João Figueiredo"
 */
export function normalizeSellerName(name?: string | null): string {
  if (!name) return ''
  const norm = normalizeStr(name)
  if (norm === 'joao pedro' || norm === 'joao figueiredo') {
    return 'João Figueiredo'
  }
  return name.trim()
}

/**
 * Verifica se um usuário/membro corresponde a Fernanda Franco.
 * Fernanda Franco NÃO recebe auto-vínculo comercial.
 */
export function isFernandaFranco(
  identity?: {
    id?: string
    name?: string
    email?: string
  } | null,
): boolean {
  if (!identity) return false
  const email = (identity.email || '').toLowerCase()
  if (email.includes('fernanda.franco')) return true
  const normName = normalizeStr(identity.name)
  if (normName === 'fernanda franco') return true
  return false
}

/**
 * Interface unificada para itens selecionáveis em filtros de vendedor.
 */
export interface UnifiedVendedorOption {
  /** ID canônico usado no valor do seletor (gtId se existir, senão userId) */
  value: string
  /** Nome de exibição formatado */
  label: string
  /** ID na coleção gestao_tecnica se vinculado */
  gestaoTecnicaId?: string
  /** IDs na coleção users correspondentes */
  userIds: string[]
  /** E-mails associados */
  emails: string[]
  /** Função de negócio (ex: 'vendedor', 'gestor_comercial', etc.) */
  funcao?: string
}

/**
 * Constrói a lista unificada de todos os vendedores/gestores ativos combinando
 * `gestao_tecnica` e `users`, eliminando duplicatas por ID e por nome normalizado.
 *
 * Inclui:
 * - Todos os membros ativos de `gestao_tecnica` (vendedores, gestores, etc.)
 * - Todos os usuários de `users` que não estejam desativados
 */
export function buildUnifiedVendedoresList(
  gestaoList: GestaoTecnica[],
  usersList: UserListItem[],
): UnifiedVendedorOption[] {
  const optionsMap = new Map<string, UnifiedVendedorOption>()

  // 1. Processar membros de gestao_tecnica
  for (const gt of gestaoList) {
    if (gt.ativo === false) continue
    const canonicalLabel = normalizeSellerName(gt.nome)
    const key = normalizeStr(canonicalLabel)
    if (!key) continue

    optionsMap.set(key, {
      value: gt.id,
      label: canonicalLabel,
      gestaoTecnicaId: gt.id,
      userIds: [],
      emails: [],
      funcao: gt.funcao || 'vendedor',
    })
  }

  // 2. Cruzar com a lista de users
  for (const u of usersList) {
    if (u.deactivated) continue
    const canonicalUserName = normalizeSellerName(u.name || u.email)
    const userName = canonicalUserName
    const key = normalizeStr(userName)
    const email = (u.email || '').toLowerCase()

    // Tentar encontrar opção existente por gestao_tecnica_id ou por nome
    let existing: UnifiedVendedorOption | undefined
    if (u.gestao_tecnica_id) {
      for (const opt of optionsMap.values()) {
        if (opt.gestaoTecnicaId === u.gestao_tecnica_id) {
          existing = opt
          break
        }
      }
    }
    if (!existing && key) {
      existing = optionsMap.get(key)
    }

    if (existing) {
      if (!existing.userIds.includes(u.id)) {
        existing.userIds.push(u.id)
      }
      if (email && !existing.emails.includes(email)) {
        existing.emails.push(email)
      }
      if (!existing.gestaoTecnicaId && u.gestao_tecnica_id) {
        existing.gestaoTecnicaId = u.gestao_tecnica_id
      }
    } else if (key) {
      // Usuário novo não cadastrado em gestao_tecnica
      const opt: UnifiedVendedorOption = {
        value: u.gestao_tecnica_id || u.id,
        label: userName,
        gestaoTecnicaId: u.gestao_tecnica_id,
        userIds: [u.id],
        emails: email ? [email] : [],
        funcao: u.job_title || 'vendedor',
      }
      optionsMap.set(key, opt)
    }
  }

  // Aliases especiais conhecidos (ex: Rodrigo Gardinal múltiplos usuários)
  for (const opt of optionsMap.values()) {
    const norm = normalizeStr(opt.label)
    if (RODRIGO_NAMES.includes(norm) || opt.gestaoTecnicaId === RODRIGO_GARDINAL_GT_ID) {
      opt.gestaoTecnicaId = RODRIGO_GARDINAL_GT_ID
      for (const uid of RODRIGO_USER_IDS) {
        if (!opt.userIds.includes(uid)) opt.userIds.push(uid)
      }
    }
  }

  return Array.from(optionsMap.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
}

/**
 * Identidade resolvida de um vendedor: conjunto completo de identificadores,
 * nomes normalizados e e-mails para correspondência bidirecional.
 */
export interface VendedorIdentity {
  ids: Set<string>
  names: Set<string>
  emails: Set<string>
}

/**
 * Resolve a identidade bidirecional de um alvo de filtro (ID de gestao_tecnica,
 * ID de users, ou Nome), utilizando o catálogo de opções se disponível ou
 * heurísticas de fallback.
 */
export function resolveVendedorIdentity(
  targetIdOrName: string,
  catalog?: UnifiedVendedorOption[],
): VendedorIdentity {
  const ids = new Set<string>()
  const names = new Set<string>()
  const emails = new Set<string>()

  const raw = (targetIdOrName || '').trim()
  if (!raw || raw === 'all' || raw === 'Todos') {
    return { ids, names, emails }
  }

  const normTarget = normalizeStr(raw)

  // 1. Se temos catálogo unificado, procurar pelo value, pelos userIds, pelo gestaoTecnicaId ou pelo nome
  if (catalog && catalog.length > 0) {
    for (const opt of catalog) {
      const matchValue = opt.value === raw
      const matchGt = opt.gestaoTecnicaId === raw
      const matchUser = opt.userIds.includes(raw)
      const matchName = normalizeStr(opt.label) === normTarget

      if (matchValue || matchGt || matchUser || matchName) {
        if (opt.value) ids.add(opt.value)
        if (opt.gestaoTecnicaId) ids.add(opt.gestaoTecnicaId)
        opt.userIds.forEach((u) => ids.add(u))
        if (opt.label) names.add(normalizeStr(opt.label))
        opt.emails.forEach((e) => emails.add(e.toLowerCase()))
      }
    }
  }

  // 2. Sempre incluir o próprio termo pesquisado
  ids.add(raw)
  names.add(normTarget)

  // 3. Fallback especial para Rodrigo Gardinal
  const isRodrigo =
    raw === RODRIGO_GARDINAL_GT_ID ||
    RODRIGO_USER_IDS.includes(raw) ||
    RODRIGO_NAMES.includes(normTarget)

  if (isRodrigo) {
    ids.add(RODRIGO_GARDINAL_GT_ID)
    RODRIGO_USER_IDS.forEach((u) => ids.add(u))
    RODRIGO_NAMES.forEach((n) => names.add(normalizeStr(n)))
    emails.add('rodrigo.gardinal@blinkbiotech.com')
  }

  // 4. Aliases para João Pedro / João Figueiredo (mesma pessoa, canônico: João Figueiredo)
  const isJoao =
    normTarget === 'joao pedro' ||
    normTarget === 'joao figueiredo' ||
    raw === '4urt19q2phjs7fn' ||
    raw === 'rxo1gz5ovha70lu'

  if (isJoao) {
    ids.add('4urt19q2phjs7fn')
    ids.add('rxo1gz5ovha70lu')
    names.add('joao pedro')
    names.add('joao figueiredo')
  }

  return { ids, names, emails }
}

/**
 * Extrai todos os identificadores e nomes de vendedor de uma factory.
 */
export function getFactorySellerMatches(factory: Factory): {
  ids: string[]
  names: string[]
} {
  const ids = new Set<string>()
  const names = new Set<string>()

  // 1. vendedor_id, vendedor_name e vendedor textual diretos
  if (
    factory.vendedor_id &&
    typeof factory.vendedor_id === 'string' &&
    factory.vendedor_id.trim()
  ) {
    ids.add(factory.vendedor_id.trim())
  }
  if (
    factory.vendedor_name &&
    typeof factory.vendedor_name === 'string' &&
    factory.vendedor_name.trim()
  ) {
    names.add(normalizeSellerName(factory.vendedor_name.trim()))
  }

  // Campo alternativo/textual "vendedor" (presente em importações ou schemas flexíveis)
  const factoryRaw = factory as any
  if (
    factoryRaw.vendedor &&
    typeof factoryRaw.vendedor === 'string' &&
    factoryRaw.vendedor.trim()
  ) {
    // Se parecer um ID alfanumérico simples de PocketBase (ex: 15 chars minúsculos/números sem espaço)
    const rawVend = factoryRaw.vendedor.trim()
    if (/^[a-z0-9]{15}$/.test(rawVend)) {
      ids.add(rawVend)
    } else {
      names.add(normalizeSellerName(rawVend))
    }
  }

  // Se vendedor_id for um objeto populado em tempo de execução
  const rawVendIdObj = factory.vendedor_id as any
  if (rawVendIdObj && typeof rawVendIdObj === 'object') {
    if (rawVendIdObj.id) ids.add(rawVendIdObj.id)
    if (rawVendIdObj.nome) names.add(normalizeSellerName(rawVendIdObj.nome))
  }

  // Se vendedor for um objeto populado em tempo de execução
  if (factoryRaw.vendedor && typeof factoryRaw.vendedor === 'object') {
    if (factoryRaw.vendedor.id) ids.add(factoryRaw.vendedor.id)
    if (factoryRaw.vendedor.nome) names.add(normalizeSellerName(factoryRaw.vendedor.nome))
    if (factoryRaw.vendedor.name) names.add(normalizeSellerName(factoryRaw.vendedor.name))
  }

  // 2. Expansões diretas do vendedor
  const expandVendId = factory.expand?.vendedor_id
  if (expandVendId) {
    if (expandVendId.id) ids.add(expandVendId.id)
    if (expandVendId.nome) names.add(normalizeSellerName(expandVendId.nome))
  }
  const expandVend = (factory.expand as any)?.vendedor
  if (expandVend) {
    if (expandVend.id) ids.add(expandVend.id)
    if (expandVend.nome) names.add(normalizeSellerName(expandVend.nome))
    if (expandVend.name) names.add(normalizeSellerName(expandVend.name))
  }

  // 3. salesOwner (ID de usuário e expansões)
  if (factory.salesOwner && typeof factory.salesOwner === 'string' && factory.salesOwner.trim()) {
    ids.add(factory.salesOwner.trim())
  }
  if (
    factory.salesOwnerName &&
    typeof factory.salesOwnerName === 'string' &&
    factory.salesOwnerName.trim()
  ) {
    names.add(factory.salesOwnerName.trim())
  }

  const expandSalesOwner = (factory.expand as any)?.salesOwner
  if (expandSalesOwner) {
    if (expandSalesOwner.id) ids.add(expandSalesOwner.id)
    if (expandSalesOwner.gestao_tecnica_id) {
      ids.add(expandSalesOwner.gestao_tecnica_id)
    }
    const gtExpand = expandSalesOwner.expand?.gestao_tecnica_id
    if (gtExpand) {
      if (gtExpand.id) ids.add(gtExpand.id)
      if (gtExpand.nome) names.add(gtExpand.nome)
    }
    if (expandSalesOwner.name) {
      names.add(expandSalesOwner.name)
    }
  }

  // 4. gestor_tecnico_id e gestor_tecnico_name
  if (
    factory.gestor_tecnico_id &&
    typeof factory.gestor_tecnico_id === 'string' &&
    factory.gestor_tecnico_id.trim()
  ) {
    ids.add(factory.gestor_tecnico_id.trim())
  }
  if (
    factory.gestor_tecnico_name &&
    typeof factory.gestor_tecnico_name === 'string' &&
    factory.gestor_tecnico_name.trim()
  ) {
    names.add(factory.gestor_tecnico_name.trim())
  }
  const expandGt =
    (factory.expand as any)?.gestor_tecnico_id || (factory.expand as any)?.gestor_tecnico
  if (expandGt) {
    if (expandGt.id) ids.add(expandGt.id)
    if (expandGt.nome) names.add(expandGt.nome)
  }

  // 5. Rodrigo Gardinal aliases conhecidos
  if (
    (factory.salesOwner && RODRIGO_USER_IDS.includes(factory.salesOwner)) ||
    factory.gestor_tecnico_id === RODRIGO_GARDINAL_GT_ID ||
    factory.vendedor_id === RODRIGO_GARDINAL_GT_ID
  ) {
    ids.add(RODRIGO_GARDINAL_GT_ID)
    RODRIGO_USER_IDS.forEach((u) => ids.add(u))
    names.add('Rodrigo Gardinal')
  }

  return {
    ids: Array.from(ids),
    names: Array.from(names),
  }
}

/**
 * Verifica se uma fábrica/cliente corresponde a um determinado vendedor
 * (seja por ID de gestao_tecnica, ID de users, ou por Nome).
 *
 * Resolução bidirecional completa:
 * Dado o vendedor selecionado, casa se:
 * - f.vendedor_id ∈ ids
 * - OU f.salesOwner ∈ ids
 * - OU f.gestor_tecnico_id ∈ ids
 * - OU f.vendedor_name normalizado ∈ names
 * - OU f.salesOwnerName normalizado ∈ names
 *
 * @param factory O registro da fábrica
 * @param targetIdOrName ID de gestao_tecnica, ID de users OU nome do vendedor
 * @param catalog Catálogo unificado opcional para resolução rápida
 */
/**
 * Verifica se um cliente/fábrica é "órfão", isto é, não possui vendedor atribuído
 * (vendedor_id vazio E vendedor_name vazio E campo textual vendedor vazio).
 */
export function isFactoryOrphan(factory: Factory): boolean {
  const matches = getFactorySellerMatches(factory)
  // Checa se os conjuntos extraídos de IDs e Nomes estão vazios
  const hasId = matches.ids.some((id) => id && id.trim() !== '' && id !== 'none')
  const hasName = matches.names.some(
    (name) => name && name.trim() !== '' && name.toLowerCase() !== 'não atribuído',
  )
  return !hasId && !hasName
}

export function factoryMatchesVendedor(
  factory: Factory,
  targetIdOrName: string,
  catalog?: UnifiedVendedorOption[],
): boolean {
  if (!targetIdOrName || targetIdOrName === 'all' || targetIdOrName === 'Todos') {
    return true
  }

  const identity = resolveVendedorIdentity(targetIdOrName, catalog)
  const factoryMatches = getFactorySellerMatches(factory)

  // 1. Checagem por conjunto de IDs
  for (const fid of factoryMatches.ids) {
    if (identity.ids.has(fid)) {
      return true
    }
  }

  // 2. Checagem por conjunto de Nomes normalizados
  for (const fname of factoryMatches.names) {
    const normFname = normalizeStr(fname)
    if (identity.names.has(normFname)) {
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
 * @param catalog Catálogo unificado opcional
 */
export function factoryMatchesAnyVendedor(
  factory: Factory,
  selectedVendedores: string[],
  catalog?: UnifiedVendedorOption[],
): boolean {
  if (!selectedVendedores || selectedVendedores.length === 0) {
    return true
  }

  return selectedVendedores.some((sel) => factoryMatchesVendedor(factory, sel, catalog))
}
