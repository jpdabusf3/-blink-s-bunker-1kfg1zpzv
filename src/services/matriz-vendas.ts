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
}

export const getMatrizVendas = () =>
  pb.collection('matriz_vendas').getFullList<MatrizVenda>({
    sort: 'pais,carteira,mes',
  })

export const createMatrizVenda = (data: Partial<MatrizVenda>) =>
  pb.collection('matriz_vendas').create(data)

export const updateMatrizVenda = (id: string, data: Partial<MatrizVenda>) =>
  pb.collection('matriz_vendas').update(id, data)

export const deleteMatrizVenda = (id: string) => pb.collection('matriz_vendas').delete(id)
