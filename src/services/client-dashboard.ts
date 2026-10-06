import pb from '@/lib/pocketbase/client'
import { normalizeSellerName } from '@/lib/vendedorFilterHelper'
import type { Factory } from '@/types'

export interface ClientDashboardSummary {
  totalOrdersCount: number
  backlogCount: number
  totalRevenueBrl: number
  totalPurchasesUsd: number
  averageTicketBrl: number
}

export interface ClientDashboardOrder {
  id: string
  date: string // ISO date or YYYY-MM-DD
  formattedDate: string // DD/MM/YYYY
  value: number
  status: string
  source: 'pedidos' | 'orders' | 'nfe_pedidos'
  productName?: string
  numero?: string
}

export interface ClientDashboardBacklogItem {
  id: string
  orderNumber?: string
  expectedDeliveryMonth: string // Ex: "Outubro 2026", "10/2026" ou "N/A"
  value: number
  status: string
  segment?: string
  product?: string
}

export interface ClientDashboardInteraction {
  id: string
  date: string
  formattedDate: string // DD/MM/YYYY
  type: string
  action: string
  details?: string
  userOrAuthor?: string
  source: 'activity_logs' | 'atividades' | 'deal_activities' | 'manual_update'
  isManualUpdate?: boolean
  fieldName?: string
  value?: string
}

export interface ClientDashboardInvoice {
  id: string
  date: string
  ano: number
  mes: number
  valorBrl: number
  valorUsd: number
  volume: number // quantidade de produtos ou unidades faturadas
  produto?: string
}

export interface ClientDashboardData {
  client: Factory
  summary: ClientDashboardSummary
  orders: ClientDashboardOrder[]
  backlog: ClientDashboardBacklogItem[]
  interactions: ClientDashboardInteraction[]
  invoices: ClientDashboardInvoice[]
  isEmpty: boolean
}

/**
 * Normaliza strings para casamento flexível de nomes de clientes
 */
function normalizeName(str?: string | null): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Converte data string para DD/MM/YYYY com fallback amigável
 */
