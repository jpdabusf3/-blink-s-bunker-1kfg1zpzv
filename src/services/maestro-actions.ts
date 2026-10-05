/**
 * src/services/maestro-actions.ts
 *
 * Catálogo e executores de ações para o assistente MAESTRO da Blink Biotech.
 * Permite que o chat execute ações reais: importar planilhas (faturamento e clientes),
 * cadastrar/atualizar clientes, produtos, pedidos, tarefas e gerar relatórios.
 *
 * Regras mandatórias:
 * 1. Vendedor canônico: "João Figueiredo" (João Pedro é a mesma pessoa e normalizado para João Figueiredo).
 * 2. Toda mutação notifica notifyDataChanged para as coleções afetadas.
 * 3. Textos voltados ao usuário em Português (pt-BR).
 */

import pb from '@/lib/pocketbase/client'
import { notifyDataChanged } from '@/hooks/useRealtimeData'
import { importFaturamento, type FaturamentoImportResult } from '@/services/import-faturamento'
import { createFactoryPB, updateFactoryPB, getAllFactories } from '@/services/factories'
import { produtosService, type ProdutoFormData } from '@/services/produtos-service'
import { createOrder, updateOrder } from '@/services/orders'
import { createTask } from '@/services/tasks'
import { gerarRelatorioMaestro, type MaestroReportConfig } from '@/services/maestro-service'
import { normalizeSellerName } from '@/lib/vendedorFilterHelper'
import type { Factory } from '@/types'

// ==========================================
// 1. Catálogo e Tipos de Ações Suportadas
// ==========================================

export type MaestroActionType =
  | 'import_billing'
  | 'import_clients'
  | 'create_client'
  | 'update_client'
  | 'create_product'
  | 'update_product'
  | 'create_task'
  | 'create_order'
  | 'generate_report'

export interface MaestroActionDefinition {
  type: MaestroActionType
  label: string
  description: string
  requiredFields: string[]
  optionalFields: string[]
  formatConfirmation: (payload: Record<string, unknown>) => string
}

export interface MaestroActionIntent {
  action: MaestroActionType
  payload: Record<string, unknown>
  summary?: string
  confidence?: number
}

export interface MaestroActionResultDetail {
  row?: number
  reason: string
}

export interface MaestroActionResult {
  success: boolean
  message: string
  createdCount: number
  updatedCount: number
  skippedCount: number
  errorsCount: number
  errors: MaestroActionResultDetail[]
  affectedCollection?: string
  targetRecordId?: string
  navigationTab?: string
  navigationLabel?: string
}

// ==========================================
// 2. Definições do Catálogo
// ==========================================

