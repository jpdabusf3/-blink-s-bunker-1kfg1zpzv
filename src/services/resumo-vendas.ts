import pb from '@/lib/pocketbase/client'

export interface FaturamentoRecord {
  id: string
  country?: string
  nf_ano?: number
  nf_ano_mes?: string
  cliente_codigo?: string
  cliente_nome?: string
  familia_produto?: string
  data_documento?: string
  produto_codigo?: string
  produto_descricao?: string
  valor_usd?: number
  valor_brl?: number
  quantidade?: number
  vendedor?: string
  semana_iso?: number
  mes?: number
  ano?: number
  semestre?: string
  user_id?: string
  created?: string
  updated?: string
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

export async function updateFaturamento(
  id: string,
  data: Partial<Omit<FaturamentoRecord, 'id' | 'created' | 'updated'>>,
): Promise<FaturamentoRecord> {
  const updated = await pb.collection('faturamento').update<FaturamentoRecord>(id, data)
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('blink:datasync', { detail: { entity: 'faturamento', id } }),
      )
    } catch {
      // ignore
    }
  }
  return updated
}

export async function deleteFaturamento(id: string): Promise<boolean> {
  const deleted = await pb.collection('faturamento').delete(id)
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('blink:datasync', { detail: { entity: 'faturamento', id } }),
      )
    } catch {
      // ignore
    }
  }
  return deleted
}

export interface UploadHistoryItem {
  id: string
  created: string
  fileName: string
  authorName: string
  authorEmail: string
  importedCount: number
  duplicatesCount: number
  status: 'concluido' | 'parcial' | 'erro'
  details: string
}

export async function getFaturamentoUploadHistory(): Promise<UploadHistoryItem[]> {
  const logs = await pb.collection('activity_logs').getFullList({
    sort: '-created',
    filter: 'action ~ "Import" || target_collection = "faturamento"',
    expand: 'user',
  })

  return logs.map((log) => {
    const rawDetails = String(log.details || '')
    // Extrai nome do arquivo: ex: "Importação de faturamento [faturamento_2026.xlsx]: ..."
    const fileMatch = rawDetails.match(/\[(.*?)\]/)
    const fileName = fileMatch ? fileMatch[1] : 'faturamento_importacao.xlsx'

    // Extrai quantidade de importados: ex: "58 registros importados"
    const countMatch = rawDetails.match(/(\d+)\s+registros importados/i)
    let importedCount = countMatch ? parseInt(countMatch[1], 10) : 0

    // Se countMatch não achou ou foi 0, tenta achar pedidos criados em histórico: "81 pedidos criados em histórico"
    if (importedCount === 0) {
      const pedidosMatch = rawDetails.match(/(\d+)\s+pedidos criados em histórico/i)
      if (pedidosMatch) {
        importedCount = parseInt(pedidosMatch[1], 10)
      }
    }

    // Duplicados
    const dupMatch = rawDetails.match(/(\d+)\s+duplicados ignorados/i)
    const duplicatesCount = dupMatch ? parseInt(dupMatch[1], 10) : 0

    // Status: log.proximo_passo ou extraído de "Status: ..." ou padrão concluído
    let status: 'concluido' | 'parcial' | 'erro' = 'concluido'
    if (log.proximo_passo === 'erro' || rawDetails.toLowerCase().includes('status: erro')) {
      status = 'erro'
    } else if (
      log.proximo_passo === 'parcial' ||
      rawDetails.toLowerCase().includes('status: parcial') ||
      rawDetails.toLowerCase().includes('linhas que não puderam')
    ) {
      status = 'parcial'
    } else if (
      log.proximo_passo === 'concluido' ||
      rawDetails.toLowerCase().includes('sucesso') ||
      importedCount > 0
    ) {
      status = 'concluido'
    }

    const expandUser = log.expand?.user as { name?: string; email?: string } | undefined
    const authorName = expandUser?.name || expandUser?.email?.split('@')[0] || 'Sistema'
    const authorEmail = expandUser?.email || ''

    return {
      id: log.id,
      created: log.created,
      fileName,
      authorName,
      authorEmail,
      importedCount,
      duplicatesCount,
      status,
      details: rawDetails,
    }
  })
}
