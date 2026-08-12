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
export const createGestaoTecnica = (data: Partial<GestaoTecnica>) =>
  pb.collection('gestao_tecnica').create(data)

export const updateGestaoTecnica = (id: string, data: Partial<GestaoTecnica>) =>
  pb.collection('gestao_tecnica').update(id, data)

export const deleteGestaoTecnica = (id: string) => pb.collection('gestao_tecnica').delete(id)