export const MAESTRO_ACTION_CATALOG: Record<MaestroActionType, MaestroActionDefinition> = {
  import_billing: {
    type: 'import_billing',
    label: 'Importar Planilha de Faturamento',
    description: 'Processa e importa dados de notas fiscais e vendas a partir de uma planilha.',
    requiredFields: ['file_id'],
    optionalFields: ['file_name', 'criar_cliente_novo'],
    formatConfirmation: (payload) => {
      const fileName = String(payload.file_name || payload.fileName || 'arquivo anexado')
      const criarCliente = payload.criar_cliente_novo !== false ? 'Sim' : 'Não'
      return `Deseja importar a planilha de faturamento "${fileName}"? Clientes não encontrados serão cadastrados automaticamente (${criarCliente}).`
    },
  },
  import_clients: {
    type: 'import_clients',
    label: 'Importar Planilha de Clientes',
    description: 'Cadastra e atualiza empresas/clientes em lote a partir de uma planilha.',
    requiredFields: ['file_id'],
    optionalFields: ['file_name'],
    formatConfirmation: (payload) => {
      const fileName = String(payload.file_name || payload.fileName || 'arquivo anexado')
      return `Deseja importar os clientes contidos na planilha "${fileName}" para o cadastro do Bunker?`
    },
  },
  create_client: {
    type: 'create_client',
    label: 'Cadastrar Cliente / Prospecto',
    description: 'Cria uma nova empresa ou prospecto no CRM.',
    requiredFields: ['name'],
    optionalFields: [
      'cnpj',
      'city',
      'state',
      'carteira',
      'vendedor_name',
      'tipo',
      'contactName',
      'contactPhone',
      'contact_email',
      'observacoes',
    ],
    formatConfirmation: (payload) => {
      const nome = String(payload.name || payload.nome || 'Novo Cliente')
      const cnpj = payload.cnpj ? ` (CNPJ: ${payload.cnpj})` : ''
      const cidade =
        payload.city || payload.cidade
          ? ` em ${payload.city || payload.cidade}/${payload.state || payload.estado || ''}`
          : ''
      const vendedor =
        payload.vendedor_name || payload.vendedor
          ? ` | Vendedor: ${normalizeSellerName(String(payload.vendedor_name || payload.vendedor))}`
          : ''
      return `Cadastrar novo cliente "${nome}"${cnpj}${cidade}${vendedor}.`
    },
  },
  update_client: {
    type: 'update_client',
    label: 'Atualizar Cliente',
    description: 'Altera informações de um cliente existente.',
    requiredFields: ['client_id'],
    optionalFields: [
      'name',
      'cnpj',
      'city',
      'state',
      'carteira',
      'vendedor_name',
      'status_funil',
      'funnelStage',
      'observacoes',
      'contactPhone',
    ],
    formatConfirmation: (payload) => {
      const nome = String(
        payload.name || payload.nome || payload.client_name || `ID ${payload.client_id}`,
      )
      const alteracoes: string[] = []
      if (payload.vendedor_name || payload.vendedor) {
        alteracoes.push(
          `vendedor: ${normalizeSellerName(String(payload.vendedor_name || payload.vendedor))}`,
        )
      }
      if (payload.status_funil) alteracoes.push(`funil: ${payload.status_funil}`)
      if (payload.funnelStage) alteracoes.push(`etapa: ${payload.funnelStage}`)
      if (payload.carteira) alteracoes.push(`carteira: ${payload.carteira}`)
      if (payload.city || payload.cidade)
        alteracoes.push(`cidade: ${payload.city || payload.cidade}`)
      const detalhes = alteracoes.length > 0 ? ` (${alteracoes.join(', ')})` : ''
      return `Atualizar os dados do cliente "${nome}"${detalhes}.`
    },
  },
  create_product: {
    type: 'create_product',
    label: 'Cadastrar Produto',
    description: 'Adiciona um novo produto ao catálogo oficial Blink.',
    requiredFields: ['codigo', 'nome'],
    optionalFields: ['familia', 'categoria', 'linha'],
    formatConfirmation: (payload) => {
      const cod = String(payload.codigo || '').toUpperCase()
      const nome = String(payload.nome || '')
      return `Cadastrar o produto "${nome}" com o código SKU ${cod} no catálogo.`
    },
  },
  update_product: {
    type: 'update_product',
    label: 'Atualizar Produto',
    description: 'Atualiza o código ou nome de um produto do catálogo.',
    requiredFields: ['product_id', 'nome'],
    optionalFields: ['codigo', 'familia'],
    formatConfirmation: (payload) => {
      const nome = String(payload.nome || '')
      const cod = payload.codigo ? ` (Código: ${String(payload.codigo).toUpperCase()})` : ''
      return `Atualizar o produto no catálogo para "${nome}"${cod}.`
    },
  },
  create_task: {
    type: 'create_task',
    label: 'Criar Tarefa',
    description: 'Agenda uma nova tarefa ou follow-up comercial.',
    requiredFields: ['title'],
    optionalFields: ['description', 'due_date', 'priority', 'client_id', 'client_name', 'type'],
    formatConfirmation: (payload) => {
      const titulo = String(payload.title || payload.titulo || 'Nova Tarefa')
      const data =
        payload.due_date || payload.dueDate ? ` para ${payload.due_date || payload.dueDate}` : ''
      const cliente =
        payload.client_name || payload.cliente
          ? ` vinculada ao cliente ${payload.client_name || payload.cliente}`
          : ''
      return `Agendar tarefa "${titulo}"${data}${cliente}.`
    },
  },
  create_order: {
    type: 'create_order',
    label: 'Criar Pedido de Venda',
    description: 'Registra um novo pedido comercial no sistema.',
    requiredFields: ['product', 'quantity'],
    optionalFields: [
      'client_name',
      'client_id',
      'unit_value',
      'total_value',
      'order_date',
      'notes',
      'status',
    ],
    formatConfirmation: (payload) => {
      const prod = String(payload.product || payload.produto || 'Produto')
      const qtd = Number(payload.quantity || payload.quantidade || 1)
      const cliente =
        payload.client_name || payload.cliente
          ? ` para ${payload.client_name || payload.cliente}`
          : ''
      const valor =
        payload.total_value || payload.unit_value
          ? ` no valor estimado de R$ ${Number(payload.total_value || Number(payload.unit_value) * qtd).toFixed(2)}`
          : ''
      return `Criar pedido de ${qtd} unidade(s) de "${prod}"${cliente}${valor}.`
    },
  },
  generate_report: {
    type: 'generate_report',
    label: 'Gerar Relatório de Vendas',
    description: 'Emite demonstrativo comercial consolidado em PDF oficial.',
    requiredFields: ['periodo'],
    optionalFields: ['ano', 'mes', 'modo', 'filtros', 'dados_inclusos'],
    formatConfirmation: (payload) => {
      const periodo = String(
        payload.periodo ||
          (payload.ano && payload.mes ? `${payload.ano}-${payload.mes}` : 'período recente'),
      )
      return `Gerar relatório comercial oficial da Blink para o período ${periodo}.`
    },
  },
}

