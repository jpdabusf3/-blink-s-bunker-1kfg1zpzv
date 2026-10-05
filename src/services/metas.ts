import pb from '@/lib/pocketbase/client'
import { notifyDataChanged } from '@/hooks/useRealtimeData'

export const CANAL_VENDAS_OPTIONS = [
  'Direto',
  'Distribuidor',
  'Indústria',
  'Premixera',
  'Cooperativa',
  'Online',
] as const

export const SEGMENTOS_METAS = ['AVES', 'PETS', 'RUMINANTES', 'SUINOS', 'AQUA'] as const

export type SegmentoMeta = (typeof SEGMENTOS_METAS)[number]

export interface Meta {
  id: string
  vendedor_id?: string
  gestor_tecnico_id?: string
  especie?: string
  canal_vendas?: string
  periodo: string
  meta_valor: number
  valor_realizado: number
  acrescimo_percentual?: number
  decrecimo_percentual?: number
  atualizado_em?: string
  // Novos campos aditivos por vendedor e segmento
  vendedor?: string
  segmento?: string
  mes?: number
  ano?: number
  valor_meta?: number
  vendedor_nome?: string
  created: string
  updated: string
  expand?: {
    vendedor_id?: { id: string; nome: string; funcao: string; regiao: string }
    gestor_tecnico_id?: { id: string; nome: string; funcao: string; regiao: string }
  }
}

export const getMetas = () =>
  pb.collection('metas').getFullList<Meta>({
    sort: '-created',
    expand: 'vendedor_id,gestor_tecnico_id',
  })

export const createMeta = async (data: {
  vendedor_id?: string
  gestor_tecnico_id?: string | null
  especie?: string | null
  canal_vendas?: string | null
  periodo: string
  meta_valor: number
  valor_realizado?: number
  acrescimo_percentual?: number
  decrecimo_percentual?: number
  vendedor?: string
  segmento?: string
  mes?: number
  ano?: number
  valor_meta?: number
  vendedor_nome?: string
}) => {
  const created = await pb.collection('metas').create(data)
  notifyDataChanged('metas')
  return created
}

export const updateMeta = async (
  id: string,
  data: Partial<{
    vendedor_id: string
    gestor_tecnico_id: string | null
    especie: string | null
    canal_vendas: string | null
    periodo: string
    meta_valor: number
    valor_realizado: number
    acrescimo_percentual: number
    decrecimo_percentual: number
    vendedor: string
    segmento: string
    mes: number
    ano: number
    valor_meta: number
    vendedor_nome: string
  }>,
) => {
  const updated = await pb.collection('metas').update(id, data)
  notifyDataChanged('metas')
  return updated
}

export const deleteMeta = async (id: string) => {
  const res = await pb.collection('metas').delete(id)
  notifyDataChanged('metas')
  return res
}

export interface MetaVendedorSegmentoInput {
  vendedor: string
  segmento: string
  mes: number
  ano: number
  valor_meta: number
  vendedor_id?: string
}

export const getMetasPorPeriodo = (mes: number, ano: number) => {
  const periodoStr = `${ano}-${String(mes).padStart(2, '0')}`
  const filter = `(mes = ${mes} && ano = ${ano}) || periodo = "${periodoStr}"`
  return pb.collection('metas').getFullList<Meta>({
    filter,
    sort: 'vendedor,segmento',
    expand: 'vendedor_id,gestor_tecnico_id',
  })
}

export const saveMetaVendedorSegmento = async (
  input: MetaVendedorSegmentoInput,
  id?: string,
): Promise<Meta> => {
  const periodoStr = `${input.ano}-${String(input.mes).padStart(2, '0')}`
  const payload = {
    vendedor: input.vendedor.trim(),
    segmento: input.segmento.trim().toUpperCase(),
    mes: input.mes,
    ano: input.ano,
    valor_meta: input.valor_meta,
    meta_valor: input.valor_meta,
    periodo: periodoStr,
    vendedor_nome: input.vendedor.trim(),
    ...(input.vendedor_id ? { vendedor_id: input.vendedor_id } : {}),
    atualizado_em: new Date().toISOString(),
  }

  if (id) {
    const updated = await pb.collection('metas').update<Meta>(id, payload)
    notifyDataChanged('metas')
    return updated
  }

  // Se não tiver id, verificar se já existe meta para essa chave antes de criar (para evitar violação da constraint única)
  try {
    const existing = await pb
      .collection('metas')
      .getFirstListItem<Meta>(
        `vendedor = "${payload.vendedor}" && segmento = "${payload.segmento}" && mes = ${payload.mes} && ano = ${payload.ano}`,
      )
    if (existing) {
      const updated = await pb.collection('metas').update<Meta>(existing.id, payload)
      notifyDataChanged('metas')
      return updated
    }
  } catch {
    // Record não encontrado, segue para create
  }

  const created = await pb.collection('metas').create<Meta>(payload)
  notifyDataChanged('metas')
  return created
}
