import pb from '@/lib/pocketbase/client'
import { notifyDataChanged } from '@/hooks/useRealtimeData'
import { cleanDigits, formatCNPJ } from '@/lib/cnpj'
import { normalizeSellerName } from '@/lib/vendedorFilterHelper'
import { normalizeNumberBR } from '@/lib/utils'

export type MigrationTargetCollection =
  | 'factories'
  | 'orders'
  | 'tasks'
  | 'visits'
  | 'produtos'
  | 'metas'
  | 'atividades'
  | 'planos_acao'
  | 'equipe'
  | 'gestao_tecnica'
  | 'historico_vendas'
  | 'faturamento'
  | 'pedidos'

export interface LocalStorageKeyInfo {
  key: string
  targetCollection: MigrationTargetCollection
  label: string
  count: number
  rawItems: Record<string, unknown>[]
}

export interface TableMigrationReport {
  targetCollection: MigrationTargetCollection
  label: string
  totalFound: number
  imported: number
  updated: number
  skippedDuplicates: number
  importedIncomplete: number
  failed: number
  conflicts: number
  errors: Array<{
    recordIdentifier: string
    reason: string
  }>
  incompletes: Array<{
    recordIdentifier: string
    missingFields: string[]
  }>
}

export interface MigrationSummaryReport {
  tables: Record<string, TableMigrationReport>
  totalFound: number
  totalImported: number
  totalUpdated: number
  totalSkippedDuplicates: number
  totalIncomplete: number
  totalFailed: number
  totalConflicts: number
  startedAt: string
  completedAt: string
}

export interface MigrationProgress {
  currentTableIndex: number
  totalTables: number
  currentTableLabel: string
  currentItemIndex: number
  totalItemsInTable: number
  overallPercent: number
  statusText: string
}

/**
 * Mapeamento de chaves conhecidas ou padrões de chave do localStorage para coleções PB
 */
export const KNOWN_KEY_PATTERNS: Array<{
  regex: RegExp
  targetCollection: MigrationTargetCollection
  label: string
}> = [
  // Clientes / Fábricas
  {
    regex: /^(blink_)?factories(_v\d+)?$/i,
    targetCollection: 'factories',
    label: 'Clientes / Fábricas (factories)',
  },
  {
    regex: /^(blink_)?clientes(_v\d+)?$/i,
    targetCollection: 'factories',
    label: 'Clientes / Fábricas (clientes)',
  },
  // Pedidos
  {
    regex: /^(blink_)?orders(_v\d+)?$/i,
    targetCollection: 'orders',
    label: 'Pedidos de Venda (orders)',
  },
  {
    regex: /^(blink_)?pedidos(_v\d+)?$/i,
    targetCollection: 'pedidos',
    label: 'Gestão de Pedidos (pedidos)',
  },
  // Tarefas
  {
    regex: /^(blink_)?tasks(_v\d+)?$/i,
    targetCollection: 'tasks',
    label: 'Tarefas de Fábrica (tasks)',
  },
  {
    regex: /^(blink_)?agenda(_tasks)?(_v\d+)?$/i,
    targetCollection: 'tasks',
    label: 'Agenda de Tarefas (agenda_tasks)',
  },
  // Visitas
  {
    regex: /^(blink_)?visits(_v\d+)?$/i,
    targetCollection: 'visits',
    label: 'Visitas Comerciais (visits)',
  },
  // Produtos
  {
    regex: /^(blink_)?produtos?(_v\d+)?$/i,
    targetCollection: 'produtos',
    label: 'Catálogo de Produtos (produtos)',
  },
  // Metas
  {
    regex: /^(blink_)?metas(_v\d+)?$/i,
    targetCollection: 'metas',
    label: 'Metas Comerciais (metas)',
  },
  // Atividades
  {
    regex: /^(blink_)?atividades?(_v\d+)?$/i,
    targetCollection: 'atividades',
    label: 'Atividades Comerciais (atividades)',
  },
  // Planos de ação
  {
    regex: /^(blink_)?planos?(_acao)?(_v\d+)?$/i,
    targetCollection: 'planos_acao',
    label: 'Planos de Ação (planos_acao)',
  },
  // Equipe
  {
    regex: /^(blink_)?equipe(_v\d+)?$/i,
    targetCollection: 'equipe',
    label: 'Membros da Equipe (equipe)',
  },
  // Gestão Técnica
  {
    regex: /^(blink_)?gestao_tecnica(_v\d+)?$/i,
    targetCollection: 'gestao_tecnica',
    label: 'Gestão Técnica (gestao_tecnica)',
  },
  // Histórico de Vendas
  {
    regex: /^(blink_)?historico_vendas(_v\d+)?$/i,
    targetCollection: 'historico_vendas',
    label: 'Histórico de Vendas (historico_vendas)',
  },
  // Faturamento
  {
    regex: /^(blink_)?faturamento(_v\d+)?$/i,
    targetCollection: 'faturamento',
    label: 'Faturamento (faturamento)',
  },
]

