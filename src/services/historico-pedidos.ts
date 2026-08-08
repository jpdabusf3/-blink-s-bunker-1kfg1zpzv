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

export const createHistoricoPedido = (data: Partial<HistoricoPedido>) =>
  pb.collection('historico_pedidos').create(data)

export const updateHistoricoPedido = (id: string, data: Partial<HistoricoPedido>) =>
  pb.collection('historico_pedidos').update(id, data)

export const deleteHistoricoPedido = (id: string) => pb.collection('historico_pedidos').delete(id)