// ==========================================
// 3. Parser de Intenção do Assistente
// ==========================================

/**
 * Analisa a resposta do agente Maestro em busca de um bloco estruturado de ação.
 * Aceita blocos com tipo de ação definido em JSON no padrão:
 * ```json
 * {
 *   "action": "create_client" | "import_billing" | ...,
 *   "payload": { ... }
 * }
 * ```
 * Também aceita blocos com "tipo": "relatorio_vendas_maestro" ou "action": "..."
 */
export function parseMaestroActionIntent(text: string): MaestroActionIntent | null {
  if (!text || typeof text !== 'string') return null

  // 1. Procurar em blocos ```json ... ```
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const raw = match[1].trim()
    const parsed = tryParseJson(raw)
    if (parsed) {
      const intent = extractIntentFromObject(parsed)
      if (intent) return intent
    }
  }

  // 2. Procurar em objetos JSON balanceados no texto
  const startIdx = text.indexOf('{')
  if (startIdx !== -1) {
    let scanPos = startIdx
    while (scanPos !== -1) {
      const balanced = extractBalancedJson(text, scanPos)
      if (balanced) {
        const parsed = tryParseJson(balanced)
        if (parsed) {
          const intent = extractIntentFromObject(parsed)
          if (intent) return intent
        }
      }
      scanPos = text.indexOf('{', scanPos + 1)
    }
  }

  return null
}

function tryParseJson(str: string): Record<string, unknown> | null {
  try {
    const obj = JSON.parse(str)
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      return obj as Record<string, unknown>
    }
  } catch {
    // ignore
  }
  return null
}

function extractBalancedJson(str: string, startIndex: number): string | null {
  if (startIndex < 0 || startIndex >= str.length || str[startIndex] !== '{') return null
  let depth = 0
  let inString = false
  let escape = false

  for (let i = startIndex; i < str.length; i++) {
    const c = str[i]
    if (escape) {
      escape = false
      continue
    }
    if (c === '\\') {
      escape = true
      continue
    }
    if (c === '"') {
      inString = !inString
      continue
    }
    if (!inString) {
      if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) return str.slice(startIndex, i + 1)
      }
    }
  }
  return null
}

function extractIntentFromObject(obj: Record<string, unknown>): MaestroActionIntent | null {
  // Caso A: Objeto já possui campo `action` ou `acao`
  const actionRaw = String(obj.action || obj.acao || obj.action_type || obj.tipo_acao || '')
    .toLowerCase()
    .trim()
  if (actionRaw && actionRaw in MAESTRO_ACTION_CATALOG) {
    const action = actionRaw as MaestroActionType
    const payload = (obj.payload && typeof obj.payload === 'object' ? obj.payload : obj) as Record<
      string,
      unknown
    >
    return {
      action,
      payload,
      summary: typeof obj.summary === 'string' ? obj.summary : undefined,
    }
  }

  // Caso B: Formato de relatório de vendas legado do Maestro
  if (obj.tipo === 'relatorio_vendas_maestro' || obj.tipo === 'relatorio_vendas') {
    return {
      action: 'generate_report',
      payload: obj,
      summary: 'Geração de relatório comercial consolidado.',
    }
  }

  // Caso C: Reconhecimento por campos característicos
  if (
    obj.tipo === 'novo_cliente' ||
    obj.tipo === 'cadastrar_cliente' ||
    (obj.action === undefined && obj.name && (obj.cnpj || obj.carteira || obj.vendedor_name))
  ) {
    return {
      action: 'create_client',
      payload: obj,
    }
  }

  if (
    obj.tipo === 'novo_produto' ||
    obj.tipo === 'cadastrar_produto' ||
    (obj.codigo && obj.nome && !obj.cliente && !obj.numero_documento)
  ) {
    return {
      action: 'create_product',
      payload: obj,
    }
  }

  if (
    obj.tipo === 'nova_tarefa' ||
    obj.tipo === 'criar_tarefa' ||
    (obj.title && (obj.due_date || obj.dueDate || obj.priority))
  ) {
    return {
      action: 'create_task',
      payload: obj,
    }
  }

  if (
    obj.tipo === 'novo_pedido' ||
    obj.tipo === 'criar_pedido' ||
    (obj.product && obj.quantity && (obj.client_name || obj.unit_value))
  ) {
    return {
      action: 'create_order',
      payload: obj,
    }
  }

  return null
}

