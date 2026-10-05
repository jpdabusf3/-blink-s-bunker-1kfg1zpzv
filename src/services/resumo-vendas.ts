// Serviço de consumo do resumo comercial executivo da Blink Biotech
// Endpoint pb_hook: POST /backend/v1/resumo-vendas (ou /backend/v1/resumo_vendas)

import pb from '@/lib/pocketbase/client'
import { notifyDataChanged } from '@/hooks/useRealtimeData'

export interface FaturamentoRecord {
  id: string
  created?: string
  updated?: string
  data_documento?: string
  cliente_nome?: string
  cliente_codigo?: string
  produto_descricao?: string
  produto_codigo?: string
  familia_produto?: string
  quantidade?: number
  valor_usd?: number
  valor_brl?: number
  vendedor?: string
  country?: string
  nf_ano?: number
  mes?: number
  ano?: number
  semestre?: string
  is_deleted?: boolean
  [key: string]: unknown
}

export interface ResumoVendasParams {
  mode?: 'month' | 'week'
  ano?: number
  mes?: number
  semana?: number
}

export interface TopClienteItem {
  rank: number
  cliente: string
  valor_brl: number
  share_percentual: number
}

export interface TopFamiliaItem {
  rank: number
  familia: string
  valor_brl: number
  share_percentual: number
}

// Aliases para retrocompatibilidade
export type ResumoClienteItem = {
  cliente: string
  valor_brl: number
  share_percentual?: number
}

export type ResumoFamiliaItem = {
  familia: string
  valor_brl: number
  share_percentual?: number
}

export interface MetaVendedorItem {
  vendedor: string
  meta_mensal: number
  valor_atingido: number
  percentual_atingido: number
  status: 'verde' | 'amarelo' | 'vermelho'
}

export interface VendaSegmentoItem {
  segmento: 'AVES' | 'PETS' | 'RUMINANTES' | 'SUINOS' | string
  valor_ano: number
  valor_mes: number
}

export interface EvolucaoMensalItem {
  ano: number
  mes: number
  label: string
  key: string
  valor_brl: number
}

export interface AlertaCarteiraItem {
  id: string
  tipo: 'cobertura_baixa' | 'segmento_zerado' | 'cliente_inativo_60d' | string
  severidade: 'critical' | 'warning' | 'risk' | 'info'
  mensagem: string
  data: string
}

export interface ResumoVendasResponse {
  periodo: string
  // Dados obrigatórios da especificação
  faturamento_mes: number
  faturamento_ano_ytd: number
  clientes_ativos: number
  ticket_medio: number
  carteira_total_brl: number
  meta_brl: number
  cobertura_percent: number | null
  variacao_faturamento_mes: number | null
  variacao_ticket_medio: number | null
  top_clientes: TopClienteItem[]
  top_familias: TopFamiliaItem[]
  metas_por_vendedor: MetaVendedorItem[]
  vendas_por_segmento: VendaSegmentoItem[]
  evolucao_mensal: EvolucaoMensalItem[]
  alertas_carteira: AlertaCarteiraItem[]

  // Retrocompatibilidade para Maestro e telas existentes
  faturado_total_brl?: number
  faturado_total_usd?: number
  meta_atingida_percent?: number | null
  por_cliente?: Array<{ cliente: string; valor_brl: number }>
  por_familia?: Array<{ familia: string; valor_brl: number }>
  por_especie?: Array<{ especie: string; valor_brl: number; share_percentual?: number }>
  quantidade_notas?: number
  variacao_semana_anterior?: number | null
  variacao_vs_anterior_percent?: number | null
}

export async function fetchResumoVendas(
  params: ResumoVendasParams = {},
): Promise<ResumoVendasResponse> {
  const queryParams = new URLSearchParams()
  if (params.mode) queryParams.set('mode', params.mode)
  if (params.ano) queryParams.set('ano', String(params.ano))
  if (params.mes) queryParams.set('mes', String(params.mes))
  if (params.semana) queryParams.set('semana', String(params.semana))

  const qs = queryParams.toString()
  const endpoint = `/backend/v1/resumo-vendas${qs ? `?${qs}` : ''}`

  try {
    return await pb.send<ResumoVendasResponse>(endpoint, {
      method: 'POST',
      body: params,
    })
  } catch (err) {
    return await pb.send<ResumoVendasResponse>(`/backend/v1/resumo_vendas${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      body: params,
    })
  }
}

/**
 * Consulta registros da coleção faturamento com suporte a filtros e ordenação
 */
export async function getFaturamentos(
  filter = '',
  sort = '-data_documento',
  limit = 2000,
): Promise<FaturamentoRecord[]> {
  const records = await pb.collection('faturamento').getList<FaturamentoRecord>(1, limit, {
    filter: filter || undefined,
    sort,
  })
  return records.items
}

/**
 * Atualiza um registro de faturamento
 */
export async function updateFaturamento(
  id: string,
  data: Partial<FaturamentoRecord>,
): Promise<FaturamentoRecord> {
  const updated = await pb.collection('faturamento').update<FaturamentoRecord>(id, data)
  notifyDataChanged('faturamento')
  return updated
}