// Chaves do localStorage a ignorar explicitamente (preferências, tokens, cache etc)
const IGNORED_STORAGE_KEYS = new Set([
  'blink_lang',
  'blink-theme',
  'pocketbase_auth',
  'debug',
  'loglevel',
])

/**
 * Escaneia o localStorage em busca de todas as chaves de dados da aplicação.
 */
export function detectLocalStorageData(): LocalStorageKeyInfo[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return []
  }

  const results: LocalStorageKeyInfo[] = []
  const storage = window.localStorage
  const length = storage.length

  for (let i = 0; i < length; i++) {
    const key = storage.key(i)
    if (!key) continue
    if (IGNORED_STORAGE_KEYS.has(key)) continue

    let matchedPattern = KNOWN_KEY_PATTERNS.find((p) => p.regex.test(key))

    const rawValue = storage.getItem(key)
    if (!rawValue) continue

    let parsed: unknown
    try {
      parsed = JSON.parse(rawValue)
    } catch {
      // Ignora chaves que não sejam JSON válido
      continue
    }

    // Apenas coleções que contenham array de registros ou registros individuais
    let items: Record<string, unknown>[] = []
    if (Array.isArray(parsed)) {
      items = parsed.filter(
        (it): it is Record<string, unknown> => typeof it === 'object' && it !== null,
      )
    } else if (typeof parsed === 'object' && parsed !== null) {
      // Caso seja um objeto contendo array ex: { data: [...] } ou registro único
      const obj = parsed as Record<string, unknown>
      if (Array.isArray(obj.items)) {
        items = obj.items.filter(
          (it): it is Record<string, unknown> => typeof it === 'object' && it !== null,
        )
      } else if (Array.isArray(obj.data)) {
        items = obj.data.filter(
          (it): it is Record<string, unknown> => typeof it === 'object' && it !== null,
        )
      } else if (Array.isArray(obj.records)) {
        items = obj.records.filter(
          (it): it is Record<string, unknown> => typeof it === 'object' && it !== null,
        )
      } else if (!matchedPattern && (obj.name || obj.cnpj || obj.product || obj.title)) {
        // Objeto único compatível
        items = [obj]
      }
    }

    if (items.length === 0) continue

    // Se a chave não coincidiu com nenhuma conhecida mas tem itens, tenta inferir pelo primeiro item
    if (!matchedPattern && items.length > 0) {
      const sample = items[0]
      if ('cnpj' in sample || 'operationTypes' in sample || 'funnelStage' in sample) {
        matchedPattern = {
          regex: new RegExp(`^${key}$`),
          targetCollection: 'factories',
          label: `Clientes (${key})`,
        }
      } else if (('product' in sample && 'unitValue' in sample) || 'orderDate' in sample) {
        matchedPattern = {
          regex: new RegExp(`^${key}$`),
          targetCollection: 'orders',
          label: `Pedidos (${key})`,
        }
      } else if ('dueDate' in sample || ('priority' in sample && 'completed' in sample)) {
        matchedPattern = {
          regex: new RegExp(`^${key}$`),
          targetCollection: 'tasks',
          label: `Tarefas (${key})`,
        }
      } else if ('potentialValue' in sample && ('date' in sample || 'visit_date' in sample)) {
        matchedPattern = {
          regex: new RegExp(`^${key}$`),
          targetCollection: 'visits',
          label: `Visitas (${key})`,
        }
      }
    }

    if (!matchedPattern) continue

    results.push({
      key,
      targetCollection: matchedPattern.targetCollection,
      label: matchedPattern.label,
      count: items.length,
      rawItems: items,
    })
  }

  // Ordena por prioridade: factories primeiro, depois orders, tasks, etc
  const priorityOrder: MigrationTargetCollection[] = [
    'factories',
    'produtos',
    'gestao_tecnica',
    'equipe',
    'orders',
    'pedidos',
    'tasks',
    'visits',
    'atividades',
    'planos_acao',
    'metas',
    'historico_vendas',
    'faturamento',
  ]

  results.sort((a, b) => {
    const idxA = priorityOrder.indexOf(a.targetCollection)
    const idxB = priorityOrder.indexOf(b.targetCollection)
    return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB)
  })

  return results
}

/**
 * Limpa todos os campos de texto recursivamente (trim)
 */
export function sanitizeRecordStrings(record: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(record)) {
    if (typeof val === 'string') {
      const trimmed = val.trim()
      result[key] = trimmed
    } else if (Array.isArray(val)) {
      result[key] = val.map((item) =>
        typeof item === 'string'
          ? item.trim()
          : typeof item === 'object' && item !== null
            ? sanitizeRecordStrings(item as Record<string, unknown>)
            : item,
      )
    } else if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
      result[key] = sanitizeRecordStrings(val as Record<string, unknown>)
    } else {
      result[key] = val
    }
  }
  return result
}

