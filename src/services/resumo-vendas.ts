import pb from '@/lib/pocketbase/client'

export interface FaturamentoRecord {
  id: string
  country: string
  nf_ano: number
  nf_ano_mes: string
  cliente_codigo: string
  cliente_nome: string
  familia_produto: string
  data_documento: string
  produto_codigo: string
  produto_descricao: string
  valor_usd: number
  valor_brl: number
  semana_iso: number
  mes: number
  ano: number
  semestre: string
  user_id: string
  created: string
  updated: string
}

export interface ResumoClienteItem {
  cliente: string
  valor_brl: number
}

export interface ResumoFamiliaItem {
  familia: string
  valor_brl: number
}

export interface ResumoEspecieItem {
  especie: string
  valor_brl: number
}

export interface ResumoVendasResponse {
  periodo: string
  faturado_total_brl: number
  faturado_total_usd: number
  carteira_total_brl: number | null
  cobertura_percent?: number | null
  meta_brl?: number
  meta_atingida_percent?: number | null
  por_cliente: ResumoClienteItem[]
  por_familia: ResumoFamiliaItem[]
  por_especie: ResumoEspecieItem[]
  quantidade_notas: number
  variacao_semana_anterior?: number | null
  variacao_vs_anterior_percent?: number | null
}

export interface ResumoVendasParams {
  mode: 'week' | 'month'
  ano?: number
  mes?: number
  semana?: number
}

export async function fetchResumoVendas(params: ResumoVendasParams): Promise<ResumoVendasResponse> {
  const query: Record<string, string> = { mode: params.mode }
  if (params.ano !== undefined) query.ano = String(params.ano)
  if (params.mes !== undefined) query.mes = String(params.mes)
  if (params.semana !== undefined) query.semana = String(params.semana)

  return pb.send<ResumoVendasResponse>('/backend/v1/resumo_vendas', {
    method: 'GET',
    query,
  })
}

export async function getFaturamentos(
  filter = '',
  sort = '-data_documento',
): Promise<FaturamentoRecord[]> {
  return pb.collection('faturamento').getFullList<FaturamentoRecord>({
    filter,
    sort,
  })
}