// ==========================================
// 4. Executores de Ação
// ==========================================

/**
 * Normaliza o vendedor nos dados para garantir a regra canônica:
 * "João Pedro" -> "João Figueiredo"
 */
function normalizePayloadSeller(payload: Record<string, unknown>): void {
  if (payload.vendedor_name && typeof payload.vendedor_name === 'string') {
    payload.vendedor_name = normalizeSellerName(payload.vendedor_name)
  }
  if (payload.vendedor && typeof payload.vendedor === 'string') {
    payload.vendedor = normalizeSellerName(payload.vendedor)
  }
  if (payload.salesOwnerName && typeof payload.salesOwnerName === 'string') {
    payload.salesOwnerName = normalizeSellerName(payload.salesOwnerName)
  }
}

/**
 * Executor principal que despacha para o executor específico.
 * Escreve no PocketBase, aciona notifyDataChanged e formata o resultado em pt-BR.
 */
export async function executeMaestroAction(
  intent: MaestroActionIntent,
): Promise<MaestroActionResult> {
  const { action, payload } = intent
  normalizePayloadSeller(payload)

  switch (action) {
    case 'import_billing':
      return await executeImportBillingAction(payload)
    case 'import_clients':
      return await executeImportClientsAction(payload)
    case 'create_client':
      return await executeCreateClientAction(payload)
    case 'update_client':
      return await executeUpdateClientAction(payload)
    case 'create_product':
      return await executeCreateProductAction(payload)
    case 'update_product':
      return await executeUpdateProductAction(payload)
    case 'create_task':
      return await executeCreateTaskAction(payload)
    case 'create_order':
      return await executeCreateOrderAction(payload)
    case 'generate_report':
      return await executeGenerateReportAction(payload)
    default:
      throw new Error(`Ação não reconhecida pelo sistema: ${(intent as any).action}`)
  }
}

