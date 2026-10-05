import pb from '@/lib/pocketbase/client'

export interface PedidoCarteira {
  id: string
  marca: string
  mes: string
  valor: number
  total_geral: number
  atualizado_em: string
  created: string
  updated: string
}

export const getPedidosCarteira = () =>
  pb.collection('pedidos_carteira').getFullList<PedidoCarteira>({
    sort: 'marca,mes',
  })

import { notifyDataChanged } from '@/hooks/useRealtimeData'

export const createPedidoCarteira = async (data: Partial<PedidoCarteira>) => {
  const created = await pb.collection('pedidos_carteira').create(data)
  notifyDataChanged('pedidos_carteira')
  return created
}

export const updatePedidoCarteira = async (id: string, data: Partial<PedidoCarteira>) => {
  const updated = await pb.collection('pedidos_carteira').update(id, data)
  notifyDataChanged('pedidos_carteira')
  return updated
}

export const deletePedidoCarteira = async (id: string) => {
  const res = await pb.collection('pedidos_carteira').delete(id)
  notifyDataChanged('pedidos_carteira')
  return res
}
