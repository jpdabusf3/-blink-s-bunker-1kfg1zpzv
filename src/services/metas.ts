import pb from '@/lib/pocketbase/client'

export interface Meta {
  id: string
  vendedor_id: string
  periodo: string
  meta_valor: number
  valor_realizado: number
  created: string
  updated: string
  expand?: {
    vendedor_id?: { id: string; name: string; email: string; job_title: string }
  }
}

export const getMetas = () =>
  pb.collection('metas').getFullList<Meta>({
    sort: '-created',
    expand: 'vendedor_id',
  })

export const createMeta = (data: {
  vendedor_id: string
  periodo: string
  meta_valor: number
  valor_realizado?: number
}) => pb.collection('metas').create(data)

export const updateMeta = (
  id: string,
  data: Partial<{
    vendedor_id: string
    periodo: string
    meta_valor: number
    valor_realizado: number
  }>,
) => pb.collection('metas').update(id, data)

export const deleteMeta = (id: string) => pb.collection('metas').delete(id)
