import pb from '@/lib/pocketbase/client'

export interface HistoricoPedido {
  id: string
  marca: string
  mes: string
  valor: number
  total_geral: number
  atualizado_em: string
  created: string
  updated: string
}

export const getHistoricoPedidos = () =>
  pb.collection('historico_pedidos').getFullList<HistoricoPedido>({
    sort: '-created',
  })

import { notifyDataChanged } from '@/hooks/useRealtimeData'

export const createHistoricoPedido = async (data: Partial<HistoricoPedido>) => {
  const created = await pb.collection('historico_pedidos').create(data)
  notifyDataChanged('historico_pedidos')
  return created
}

export const updateHistoricoPedido = async (id: string, data: Partial<HistoricoPedido>) => {
  const updated = await pb.collection('historico_pedidos').update(id, data)
  notifyDataChanged('historico_pedidos')
  return updated
}

export const deleteHistoricoPedido = async (id: string) => {
  const res = await pb.collection('historico_pedidos').delete(id)
  notifyDataChanged('historico_pedidos')
  return res
}
