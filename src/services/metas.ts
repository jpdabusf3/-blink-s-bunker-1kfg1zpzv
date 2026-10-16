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
  user_id?: string
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
    user_id?: { id: string; name: string; email: string }
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
  const currentUserId = pb.authStore.record?.id || pb.authStore.model?.id
  const periodoStr = `${input.ano}-${String(input.mes).padStart(2, '0')}`
  const payload: Record<string, unknown> = {
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

  if (currentUserId) {
    payload.user_id = currentUserId
  }

  try {
    if (id) {
      const updated = await pb.collection('metas').update<Meta>(id, payload)
      notifyDataChanged('metas')
      return updated
    }

    const created = await pb.collection('metas').create<Meta>(payload)
    notifyDataChanged('metas')
    return created
  } catch (err: unknown) {
    // Se ocorrer violação de unicidade ou duplicidade
    const errObj = err as { message?: string; data?: Record<string, unknown>; status?: number }
    const isUniqueConstraint =
      errObj?.status === 400 ||
      errObj?.message?.toLowerCase().includes('unique') ||
      errObj?.message?.toLowerCase().includes('constraint') ||
      JSON.stringify(errObj?.data || {})
        .toLowerCase()
        .includes('unique') ||
      JSON.stringify(errObj?.data || {})
        .toLowerCase()
        .includes('already exists')

    if (isUniqueConstraint && !id) {
      // Verificar se já existe e informar com mensagem amigável em português
      throw new Error('Já existe uma meta para este vendedor, segmento e período.')
    }
    throw err
  }
}