function formatDateToBR(dateStr?: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Formata mês/ano para exibição no backlog
 */
function formatDeliveryMonth(dateStr?: string | null, mesText?: string, anoNum?: number): string {
  if (mesText && mesText.trim()) {
    const capitalized = mesText.charAt(0).toUpperCase() + mesText.slice(1).toLowerCase()
    return anoNum && anoNum > 0 ? `${capitalized} / ${anoNum}` : capitalized
  }
  if (!dateStr) return 'A definir'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return 'A definir'
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

/**
 * Busca todos os dados vinculados a um cliente para alimentar o ClientDashboard
 */
export async function fetchClientDashboardData(clientId: string): Promise<ClientDashboardData> {
  // 1. Carregar o cliente na collection factories
  const client = await pb.collection('factories').getOne<Factory>(clientId, {
    expand: 'salesOwner,technicalManager,gestor_tecnico_id,vendedor_id',
  })

  if (!client) {
    throw new Error('Cliente não encontrado')
  }

  const clientName = client.name || ''
  const normClientName = normalizeName(clientName)
  const clientCnpj = (client.cnpj || '').replace(/\D/g, '')
  const clientCode = ((client as any).codigo_cliente || '').trim().toLowerCase()

  // 2. Disparar buscas paralelas nas coleções relevantes
  const [
    pedidosRes,
    ordersRes,
    pedidosCarteiraRes,
    faturamentoRes,
    activityLogsRes,
    dealActsRes,
    atividadesRes,
  ] = await Promise.allSettled([
    // A) pedidos (Gestão de Pedidos)
    pb.collection('pedidos').getFullList({
      filter: `clienteId = "${clientId}" || cliente_id = "${clientId}" || cliente_nome ~ "${clientName.replace(/"/g, '')}"`,
      sort: '-dataPedido,-created',
      expand: 'produtoId,produto_id',
    }),

    // B) orders (Pedidos gerais)
    pb.collection('orders').getFullList({
      filter: `factoryId = "${clientId}" || client_name ~ "${clientName.replace(/"/g, '')}"`,
      sort: '-orderDate,-created',
    }),

    // C) pedidos_carteira (Backlog)
    pb.collection('pedidos_carteira').getFullList({
      sort: '-created',
    }),

    // D) faturamento (Notas fiscais emitidas)
    pb.collection('faturamento').getFullList({
      sort: '-data_documento,-created',
    }),

    // E) activity_logs
    pb.collection('activity_logs').getFullList({
      filter: `recordId = "${clientId}" || target_collection = "factories"`,
      sort: '-created',
      expand: 'user',
    }),

    // F) deal_activities
    pb.collection('deal_activities').getFullList({
      filter: `deal_id = "${clientId}"`,
      sort: '-created',
      expand: 'user_id',
    }),

    // G) atividades
    pb.collection('atividades').getFullList({
      filter: `cliente_id = "${clientId}"`,
      sort: '-created',
      expand: 'vendedor_id',
    }),
  ])

  // --- Processar Pedidos (Orders Section) ---
  const orders: ClientDashboardOrder[] = []

  if (pedidosRes.status === 'fulfilled' && pedidosRes.value) {
    for (const p of pedidosRes.value as any[]) {
      const isMatch =
        p.clienteId === clientId ||
        p.cliente_id === clientId ||
        (p.cliente_nome && normalizeName(p.cliente_nome).includes(normClientName)) ||
        (p.cliente && normalizeName(p.cliente).includes(normClientName))

      if (!isMatch) continue

      const val = Number(p.valorTotal || p.total_geral || p.valorUnitario || 0)
      const dateVal = p.dataPedido || p.data_pedido || p.dataSolicitada || p.created
      const pProd = p.expand?.produtoId?.nome || p.produto_nome || p.expand?.produto_id?.nome || ''

      orders.push({
        id: `ped-${p.id}`,
        date: dateVal,
        formattedDate: formatDateToBR(dateVal),
        value: val,
        status: (p.status || 'ABERTO').toUpperCase(),
        source: 'pedidos',
        productName: pProd,
        numero: p.numeroPedido || p.nfNumero || `PED-${p.id.slice(0, 6).toUpperCase()}`,
      })
    }
  }

  if (ordersRes.status === 'fulfilled' && ordersRes.value) {
    for (const o of ordersRes.value as any[]) {
      const isMatch =
        o.factoryId === clientId ||
        (o.client_name && normalizeName(o.client_name).includes(normClientName))

      if (!isMatch) continue

      const val = Number(o.totalValue || o.total_value || o.unitValue || 0)
      const dateVal = o.orderDate || o.order_date || o.created

      // Deduplicar se por ventura for o mesmo id
      if (!orders.some((item) => item.id === `ord-${o.id}`)) {
        orders.push({
          id: `ord-${o.id}`,
          date: dateVal,
          formattedDate: formatDateToBR(dateVal),
          value: val,
          status: (o.status || 'CONCLUÍDO').toUpperCase(),
          source: 'orders',
          productName: o.product || o.line || '',
          numero: `ORD-${o.id.slice(0, 6).toUpperCase()}`,
        })
      }
    }
  }

  // Ordenar pedidos por data descrescente
  orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // --- Processar Backlog / Carteira ---
  const backlog: ClientDashboardBacklogItem[] = []

  // 1) De pedidos em carteira que casem com a marca/cliente
  if (pedidosCarteiraRes.status === 'fulfilled' && pedidosCarteiraRes.value) {
    for (const pc of pedidosCarteiraRes.value as any[]) {
      const pcCli = normalizeName(pc.cliente || '')
      const pcMarca = normalizeName(pc.marca || '')
      const matches =
        (pcCli && (normClientName.includes(pcCli) || pcCli.includes(normClientName))) ||
        (pcMarca && (normClientName.includes(pcMarca) || pcMarca.includes(normClientName)))

      if (matches) {
        const val = Number(pc.valor || pc.total_geral || 0)
        backlog.push({
          id: `pc-${pc.id}`,
          orderNumber: pc.segmento
            ? `Carteira ${pc.segmento}`
            : `CARTEIRA-${pc.id.slice(0, 6).toUpperCase()}`,
          expectedDeliveryMonth: formatDeliveryMonth(pc.atualizado_em, pc.mes, pc.ano),
          value: val,
          status: 'EM CARTEIRA',
          segment: pc.segmento,
        })
      }
    }
  }

  // 2) De pedidos da tabela `pedidos` com status 'ABERTO'
  if (pedidosRes.status === 'fulfilled' && pedidosRes.value) {
    for (const p of pedidosRes.value as any[]) {
      const isMatch =
        p.clienteId === clientId ||
        p.cliente_id === clientId ||
        (p.cliente_nome && normalizeName(p.cliente_nome).includes(normClientName)) ||
        (p.cliente && normalizeName(p.cliente).includes(normClientName))

      if (!isMatch) continue

      const statusUpper = (p.status || '').toUpperCase()
      if (
        statusUpper === 'ABERTO' ||
        statusUpper === 'AGUARDANDO' ||
        statusUpper === 'SOLICITADO'
      ) {
        const val = Number(p.valorTotal || p.total_geral || 0)
        backlog.push({
          id: `backlog-ped-${p.id}`,
          orderNumber: p.numeroPedido || `PED-${p.id.slice(0, 6).toUpperCase()}`,
          expectedDeliveryMonth: formatDeliveryMonth(
            p.dataEntregaPrevista || p.entregaConfirmada || p.dataSolicitada || p.dataPedido,
          ),
          value: val,
          status: statusUpper || 'ABERTO',
          product: p.expand?.produtoId?.nome || p.produto_nome || '',
        })
      }
    }
  }

  // --- Processar Faturamento / Invoices ---
  const invoices: ClientDashboardInvoice[] = []
  let totalRevenueBrl = 0
  let totalPurchasesUsd = 0

  if (faturamentoRes.status === 'fulfilled' && faturamentoRes.value) {
    for (const fat of faturamentoRes.value as any[]) {
      if (fat.is_deleted) continue

      const fatCli = normalizeName(fat.cliente_nome || '')
      const fatCode = (fat.cliente_codigo || '').trim().toLowerCase()

      const matchesClient =
        (fatCode && clientCode && fatCode === clientCode) ||
        (normClientName && (fatCli.includes(normClientName) || normClientName.includes(fatCli)))

      if (!matchesClient) continue

      const valBrl = Number(fat.valor_brl) || 0
      const valUsd = Number(fat.valor_usd) || 0
      const dateDoc = fat.data_documento || fat.created

      totalRevenueBrl += valBrl
      totalPurchasesUsd += valUsd

      const d = new Date(dateDoc)
      const ano = !isNaN(d.getTime()) ? d.getFullYear() : fat.ano || 2026
      const mes = !isNaN(d.getTime()) ? d.getMonth() + 1 : fat.mes || 1

      invoices.push({
        id: fat.id,
        date: dateDoc,
        ano,
        mes,
        valorBrl: valBrl,
        valorUsd: valUsd,
        volume: 1, // cada nota / item
        produto: fat.produto_descricao || fat.produto_codigo || '',
      })
    }
  }

  // Se o cliente não teve faturamento em `faturamento`, mas teve pedidos faturados ou orders
  if (totalRevenueBrl === 0 && orders.length > 0) {
    for (const ord of orders) {
      if (ord.status === 'FATURADO' || ord.status === 'CONCLUÍDO') {
        totalRevenueBrl += ord.value
      }
    }
  }

  // Cálculo de ticket médio em BRL
  const eligibleOrdersForTicket = orders.filter((o) => o.value > 0)
  const averageTicketBrl =
    eligibleOrdersForTicket.length > 0
      ? orders.reduce((s, o) => s + o.value, 0) / eligibleOrdersForTicket.length
      : totalRevenueBrl > 0 && invoices.length > 0
        ? totalRevenueBrl / invoices.length
        : 0

  // --- Processar Interações (Activity logs, Atividades, Deal Activities, Atualização Manual) ---
  const interactions: ClientDashboardInteraction[] = []

  // A) Activity Logs
  if (activityLogsRes.status === 'fulfilled' && activityLogsRes.value) {
    for (const item of activityLogsRes.value as any[]) {
      // Filtrar apenas do cliente atual
      if (item.recordId && item.recordId !== clientId) {
        continue
      }
      const u = item.expand?.user as { name?: string; email?: string } | undefined
      const authorName = normalizeSellerName(u?.name || u?.email || 'João Figueiredo')
      const actionText = item.action || 'Atividade registrada'
      const detailsText = item.details || item.proximo_passo || ''

      const isManual =
        item.origem === 'manual' ||
        actionText.includes('Ação já realizada') ||
        actionText.includes('Ação em prática') ||
        actionText.includes('Ação a ser realizada') ||
        actionText.includes('Atualização Manual') ||
        actionText.includes('Status:')

      let fieldName: string | undefined
      let manualVal: string | undefined

      if (isManual) {
        if (actionText.startsWith('Ação já realizada:')) {
          fieldName = 'Ação já realizada'
          manualVal = actionText.replace('Ação já realizada:', '').trim()
        } else if (actionText.startsWith('Ação em prática:')) {
          fieldName = 'Ação em prática'
          manualVal = actionText.replace('Ação em prática:', '').trim()
        } else if (actionText.startsWith('Ação a ser realizada:')) {
          fieldName = 'Ação a ser realizada'
          manualVal = actionText.replace('Ação a ser realizada:', '').trim()
        } else if (actionText.startsWith('Status:')) {
          fieldName = 'Status no funil'
          manualVal = actionText.replace('Status:', '').trim()
        } else if (actionText.startsWith('Atualização Manual:')) {
          fieldName = 'Atualização Manual'
          manualVal = actionText.replace('Atualização Manual:', '').trim()
        }
      }

      interactions.push({
        id: `act-${item.id}`,
        date: item.created,
        formattedDate: formatDateToBR(item.created),
        type: item.tipo || 'acao',
        action: actionText,
        details: detailsText,
        userOrAuthor: authorName,
        source: isManual ? 'manual_update' : 'activity_logs',
        isManualUpdate: isManual,
        fieldName,
        value: manualVal || detailsText || actionText,
      })
    }
  }

  // B) Deal Activities
  if (dealActsRes.status === 'fulfilled' && dealActsRes.value) {
    for (const item of dealActsRes.value as any[]) {
      const u = item.expand?.user_id as { name?: string; email?: string } | undefined
      const authorName = normalizeSellerName(u?.name || u?.email || 'João Figueiredo')
      const createdDate = item.created_at || item.created

      // Evita duplicata se já capturado em activity_logs
      const isDuplicate = interactions.some(
        (inter) =>
          inter.action === item.activity_text &&
          Math.abs(new Date(inter.date).getTime() - new Date(createdDate).getTime()) < 60_000,
      )

      if (!isDuplicate) {
        interactions.push({
          id: `deal-${item.id}`,
          date: createdDate,
          formattedDate: formatDateToBR(createdDate),
          type: 'deal',
          action: item.activity_text || 'Atividade comercial',
          details: '',
          userOrAuthor: authorName,
          source: 'deal_activities',
          isManualUpdate: false,
        })
      }
    }
  }

  // C) Atividades (visitas, propostas, ligações)
  if (atividadesRes.status === 'fulfilled' && atividadesRes.value) {
    for (const item of atividadesRes.value as any[]) {
      const u = item.expand?.vendedor_id as { name?: string; email?: string } | undefined
      const authorName = normalizeSellerName(u?.name || u?.email || 'João Figueiredo')

      interactions.push({
        id: `ativ-${item.id}`,
        date: item.created,
        formattedDate: formatDateToBR(item.created),
        type: item.tipo_atividade || 'comercial',
        action: item.descricao || `Atividade: ${item.tipo_atividade || 'comercial'}`,
        details: item.proximo_passo ? `Próximo passo: ${item.proximo_passo}` : '',
        userOrAuthor: authorName,
        source: 'atividades',
        isManualUpdate: false,
      })
    }
  }

  // D) Se o cliente possui ações manuais persistidas diretamente no registro do cliente
  // (acao_realizada, acao_em_pratica, acao_a_ser_realizada) e ainda não foram listadas
  if (client.acao_realizada && client.acao_realizada.trim()) {
    const hasExisting = interactions.some(
      (i) => i.fieldName === 'Ação já realizada' && i.value === client.acao_realizada,
    )
    if (!hasExisting) {
      interactions.push({
        id: `client-manual-realizada-${client.id}`,
        date: client.updated || client.created,
        formattedDate: formatDateToBR(client.updated || client.created),
        type: 'acao',
        action: `Ação já realizada: ${client.acao_realizada}`,
        details: client.acao_realizada,
        userOrAuthor: 'João Figueiredo',
        source: 'manual_update',
        isManualUpdate: true,
        fieldName: 'Ação já realizada',
        value: client.acao_realizada,
      })
    }
  }

  if (client.acao_em_pratica && client.acao_em_pratica.trim()) {
    const hasExisting = interactions.some(
      (i) => i.fieldName === 'Ação em prática' && i.value === client.acao_em_pratica,
    )
    if (!hasExisting) {
      interactions.push({
        id: `client-manual-pratica-${client.id}`,
        date: client.updated || client.created,
        formattedDate: formatDateToBR(client.updated || client.created),
        type: 'acao',
        action: `Ação em prática: ${client.acao_em_pratica}`,
        details: client.acao_em_pratica,
        userOrAuthor: 'João Figueiredo',
        source: 'manual_update',
        isManualUpdate: true,
        fieldName: 'Ação em prática',
        value: client.acao_em_pratica,
      })
    }
  }

  if (client.acao_a_ser_realizada && client.acao_a_ser_realizada.trim()) {
    const hasExisting = interactions.some(
      (i) => i.fieldName === 'Ação a ser realizada' && i.value === client.acao_a_ser_realizada,
    )
    if (!hasExisting) {
      interactions.push({
        id: `client-manual-futura-${client.id}`,
        date: client.updated || client.created,
        formattedDate: formatDateToBR(client.updated || client.created),
        type: 'acao',
        action: `Ação a ser realizada: ${client.acao_a_ser_realizada}`,
        details: client.acao_a_ser_realizada,
        userOrAuthor: 'João Figueiredo',
        source: 'manual_update',
        isManualUpdate: true,
        fieldName: 'Ação a ser realizada',
        value: client.acao_a_ser_realizada,
      })
    }
  }

  // Ordenar interações: Mais novas primeiro (newest first)
  interactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Se nenhum dado em absoluto existir para este cliente
  const isEmpty =
    orders.length === 0 &&
    backlog.length === 0 &&
    invoices.length === 0 &&
    interactions.length === 0 &&
    totalRevenueBrl === 0 &&
    totalPurchasesUsd === 0

  const summary: ClientDashboardSummary = {
    totalOrdersCount: orders.length,
    backlogCount: backlog.length,
    totalRevenueBrl,
    totalPurchasesUsd,
    averageTicketBrl,
  }

  return {
    client,
    summary,
    orders,
    backlog,
    interactions,
    invoices,
    isEmpty,
  }
}
