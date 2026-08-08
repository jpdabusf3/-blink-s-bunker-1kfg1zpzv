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

export const createPedidoCarteira = (data: Partial<PedidoCarteira>) =>
  pb.collection('pedidos_carteira').create(data)

export const updatePedidoCarteira = (id: string, data: Partial<PedidoCarteira>) =>
  pb.collection('pedidos_carteira').update(id, data)

export const deletePedidoCarteira = (id: string) => pb.collection('pedidos_carteira').delete(id)
