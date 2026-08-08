import pb from '@/lib/pocketbase/client'

export interface Meta {
  id: string
  vendedor_id: string
  gestor_tecnico_id?: string
  especie?: string
  periodo: string
  meta_valor: number
  valor_realizado: number
  atualizado_em?: string
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

export const createMeta = (data: {
  vendedor_id: string
  gestor_tecnico_id?: string | null
  especie?: string | null
  periodo: string
  meta_valor: number
  valor_realizado?: number
}) => pb.collection('metas').create(data)

export const updateMeta = (
  id: string,
  data: Partial<{
    vendedor_id: string
    gestor_tecnico_id: string | null
    especie: string | null
    periodo: string
    meta_valor: number
    valor_realizado: number
  }>,
) => pb.collection('metas').update(id, data)

export const deleteMeta = (id: string) => pb.collection('metas').delete(id)
