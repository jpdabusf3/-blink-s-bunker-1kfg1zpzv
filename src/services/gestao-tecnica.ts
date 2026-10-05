import pb from '@/lib/pocketbase/client'

export type GestaoFuncao =
  | 'gestor_tecnico'
  | 'vendedor'
  | 'gestor_comercial'
  | 'gestor_especie'
  | 'diretor'
  | 'ceo'

export interface GestaoTecnica {
  id: string
  nome: string
  funcao: GestaoFuncao
  regiao: string
  carteira?: string
  ativo: boolean
  subclassificacao?: 'indiretos' | 'diretos' | string
  canal_vendas?: 'indireto' | 'direto' | string
  created: string
  updated: string
}

export const getGestaoTecnica = () =>
  pb.collection('gestao_tecnica').getFullList<GestaoTecnica>({ sort: 'nome' })

export const getGestoresTecnicos = () =>
  pb.collection('gestao_tecnica').getFullList<GestaoTecnica>({
    filter: "funcao = 'gestor_tecnico'",
    sort: 'nome',
  })

export const getVendedoresGestao = () =>
  pb.collection('gestao_tecnica').getFullList<GestaoTecnica>({
    filter: "funcao = 'vendedor' && ativo = true",
    sort: 'nome',
  })

export const getGestoresGestao = () =>
  pb.collection('gestao_tecnica').getFullList<GestaoTecnica>({
    filter: "funcao = 'gestor_tecnico' && ativo = true",
    sort: 'nome',
  })
import { notifyDataChanged } from '@/hooks/useRealtimeData'

export const createGestaoTecnica = async (data: Partial<GestaoTecnica>) => {
  const created = await pb.collection('gestao_tecnica').create(data)
  notifyDataChanged('gestao_tecnica')
  return created
}

export const updateGestaoTecnica = async (id: string, data: Partial<GestaoTecnica>) => {
  const updated = await pb.collection('gestao_tecnica').update(id, data)
  notifyDataChanged('gestao_tecnica')
  return updated
}

export const deleteGestaoTecnica = async (id: string) => {
  const res = await pb.collection('gestao_tecnica').delete(id)
  notifyDataChanged('gestao_tecnica')
  return res
}
