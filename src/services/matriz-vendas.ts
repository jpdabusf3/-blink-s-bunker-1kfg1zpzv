import pb from '@/lib/pocketbase/client'

export interface MatrizVenda {
  id: string
  pais: string
  carteira: string
  grupo_cliente: string
  razao_social: string
  mes: string
  valor: number
  atualizado_em: string
  created: string
  updated: string
  gestor_tecnico_id?: string
  vendedor_id?: string
  expand?: {
    gestor_tecnico_id?: { id: string; nome: string }
    vendedor_id?: { id: string; nome: string }
  }
}

export const getMatrizVendas = () =>
  pb.collection('matriz_vendas').getFullList<MatrizVenda>({
    sort: 'pais,carteira,mes',
    expand: 'gestor_tecnico_id,vendedor_id',
  })

import { notifyDataChanged } from '@/hooks/useRealtimeData'

export const createMatrizVenda = async (data: Partial<MatrizVenda>) => {
  const created = await pb.collection('matriz_vendas').create(data)
  notifyDataChanged('matriz_vendas')
  return created
}

export const updateMatrizVenda = async (id: string, data: Partial<MatrizVenda>) => {
  const updated = await pb.collection('matriz_vendas').update(id, data)
  notifyDataChanged('matriz_vendas')
  return updated
}

export const deleteMatrizVenda = async (id: string) => {
  const res = await pb.collection('matriz_vendas').delete(id)
  notifyDataChanged('matriz_vendas')
  return res
}