// ------------------------------------------
// 4.1 Importar Planilha de Faturamento
// ------------------------------------------
async function executeImportBillingAction(
  payload: Record<string, unknown>,
): Promise<MaestroActionResult> {
  const fileId = String(payload.file_id || payload.fileId || '')
  if (!fileId && !payload.rows) {
    throw new Error('Identificador do arquivo de faturamento (file_id) não foi fornecido.')
  }

  // Se já temos linhas mapeadas diretamente no payload
  if (Array.isArray(payload.rows) && payload.rows.length > 0) {
    const fileName = String(payload.file_name || payload.fileName || 'planilha_faturamento.xlsx')
    const res = await pb.send<FaturamentoImportResult>('/backend/v1/importar-faturamento', {
      method: 'POST',
      body: JSON.stringify({
        fileName,
        rows: payload.rows,
        options: {
          criarClienteNaoEncontrado: payload.criar_cliente_novo !== false,
          fileName,
        },
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    notifyDataChanged('faturamento')
    notifyDataChanged('historico_vendas')
    notifyDataChanged('factories')
    notifyDataChanged('import_history')

    const errors: MaestroActionResultDetail[] = (res.error_details || res.erros || []).map((e) => ({
      row: e.linha,
      reason: e.erro,
    }))

    return {
      success: res.success,
      message: `Importação de faturamento concluída: ${res.imported} registro(s) inserido(s), ${res.skipped_duplicates} duplicata(s) ignorada(s).`,
      createdCount: res.imported,
      updatedCount: 0,
      skippedCount: res.skipped_duplicates,
      errorsCount: errors.length,
      errors,
      affectedCollection: 'faturamento',
      navigationTab: '/historico-vendas',
      navigationLabel: 'Ver Faturamento / Histórico de Vendas',
    }
  }

  // Caso tenha fileId da coleção maestro_uploads: recupera o arquivo e chama importFaturamento
  const uploadRecord = await pb.collection('maestro_uploads').getOne(fileId)
  if (!uploadRecord || !uploadRecord.file) {
    throw new Error('Arquivo de faturamento não encontrado no servidor.')
  }

  const fileUrl = pb.files.getURL(uploadRecord, uploadRecord.file)
  const response = await fetch(fileUrl)
  if (!response.ok) {
    throw new Error('Não foi possível fazer o download do arquivo anexado para importação.')
  }

  const blob = await response.blob()
  const fileObj = new File([blob], uploadRecord.file_name || 'faturamento.xlsx', {
    type:
      uploadRecord.mime_type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  // Mapeamento padrão automático
  const res = await importFaturamento(
    fileObj,
    {},
    {
      criarClienteNaoEncontrado: payload.criar_cliente_novo !== false,
      fileName: fileObj.name,
    },
  )

  const errors: MaestroActionResultDetail[] = (res.error_details || res.erros || []).map((e) => ({
    row: e.linha,
    reason: e.erro,
  }))

  return {
    success: res.success,
    message: `Importação de faturamento concluída: ${res.imported} registro(s) importado(s), ${res.skipped_duplicates} ignorado(s).`,
    createdCount: res.imported,
    updatedCount: 0,
    skippedCount: res.skipped_duplicates,
    errorsCount: errors.length,
    errors,
    affectedCollection: 'faturamento',
    navigationTab: '/historico-vendas',
    navigationLabel: 'Ver Faturamento',
  }
}

// ------------------------------------------
// 4.2 Importar Planilha de Clientes
// ------------------------------------------
async function executeImportClientsAction(
  payload: Record<string, unknown>,
): Promise<MaestroActionResult> {
  const fileId = String(payload.file_id || payload.fileId || '')

  let rowsToImport: Array<Record<string, unknown>> = []

  if (Array.isArray(payload.rows) && payload.rows.length > 0) {
    rowsToImport = payload.rows as Array<Record<string, unknown>>
  } else if (fileId) {
    const uploadRecord = await pb.collection('maestro_uploads').getOne(fileId)
    if (!uploadRecord || !uploadRecord.file) {
      throw new Error('Arquivo de clientes não localizado no servidor.')
    }
    const fileUrl = pb.files.getURL(uploadRecord, uploadRecord.file)
    const resp = await fetch(fileUrl)
    const blob = await resp.blob()
    const fileObj = new File([blob], uploadRecord.file_name || 'clientes.xlsx')
    const { parseExcelPreview } = await import('@/services/import-excel')
    rowsToImport = await parseExcelPreview(fileObj, 5000)
  } else {
    throw new Error('Nenhum dado ou arquivo de clientes foi fornecido para importação.')
  }

  // Normaliza nomes de vendedores para "João Figueiredo" se aplicável
  rowsToImport.forEach((row) => {
    if (row.vendedor) row.vendedor = normalizeSellerName(String(row.vendedor))
    if (row.vendedor_name) row.vendedor_name = normalizeSellerName(String(row.vendedor_name))
  })

  const result = await pb.send<{
    success: boolean
    criados: number
    atualizados: number
    duplicatas?: number
    erros?: Array<{ linha: number; erro: string }>
  }>('/backend/v1/importar-excel', {
    method: 'POST',
    body: JSON.stringify({ rows: rowsToImport }),
    headers: { 'Content-Type': 'application/json' },
  })

  notifyDataChanged('factories')
  notifyDataChanged('activity_logs')

  const errors: MaestroActionResultDetail[] = (result.erros || []).map((e) => ({
    row: e.linha,
    reason: e.erro,
  }))

  return {
    success:
      result.success && (result.criados > 0 || result.atualizados > 0 || errors.length === 0),
    message: `Importação de clientes concluída: ${result.criados} criado(s), ${result.atualizados} atualizado(s), ${result.duplicatas || 0} ignorado(s).`,
    createdCount: result.criados,
    updatedCount: result.atualizados,
    skippedCount: result.duplicatas || 0,
    errorsCount: errors.length,
    errors,
    affectedCollection: 'factories',
    navigationTab: '/cadastro',
    navigationLabel: 'Ver Clientes',
  }
}

// ------------------------------------------
// 4.3 Criar Cliente
// ------------------------------------------
async function executeCreateClientAction(
  payload: Record<string, unknown>,
): Promise<MaestroActionResult> {
  const nome = String(payload.name || payload.nome || '').trim()
  if (!nome) {
    throw new Error('O nome do cliente é obrigatório.')
  }

  const rawCarteira = String(payload.carteira || '').toUpperCase()
  const validCarteiras = ['AVES', 'PETS', 'RUMINANTES', 'SUINOS', 'AQUA']
  const carteira = validCarteiras.includes(rawCarteira) ? rawCarteira : undefined

  const sellerName =
    payload.vendedor_name || payload.vendedor
      ? normalizeSellerName(String(payload.vendedor_name || payload.vendedor))
      : undefined

  // Se o vendedor for João Figueiredo, vincular ao id conhecido de gestao_tecnica se disponível
  let vendedorId = typeof payload.vendedor_id === 'string' ? payload.vendedor_id : undefined
  if (!vendedorId && sellerName === 'João Figueiredo') {
    vendedorId = 'rxo1gz5ovha70lu'
  }

  const factoryData: Partial<Factory> = {
    name: nome,
    cnpj: payload.cnpj ? String(payload.cnpj).trim() : undefined,
    city: payload.city
      ? String(payload.city).trim()
      : payload.cidade
        ? String(payload.cidade).trim()
        : 'Não informado',
    state: payload.state
      ? String(payload.state).trim().toUpperCase()
      : payload.estado
        ? String(payload.estado).trim().toUpperCase()
        : '',
    region: 'Sudeste',
    capacity: 0,
    potentialValue: 0,
    winProbability: 50,
    status: 'Prospect',
    lastInteraction: new Date().toISOString(),
    operationTypes: '',
    productInterests: '',
    profile_type: (payload.profile_type as any) || ['Indústria'],
    carteira: carteira as any,
    vendedor_name: sellerName,
    vendedor_id: vendedorId,
    contactName: payload.contactName
      ? String(payload.contactName)
      : payload.contato
        ? String(payload.contato)
        : '',
    contactPhone: payload.contactPhone
      ? String(payload.contactPhone)
      : payload.telefone
        ? String(payload.telefone)
        : '',
    contact_email: payload.contact_email
      ? String(payload.contact_email)
      : payload.email
        ? String(payload.email)
        : '',
    notes: payload.notes
      ? String(payload.notes)
      : payload.observacoes
        ? String(payload.observacoes)
        : '',
    observacoes: payload.observacoes
      ? String(payload.observacoes)
      : payload.notes
        ? String(payload.notes)
        : '',
    status_funil: (payload.status_funil as any) || 'Ativo',
    funnelStage: (payload.funnelStage as any) || 'Lead',
    ultima_edicao_origem: 'manual',
  }

  const created = await createFactoryPB(factoryData)
  notifyDataChanged('factories')

  return {
    success: true,
    message: `Cliente "${nome}" cadastrado com sucesso no sistema.`,
    createdCount: 1,
    updatedCount: 0,
    skippedCount: 0,
    errorsCount: 0,
    errors: [],
    affectedCollection: 'factories',
    targetRecordId: created.id,
    navigationTab: '/cadastro',
    navigationLabel: 'Ver Cadastro',
  }
}

// ------------------------------------------
// 4.4 Atualizar Cliente
// ------------------------------------------
async function executeUpdateClientAction(
  payload: Record<string, unknown>,
): Promise<MaestroActionResult> {
  let clientId = String(payload.client_id || payload.clientId || payload.id || '').trim()

  // Se não tem ID, tentar buscar por CNPJ ou por Nome
  if (!clientId) {
    const cnpj = payload.cnpj ? String(payload.cnpj).trim() : ''
    const nome = payload.name
      ? String(payload.name).trim()
      : payload.nome
        ? String(payload.nome).trim()
        : ''

    const allFactories = await getAllFactories()
    if (cnpj) {
      const match = allFactories.find(
        (f) => f.cnpj && f.cnpj.replace(/\D/g, '') === cnpj.replace(/\D/g, ''),
      )
      if (match) clientId = match.id
    }
    if (!clientId && nome) {
      const match = allFactories.find((f) => f.name.toLowerCase() === nome.toLowerCase())
      if (match) clientId = match.id
    }
  }

  if (!clientId) {
    throw new Error(
      'Não foi possível localizar o cliente para atualização. Forneça o client_id, CNPJ ou Nome exato.',
    )
  }

  const patchData: Partial<Factory> = {}
  if (payload.name) patchData.name = String(payload.name).trim()
  if (payload.cnpj) patchData.cnpj = String(payload.cnpj).trim()
  if (payload.city || payload.cidade) patchData.city = String(payload.city || payload.cidade).trim()
  if (payload.state || payload.estado)
    patchData.state = String(payload.state || payload.estado)
      .trim()
      .toUpperCase()
  if (payload.status_funil) patchData.status_funil = payload.status_funil as any
  if (payload.funnelStage) patchData.funnelStage = payload.funnelStage as any
  if (payload.carteira) {
    const rawCarteira = String(payload.carteira).toUpperCase()
    const valid = ['AVES', 'PETS', 'RUMINANTES', 'SUINOS', 'AQUA']
    if (valid.includes(rawCarteira)) patchData.carteira = rawCarteira as any
  }
  if (payload.vendedor_name || payload.vendedor) {
    const seller = normalizeSellerName(String(payload.vendedor_name || payload.vendedor))
    patchData.vendedor_name = seller
    if (seller === 'João Figueiredo') {
      patchData.vendedor_id = 'rxo1gz5ovha70lu'
    }
  }
  if (payload.contactPhone || payload.telefone) {
    patchData.contactPhone = String(payload.contactPhone || payload.telefone)
    patchData.telefone = String(payload.contactPhone || payload.telefone)
  }
  if (payload.notes || payload.observacoes) {
    patchData.notes = String(payload.notes || payload.observacoes)
    patchData.observacoes = String(payload.observacoes || payload.notes)
  }

  await updateFactoryPB(clientId, patchData)
  notifyDataChanged('factories')

  return {
    success: true,
    message: `Dados do cliente atualizados com sucesso no sistema.`,
    createdCount: 0,
    updatedCount: 1,
    skippedCount: 0,
    errorsCount: 0,
    errors: [],
    affectedCollection: 'factories',
    targetRecordId: clientId,
    navigationTab: '/cadastro',
    navigationLabel: 'Ver Cadastro',
  }
}

// ------------------------------------------
// 4.5 Criar Produto
// ------------------------------------------
async function executeCreateProductAction(
  payload: Record<string, unknown>,
): Promise<MaestroActionResult> {
  const codigo = String(payload.codigo || payload.sku || '')
    .trim()
    .toUpperCase()
  const nome = String(payload.nome || payload.name || '').trim()

  if (!codigo) throw new Error('Código do produto é obrigatório.')
  if (!nome) throw new Error('Nome do produto é obrigatório.')

  const formData: ProdutoFormData = {
    codigo,
    nome,
  }

  const created = await produtosService.createProduto(formData)
  notifyDataChanged('produtos')

  return {
    success: true,
    message: `Produto "${nome}" (${codigo}) cadastrado com sucesso no catálogo.`,
    createdCount: 1,
    updatedCount: 0,
    skippedCount: 0,
    errorsCount: 0,
    errors: [],
    affectedCollection: 'produtos',
    targetRecordId: created.id,
    navigationTab: '/produtos',
    navigationLabel: 'Ver Produtos',
  }
}

// ------------------------------------------
// 4.6 Atualizar Produto
// ------------------------------------------
async function executeUpdateProductAction(
  payload: Record<string, unknown>,
): Promise<MaestroActionResult> {
  let productId = String(payload.product_id || payload.productId || payload.id || '').trim()
  const nome = String(payload.nome || payload.name || '').trim()
  let codigo = String(payload.codigo || payload.sku || '')
    .trim()
    .toUpperCase()

  // Se não foi fornecido productId, tentar buscar por código
  if (!productId && codigo) {
    const list = await produtosService.listAll({ search: codigo })
    const match = list.find((p) => p.codigo.toUpperCase() === codigo)
    if (match) {
      productId = match.id
      if (!codigo) codigo = match.codigo
    }
  }

  if (!productId) {
    throw new Error(
      'Identificador do produto (product_id) ou código SKU existente não foi informado.',
    )
  }

  if (!nome && !codigo) {
    throw new Error('Informe o nome ou o código a ser atualizado no produto.')
  }

  // Obter produto atual para preencher campos não passados
  const existing = await pb.collection('produtos').getOne(productId)
  const finalCodigo = codigo || existing.codigo
  const finalNome = nome || existing.nome

  const updated = await produtosService.updateProduto(productId, {
    codigo: finalCodigo,
    nome: finalNome,
  })
  notifyDataChanged('produtos')

  return {
    success: true,
    message: `Produto "${finalNome}" (${finalCodigo}) atualizado com sucesso.`,
    createdCount: 0,
    updatedCount: 1,
    skippedCount: 0,
    errorsCount: 0,
    errors: [],
    affectedCollection: 'produtos',
    targetRecordId: updated.id,
    navigationTab: '/produtos',
    navigationLabel: 'Ver Produtos',
  }
}

// ------------------------------------------
// 4.7 Criar Tarefa
// ------------------------------------------
async function executeCreateTaskAction(
  payload: Record<string, unknown>,
): Promise<MaestroActionResult> {
  const title = String(
    payload.title || payload.titulo || payload.description || 'Nova Tarefa',
  ).trim()
  const description = String(payload.description || payload.descricao || title).trim()
  const dueDate = payload.due_date
    ? String(payload.due_date)
    : payload.dueDate
      ? String(payload.dueDate)
      : undefined
  const priority = (payload.priority as any) || 'Média'
  const factoryId = payload.client_id
    ? String(payload.client_id)
    : payload.factoryId
      ? String(payload.factoryId)
      : undefined

  const created = await createTask({
    title,
    description,
    due_date: dueDate,
    priority,
    related_factory_id: factoryId,
  })

  notifyDataChanged('tasks')

  return {
    success: true,
    message: `Tarefa "${title}" agendada com sucesso.`,
    createdCount: 1,
    updatedCount: 0,
    skippedCount: 0,
    errorsCount: 0,
    errors: [],
    affectedCollection: 'tasks',
    targetRecordId: created.id,
    navigationTab: '/atividades',
    navigationLabel: 'Ver Tarefas',
  }
}

// ------------------------------------------
// 4.8 Criar Pedido
// ------------------------------------------
async function executeCreateOrderAction(
  payload: Record<string, unknown>,
): Promise<MaestroActionResult> {
  const product = String(payload.product || payload.produto || '').trim()
  const qty = Number(payload.quantity || payload.quantidade || 1)
  const clientName = payload.client_name
    ? String(payload.client_name).trim()
    : payload.cliente
      ? String(payload.cliente).trim()
      : ''
  const unitValue = Number(payload.unit_value || payload.unitValue || 0)
  const totalValue = Number(payload.total_value || payload.totalValue || qty * unitValue)
  const orderDate = payload.order_date ? String(payload.order_date) : new Date().toISOString()
  const factoryId = payload.client_id
    ? String(payload.client_id)
    : payload.factoryId
      ? String(payload.factoryId)
      : undefined

  if (!product) {
    throw new Error('O produto do pedido é obrigatório.')
  }

  const created = await createOrder({
    product,
    quantity: qty,
    client_name: clientName,
    unit_value: unitValue,
    total_value: totalValue,
    order_date: orderDate,
    factoryId,
    status: (payload.status as any) || 'aberto',
    notes: payload.notes ? String(payload.notes) : '',
  })

  notifyDataChanged('orders')

  return {
    success: true,
    message: `Pedido de ${qty}x "${product}" criado com sucesso no sistema.`,
    createdCount: 1,
    updatedCount: 0,
    skippedCount: 0,
    errorsCount: 0,
    errors: [],
    affectedCollection: 'orders',
    targetRecordId: created.id,
    navigationTab: '/pedidos',
    navigationLabel: 'Ver Pedidos',
  }
}

// ------------------------------------------
// 4.9 Gerar Relatório Comercial
// ------------------------------------------
async function executeGenerateReportAction(
  payload: Record<string, unknown>,
): Promise<MaestroActionResult> {
  const modo = payload.modo === 'week' ? 'week' : 'month'
  const ano = Number(payload.ano) || new Date().getFullYear()
  const mes = payload.mes ? Number(payload.mes) : undefined
  const semana = payload.semana ? Number(payload.semana) : undefined
  const periodoStr = String(payload.periodo || `${ano}-${mes || 1}`)

  const config: MaestroReportConfig = {
    tipo: 'relatorio_vendas_maestro',
    periodo: periodoStr,
    ano,
    mes,
    semana,
    modo,
    filtros: (payload.filtros as any) || {},
    dados_inclusos: (payload.dados_inclusos as any) || {
      faturamento: true,
      pedidos: true,
      top_clientes: true,
      familias: true,
      cobertura: true,
    },
    saida: 'resumo_e_exportacao',
    observacoes: payload.observacoes ? String(payload.observacoes) : 'Gerado pelo chat Maestro.',
  }

  const result = await gerarRelatorioMaestro(config)
  if (!result || !result.success) {
    throw new Error(result?.error || 'Não foi possível gerar o relatório de vendas.')
  }

  notifyDataChanged('documents')
  notifyDataChanged('faturamento')

  return {
    success: true,
    message: `Relatório oficial de vendas gerado com sucesso para o período ${result.periodo}. Arquivo: ${result.nome_arquivo}`,
    createdCount: 1,
    updatedCount: 0,
    skippedCount: 0,
    errorsCount: 0,
    errors: [],
    affectedCollection: 'documents',
    navigationTab: '/relatorios-automaticos',
    navigationLabel: 'Ver Relatório Gerado',
  }
}