/**
 * Valida se um objeto está completamente vazio (todos os campos vazios/nulos/indefinidos)
 */
export function isRecordEmpty(rec: Record<string, unknown>): boolean {
  const keys = Object.keys(rec)
  if (keys.length === 0) return true

  for (const k of keys) {
    if (k === 'id' || k === 'created' || k === 'updated') continue
    const v = rec[k]
    if (v === null || v === undefined) continue
    if (typeof v === 'string' && v.trim() !== '') return false
    if (typeof v === 'number' && !isNaN(v) && v !== 0) return false
    if (typeof v === 'boolean') return false
    if (Array.isArray(v) && v.length > 0) return false
    if (typeof v === 'object' && Object.keys(v).length > 0) return false
  }
  return true
}

/**
 * Tenta normalizar uma string para data ISO válida, mantendo null se inválida
 */
export function parseDateSafe(val: unknown): string | null {
  if (!val) return null
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val.toISOString()
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const s = String(val).trim()
    if (!s) return null

    // Caso dd/mm/yyyy
    const brMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
    if (brMatch) {
      const [, day, month, year] = brMatch
      const d = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0)
      return isNaN(d.getTime()) ? null : d.toISOString()
    }

    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  return null
}

/**
 * Converte campos numéricos de forma tolerante (com suporte ao padrão BR)
 */
export function parseNumberSafe(val: unknown, fallback = 0): number {
  if (typeof val === 'number') {
    return isNaN(val) ? fallback : val
  }
  if (typeof val === 'string') {
    return normalizeNumberBR(val)
  }
  return fallback
}

/**
 * Aplica regra canônica de vendedor: João Pedro -> João Figueiredo
 */
export function canonicalizeVendorFields(record: Record<string, unknown>): Record<string, unknown> {
  const cloned = { ...record }

  const vendorFields = [
    'vendedor',
    'vendedor_name',
    'vendedor_nome',
    'salesOwnerName',
    'gestor_tecnico_name',
    'contactName',
  ]

  for (const field of vendorFields) {
    if (typeof cloned[field] === 'string') {
      cloned[field] = normalizeSellerName(cloned[field] as string)
    }
  }

  return cloned
}

/**
 * Retorna a chave natural de um registro de acordo com a coleção
 */
export function extractNaturalKey(
  collection: MigrationTargetCollection,
  record: Record<string, unknown>,
): string {
  switch (collection) {
    case 'factories': {
      // 1. CNPJ limpo (apenas dígitos)
      const rawCnpj = record.cnpj || record.client_cnpj || record.cliente_cnpj
      const digits = cleanDigits(String(rawCnpj || ''))
      if (digits && digits.length >= 8) {
        return `cnpj:${digits}`
      }
      // Fallback: nome normalizado + cidade
      const name = String(record.name || record.razao_social || record.cliente || '')
        .trim()
        .toLowerCase()
      const city = String(record.city || record.cidade || '')
        .trim()
        .toLowerCase()
      if (name) {
        return `name:${name}|city:${city}`
      }
      // Se não houver nome, usa id local
      return `id:${String(record.id || Math.random().toString(36))}`
    }
    case 'orders': {
      // Pedido: cliente + produto + data + quantidade
      const client = String(record.client_name || record.factoryId || '')
        .trim()
        .toLowerCase()
      const product = String(record.product || record.product_code || '')
        .trim()
        .toLowerCase()
      const date = String(record.order_date || record.orderDate || '').slice(0, 10)
      const qty = String(record.quantity || 0)
      if (client && product) {
        return `order:${client}|${product}|${date}|${qty}`
      }
      return `id:${String(record.id || Math.random().toString(36))}`
    }
    case 'pedidos': {
      const num = String(record.numeroPedido || record.nfNumero || '').trim()
      if (num) return `ped:${num}`
      const c = String(record.cliente_nome || record.clienteId || '')
        .trim()
        .toLowerCase()
      const d = String(record.dataPedido || '').slice(0, 10)
      const p = String(record.produto_codigo || record.produto_nome || '')
        .trim()
        .toLowerCase()
      return `ped:${c}|${p}|${d}`
    }
    case 'tasks': {
      const title = String(record.title || record.description || '')
        .trim()
        .toLowerCase()
      const due = String(record.due_date || record.dueDate || '').slice(0, 10)
      const fact = String(record.related_factory_id || record.factoryId || '').trim()
      if (title) return `task:${title}|${due}|${fact}`
      return `id:${String(record.id || Math.random().toString(36))}`
    }
    case 'visits': {
      const fact = String(record.factory_id || record.factoryId || '').trim()
      const date = String(record.visit_date || record.date || '').slice(0, 10)
      if (fact && date) return `visit:${fact}|${date}`
      return `id:${String(record.id || Math.random().toString(36))}`
    }
    case 'produtos': {
      const cod = String(record.codigo || '')
        .trim()
        .toUpperCase()
      if (cod) return `prod_cod:${cod}`
      const nom = String(record.nome || '')
        .trim()
        .toLowerCase()
      return `prod_nom:${nom}`
    }
    case 'metas': {
      const vend = String(record.vendedor_id || record.vendedor || record.vendedor_nome || '')
        .trim()
        .toLowerCase()
      const seg = String(record.segmento || record.especie || '')
        .trim()
        .toUpperCase()
      const mes = String(record.mes || '')
      const ano = String(record.ano || '')
      return `meta:${vend}|${seg}|${mes}|${ano}`
    }
    case 'atividades': {
      const cli = String(record.cliente_id || '').trim()
      const tipo = String(record.tipo_atividade || '').trim()
      const data = String(record.created || record.data_proxima_acao || '').slice(0, 10)
      const desc = String(record.descricao || '')
        .slice(0, 30)
        .trim()
        .toLowerCase()
      return `ativ:${cli}|${tipo}|${data}|${desc}`
    }
    case 'planos_acao': {
      const desc = String(record.descricao || '')
        .trim()
        .toLowerCase()
      const cli = String(record.cliente || '').trim()
      return `plano:${cli}|${desc}`
    }
    case 'equipe':
    case 'gestao_tecnica': {
      const nome = String(record.nome || '')
        .trim()
        .toLowerCase()
      return `membro:${nome}`
    }
    case 'historico_vendas': {
      const doc = String(record.numero_documento || '').trim()
      const cli = String(record.cliente || record.cliente_cnpj || '').trim()
      const data = String(record.data || '').slice(0, 10)
      const val = String(record.valor || 0)
      if (doc) return `hv_doc:${doc}|${cli}`
      return `hv:${cli}|${data}|${val}`
    }
    case 'faturamento': {
      const anoMes = String(record.nf_ano_mes || '')
      const cli = String(record.cliente_codigo || record.cliente_nome || '').trim()
      const prod = String(record.produto_codigo || '').trim()
      return `fat:${anoMes}|${cli}|${prod}`
    }
    default:
      return `id:${String(record.id || Math.random().toString(36))}`
  }
}

/**
 * Validação de campos obrigatórios e retorno dos faltantes
 */
export function checkRequiredFields(
  collection: MigrationTargetCollection,
  record: Record<string, unknown>,
): string[] {
  const missing: string[] = []
  switch (collection) {
    case 'factories': {
      if (!record.name && !record.razao_social) missing.push('name')
      break
    }
    case 'orders': {
      if (!record.product && !record.product_code) missing.push('product')
      if (record.quantity === undefined && record.quantidade === undefined) missing.push('quantity')
      break
    }
    case 'pedidos': {
      if (!record.cliente_nome && !record.clienteId) missing.push('cliente_nome')
      break
    }
    case 'tasks': {
      if (!record.title && !record.description) missing.push('title')
      break
    }
    case 'visits': {
      if (!record.factory_id && !record.factoryId) missing.push('factory_id')
      break
    }
    case 'produtos': {
      if (!record.nome) missing.push('nome')
      if (!record.codigo) missing.push('codigo')
      break
    }
    case 'metas': {
      if (!record.meta_valor && !record.valor_meta) missing.push('meta_valor')
      break
    }
    default:
      break
  }
  return missing
}

/**
 * Normaliza o payload para o formato aceito pelas coleções PocketBase
 */
export function transformRecordForPB(
  collection: MigrationTargetCollection,
  raw: Record<string, unknown>,
  currentUserId?: string,
): { payload: Record<string, unknown>; missingFields: string[] } {
  // 1. Sanitizar strings
  let sanitized = sanitizeRecordStrings(raw)
  // 2. Vendedor canônico
  sanitized = canonicalizeVendorFields(sanitized)

  const payload: Record<string, unknown> = {}
  const missingFields = checkRequiredFields(collection, sanitized)

  switch (collection) {
    case 'factories': {
      const rawCnpj = sanitized.cnpj || sanitized.client_cnpj || sanitized.cliente_cnpj
      const cleanCnpjDigits = rawCnpj ? cleanDigits(String(rawCnpj)) : ''
      const name = String(sanitized.name || sanitized.razao_social || sanitized.nome || '').trim()

      payload.name = name
      payload.cnpj = cleanCnpjDigits || (rawCnpj ? String(rawCnpj) : '')
      payload.city = String(sanitized.city || sanitized.cidade || '').trim()
      payload.state = String(sanitized.state || sanitized.uf || sanitized.estado || '')
        .trim()
        .toUpperCase()
      payload.country = String(sanitized.country || sanitized.pais || 'Brasil').trim()
      payload.contactName = String(
        sanitized.contactName || sanitized.contato || sanitized.contact || '',
      ).trim()
      payload.contactPhone = String(
        sanitized.contactPhone || sanitized.telefone || sanitized.phone || '',
      ).trim()
      payload.contact_email = String(sanitized.contact_email || sanitized.email || '').trim()
      payload.notes = String(sanitized.notes || sanitized.observacoes || '').trim()
      payload.suggested_approach = String(sanitized.suggested_approach || '').trim()
      payload.operationTypes = String(sanitized.operationTypes || '').trim()
      payload.productInterests = String(sanitized.productInterests || '').trim()
      payload.capacity = parseNumberSafe(sanitized.capacity, 0)
      payload.potentialValue = parseNumberSafe(
        sanitized.potentialValue ?? sanitized.potential_value,
        0,
      )
      payload.winProbability = parseNumberSafe(sanitized.winProbability, 10)
      payload.focusLevel = parseNumberSafe(sanitized.focusLevel, 3)
      payload.valor_medio = parseNumberSafe(sanitized.valor_medio, 0)
      payload.valor_atual = parseNumberSafe(sanitized.valor_atual, 0)

      // Datas
      const lastInt = parseDateSafe(sanitized.lastInteraction)
      if (lastInt) payload.lastInteraction = lastInt
      const ultimoPed = parseDateSafe(sanitized.ultimo_pedido)
      if (ultimoPed) payload.ultimo_pedido = ultimoPed

      // Campos de endereço
      payload.cep = String(sanitized.cep || '').trim()
      payload.logradouro = String(
        sanitized.logradouro || sanitized.rua || sanitized.street || '',
      ).trim()
      payload.numero = String(sanitized.numero || sanitized.number || '').trim()
      payload.bairro = String(sanitized.bairro || sanitized.neighborhood || '').trim()
      payload.complemento = String(sanitized.complemento || '').trim()

      const lat = parseNumberSafe(sanitized.latitude ?? sanitized.lat, 0)
      const lng = parseNumberSafe(sanitized.longitude ?? sanitized.lng, 0)
      if (lat !== 0) payload.latitude = lat
      if (lng !== 0) payload.longitude = lng
      if (lat !== 0) payload.lat = lat
      if (lng !== 0) payload.lng = lng

      if (sanitized.precisao) payload.precisao = sanitized.precisao
      if (sanitized.funnelStage) payload.funnelStage = sanitized.funnelStage
      if (sanitized.status_funil) payload.status_funil = sanitized.status_funil
      if (sanitized.carteira) payload.carteira = sanitized.carteira
      if (sanitized.grupo_cliente) payload.grupo_cliente = sanitized.grupo_cliente
      if (sanitized.tipo) payload.tipo = sanitized.tipo

      if (sanitized.salesOwner) payload.salesOwner = sanitized.salesOwner
      else if (currentUserId) payload.salesOwner = currentUserId

      if (sanitized.vendedor_id) payload.vendedor_id = sanitized.vendedor_id
      if (sanitized.gestor_tecnico_id) payload.gestor_tecnico_id = sanitized.gestor_tecnico_id

      break
    }
    case 'orders': {
      const qty = parseNumberSafe(sanitized.quantity ?? sanitized.quantidade, 0)
      const unit = parseNumberSafe(
        sanitized.unitValue ?? sanitized.unit_value ?? sanitized.preco_unitario,
        0,
      )
      const total = parseNumberSafe(sanitized.totalValue ?? sanitized.total_value, qty * unit)
      const orderDate =
        parseDateSafe(sanitized.orderDate ?? sanitized.order_date ?? sanitized.created) ||
        new Date().toISOString()

      payload.product = String(
        sanitized.product || sanitized.produto || sanitized.nome || 'Produto',
      ).trim()
      payload.quantity = qty
      payload.unitValue = unit
      payload.unit_value = unit
      payload.totalValue = total
      payload.total_value = total
      payload.orderDate = orderDate
      payload.order_date = orderDate
      payload.status = String(sanitized.status || 'aberto').trim()
      payload.notes = String(sanitized.notes || sanitized.observacoes || '').trim()
      payload.country = String(sanitized.country || 'Brasil').trim()
      payload.region = String(sanitized.region || '').trim()
      payload.client_name = String(
        sanitized.client_name || sanitized.cliente || sanitized.factoryName || '',
      ).trim()
      if (sanitized.factoryId) payload.factoryId = sanitized.factoryId
      if (sanitized.line) payload.line = String(sanitized.line).trim()
      if (sanitized.user_id) payload.user_id = sanitized.user_id
      else if (currentUserId) payload.user_id = currentUserId
      break
    }
    case 'pedidos': {
      payload.cliente_nome = String(sanitized.cliente_nome || sanitized.cliente || '').trim()
      payload.cliente_documento = String(sanitized.cliente_documento || sanitized.cnpj || '').trim()
      payload.produto_nome = String(sanitized.produto_nome || sanitized.product || '').trim()
      payload.produto_codigo = String(sanitized.produto_codigo || '').trim()
      payload.quantidade = parseNumberSafe(sanitized.quantidade ?? sanitized.quantity, 0)
      payload.valorUnitario = parseNumberSafe(sanitized.valorUnitario ?? sanitized.unitValue, 0)
      payload.valorTotal = parseNumberSafe(sanitized.valorTotal ?? sanitized.totalValue, 0)
      payload.total_geral = parseNumberSafe(sanitized.total_geral ?? sanitized.totalValue, 0)
      payload.status = sanitized.status || 'ABERTO'
      if (currentUserId && !sanitized.user_id) payload.user_id = currentUserId
      break
    }
    case 'tasks': {
      const title = String(sanitized.title || sanitized.description || 'Tarefa sem título').trim()
      const desc = String(sanitized.description || sanitized.title || '').trim()
      const due = parseDateSafe(sanitized.dueDate ?? sanitized.due_date)

      payload.title = title
      payload.description = desc
      if (due) payload.due_date = due
      payload.status = sanitized.completed ? 'concluida' : String(sanitized.status || 'pendente')
      payload.priority = String(sanitized.priority || 'Média')
      if (sanitized.factoryId || sanitized.related_factory_id) {
        payload.related_factory_id = sanitized.related_factory_id || sanitized.factoryId
      }
      if (sanitized.user_id) payload.user_id = sanitized.user_id
      else if (currentUserId) payload.user_id = currentUserId
      break
    }
    case 'visits': {
      const vDate =
        parseDateSafe(sanitized.visit_date ?? sanitized.date) || new Date().toISOString()
      payload.visit_date = vDate
      payload.notes = String(sanitized.notes || sanitized.summary || '').trim()
      payload.potential_value = parseNumberSafe(
        sanitized.potential_value ?? sanitized.potentialValue,
        0,
      )
      payload.outcome = String(sanitized.outcome || '').trim()
      if (sanitized.factory_id || sanitized.factoryId) {
        payload.factory_id = sanitized.factory_id || sanitized.factoryId
      }
      if (sanitized.user_id) payload.user_id = sanitized.user_id
      else if (currentUserId) payload.user_id = currentUserId
      break
    }
    case 'produtos': {
      payload.codigo = String(sanitized.codigo || '')
        .trim()
        .toUpperCase()
      payload.nome = String(sanitized.nome || '').trim()
      payload.linha = String(sanitized.linha || '').trim()
      payload.preco_base = parseNumberSafe(sanitized.preco_base ?? sanitized.price, 0)
      payload.ativo = sanitized.ativo !== false
      if (sanitized.familia) payload.familia = sanitized.familia
      break
    }
    case 'metas': {
      payload.meta_valor = parseNumberSafe(sanitized.meta_valor ?? sanitized.valor_meta, 0)
      payload.valor_realizado = parseNumberSafe(sanitized.valor_realizado, 0)
      payload.periodo = String(sanitized.periodo || '').trim()
      payload.vendedor_nome = String(sanitized.vendedor_nome || sanitized.vendedor || '').trim()
      if (sanitized.mes) payload.mes = parseNumberSafe(sanitized.mes, 0)
      if (sanitized.ano) payload.ano = parseNumberSafe(sanitized.ano, 0)
      if (sanitized.segmento) payload.segmento = sanitized.segmento
      break
    }
    default: {
      // Mapeamento genérico
      for (const [k, v] of Object.entries(sanitized)) {
        if (k === 'id' || k === 'created' || k === 'updated') continue
        payload[k] = v
      }
    }
  }

  return { payload, missingFields }
}

/**
 * Deduplica uma lista de itens locais pela chave natural,
 * mantendo a versão mais recente em caso de duplicatas locais.
 */
export function deduplicateLocalRecords(
  collection: MigrationTargetCollection,
  records: Record<string, unknown>[],
): { uniqueRecords: Record<string, unknown>[]; duplicatesCount: number } {
  const map = new Map<string, Record<string, unknown>>()
  let duplicatesCount = 0

  for (const item of records) {
    if (isRecordEmpty(item)) {
      continue
    }

    const key = extractNaturalKey(collection, item)
    if (!map.has(key)) {
      map.set(key, item)
    } else {
      duplicatesCount++
      const existing = map.get(key)!
      // Decidir se a versão atual é mais recente que a existente
      const existingDate = new Date(
        String(existing.updated || existing.created || existing.lastInteraction || 0),
      ).getTime()
      const currentDate = new Date(
        String(item.updated || item.created || item.lastInteraction || 0),
      ).getTime()

      if (currentDate >= existingDate) {
        map.set(key, item)
      }
    }
  }

  return {
    uniqueRecords: Array.from(map.values()),
    duplicatesCount,
  }
}

/**
 * Busca registro no PocketBase pela chave natural para verificar existência e conflito
 */
export async function findExistingPBRecord(
  collection: MigrationTargetCollection,
  record: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  try {
    switch (collection) {
      case 'factories': {
        const rawCnpj = record.cnpj || record.client_cnpj || record.cliente_cnpj
        const cleanCnpjDigits = rawCnpj ? cleanDigits(String(rawCnpj)) : ''
        if (cleanCnpjDigits && cleanCnpjDigits.length >= 8) {
          const formatted = formatCNPJ(cleanCnpjDigits)
          const filter = `cnpj = '${cleanCnpjDigits}' || cnpj = '${formatted}'`
          const res = await pb.collection('factories').getList(1, 1, { filter })
          if (res.items.length > 0) return res.items[0] as unknown as Record<string, unknown>
        }
        // Fallback por nome
        const name = String(record.name || record.razao_social || '').trim()
        if (name) {
          const escapedName = name.replace(/'/g, "\\'")
          const res = await pb.collection('factories').getList(1, 1, {
            filter: `name = '${escapedName}'`,
          })
          if (res.items.length > 0) return res.items[0] as unknown as Record<string, unknown>
        }
        return null
      }
      case 'produtos': {
        const cod = String(record.codigo || '')
          .trim()
          .toUpperCase()
        if (cod) {
          const res = await pb.collection('produtos').getList(1, 1, {
            filter: `codigo = '${cod}'`,
          })
          if (res.items.length > 0) return res.items[0] as unknown as Record<string, unknown>
        }
        return null
      }
      case 'orders': {
        // Se houver id original e for 15 chars pb
        if (record.id && typeof record.id === 'string' && /^[a-z0-9]{15}$/.test(record.id)) {
          try {
            const found = await pb.collection('orders').getOne(record.id)
            return found as unknown as Record<string, unknown>
          } catch {
            // ignore
          }
        }
        return null
      }
      default: {
        if (record.id && typeof record.id === 'string' && /^[a-z0-9]{15}$/.test(record.id)) {
          try {
            const found = await pb.collection(collection).getOne(record.id)
            return found as unknown as Record<string, unknown>
          } catch {
            // ignore
          }
        }
        return null
      }
    }
  } catch (err) {
    console.warn(`[findExistingPBRecord] Erro ao buscar em ${collection}:`, err)
    return null
  }
}

/**
 * Avalia se o registro no PocketBase é mais recente que o do localStorage.
 * Retorna true se o PB for mais recente ou igual (conflito: manter DB).
 */
export function isDBVersionNewer(
  dbRecord: Record<string, unknown>,
  localRecord: Record<string, unknown>,
): boolean {
  const dbTime = new Date(String(dbRecord.updated || dbRecord.created || 0)).getTime()
  const localTime = new Date(
    String(localRecord.updated || localRecord.created || localRecord.lastInteraction || 0),
  ).getTime()

  // Se o DB já foi criado/atualizado mais recentemente, manter versão do banco
  if (dbTime > localTime && localTime > 0) {
    return true
  }
  return false
}

/**
 * Executa a migração completa, chamando callbacks de progresso.
 */
export async function runDataMigration(
  datasets: LocalStorageKeyInfo[],
  options?: {
    onProgress?: (progress: MigrationProgress) => void
    resumeFromTableIndex?: number
  },
): Promise<MigrationSummaryReport> {
  const startedAt = new Date().toISOString()
  const currentUserId = pb.authStore.record?.id
  const totalTables = datasets.length
  const startIndex = options?.resumeFromTableIndex ?? 0

  const summaryReport: MigrationSummaryReport = {
    tables: {},
    totalFound: 0,
    totalImported: 0,
    totalUpdated: 0,
    totalSkippedDuplicates: 0,
    totalIncomplete: 0,
    totalFailed: 0,
    totalConflicts: 0,
    startedAt,
    completedAt: '',
  }

  // Contabilizar total geral encontrado
  for (const ds of datasets) {
    summaryReport.totalFound += ds.rawItems.length
  }

  const touchedCollections = new Set<string>()

  for (let tIdx = startIndex; tIdx < totalTables; tIdx++) {
    const ds = datasets[tIdx]
    const tableReport: TableMigrationReport = {
      targetCollection: ds.targetCollection,
      label: ds.label,
      totalFound: ds.rawItems.length,
      imported: 0,
      updated: 0,
      skippedDuplicates: 0,
      importedIncomplete: 0,
      failed: 0,
      conflicts: 0,
      errors: [],
      incompletes: [],
    }

    options?.onProgress?.({
      currentTableIndex: tIdx,
      totalTables,
      currentTableLabel: ds.label,
      currentItemIndex: 0,
      totalItemsInTable: ds.rawItems.length,
      overallPercent: Math.round((tIdx / totalTables) * 100),
      statusText: `Processando tabela: ${ds.label}`,
    })

    // 1. Deduplicação e limpeza de vazios
    const { uniqueRecords, duplicatesCount } = deduplicateLocalRecords(
      ds.targetCollection,
      ds.rawItems,
    )
    tableReport.skippedDuplicates += duplicatesCount

    // 2. Processar registros um a um com try/catch isolado
    const totalItems = uniqueRecords.length

    for (let i = 0; i < totalItems; i++) {
      const item = uniqueRecords[i]
      const naturalKey = extractNaturalKey(ds.targetCollection, item)
      const recordIdentifier = String(
        item.name || item.razao_social || item.product || item.title || naturalKey,
      )

      options?.onProgress?.({
        currentTableIndex: tIdx,
        totalTables,
        currentTableLabel: ds.label,
        currentItemIndex: i + 1,
        totalItemsInTable: totalItems,
        overallPercent: Math.round(((tIdx + (i + 1) / totalItems) / totalTables) * 100),
        statusText: `Gravando registro ${i + 1} de ${totalItems} em ${ds.label}...`,
      })

      try {
        const { payload, missingFields } = transformRecordForPB(
          ds.targetCollection,
          item,
          currentUserId,
        )

        const isIncomplete = missingFields.length > 0
        if (isIncomplete) {
          tableReport.importedIncomplete++
          tableReport.incompletes.push({
            recordIdentifier,
            missingFields,
          })
        }

        // Verificar existência no PocketBase
        const existingPB = await findExistingPBRecord(ds.targetCollection, item)

        if (existingPB && existingPB.id) {
          // Registro já existe. Comparar timestamps para evitar sobrescrever versão mais recente do banco
          if (isDBVersionNewer(existingPB, item)) {
            // Conflito: banco de dados é mais novo. Manter versão do banco!
            tableReport.conflicts++
            tableReport.errors.push({
              recordIdentifier,
              reason: `Conflito de versão: o registro no banco de dados (${existingPB.id}) é mais recente que os dados locais. Versão do banco preservada.`,
            })
            continue
          }

          // Atualizar registro existente
          await pb.collection(ds.targetCollection).update(String(existingPB.id), payload)
          tableReport.updated++
          touchedCollections.add(ds.targetCollection)
        } else {
          // Criar novo registro no PocketBase
          await pb.collection(ds.targetCollection).create(payload)
          tableReport.imported++
          touchedCollections.add(ds.targetCollection)
        }
      } catch (err: unknown) {
        tableReport.failed++
        const errMsg = err instanceof Error ? err.message : String(err)
        tableReport.errors.push({
          recordIdentifier,
          reason: errMsg,
        })
      }
    }

    summaryReport.tables[ds.key] = tableReport
    summaryReport.totalImported += tableReport.imported
    summaryReport.totalUpdated += tableReport.updated
    summaryReport.totalSkippedDuplicates += tableReport.skippedDuplicates
    summaryReport.totalIncomplete += tableReport.importedIncomplete
    summaryReport.totalFailed += tableReport.failed
    summaryReport.totalConflicts += tableReport.conflicts
  }

  summaryReport.completedAt = new Date().toISOString()

  // Notificar o data-sync para atualizar todos os ouvintes da aplicação
  touchedCollections.forEach((col) => {
    try {
      notifyDataChanged(col)
    } catch {
      // ignore
    }
  })
  if (touchedCollections.size > 0) {
    notifyDataChanged('all')
  }

  return summaryReport
}

/**
 * Remove com segurança as chaves migradas do localStorage
 */
export function clearMigratedLocalStorageKeys(keys: string[]): {
  cleared: string[]
  retained: string[]
} {
  const cleared: string[] = []
  const retained: string[] = []

  if (typeof window === 'undefined' || !window.localStorage) {
    return { cleared, retained }
  }

  for (const k of keys) {
    try {
      window.localStorage.removeItem(k)
      cleared.push(k)
    } catch {
      retained.push(k)
    }
  }

  return { cleared, retained }
}

/**
 * Converte a lista de falhas/conflitos para formato CSV para download
 */
export function generateFailuresCsv(summary: MigrationSummaryReport): string {
  const rows: Array<{
    Tabela: string
    Identificador: string
    Tipo: string
    Motivo: string
  }> = []

  for (const [key, t] of Object.entries(summary.tables)) {
    for (const err of t.errors) {
      rows.push({
        Tabela: `${t.label} (${key})`,
        Identificador: err.recordIdentifier,
        Tipo: 'Falha/Conflito',
        Motivo: err.reason,
      })
    }
    for (const inc of t.incompletes) {
      rows.push({
        Tabela: `${t.label} (${key})`,
        Identificador: inc.recordIdentifier,
        Tipo: 'Incompleto (Importado)',
        Motivo: `Campos vazios: ${inc.missingFields.join(', ')}`,
      })
    }
  }

  if (rows.length === 0) {
    return 'Tabela,Identificador,Tipo,Motivo\nNenhum erro registrado.'
  }

  const headers = ['Tabela', 'Identificador', 'Tipo', 'Motivo']
  const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`

  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        escapeCsv(r.Tabela),
        escapeCsv(r.Identificador),
        escapeCsv(r.Tipo),
        escapeCsv(r.Motivo),
      ].join(','),
    ),
  ]

  return '\uFEFF' + lines.join('\n')
}
