import pb from '@/lib/pocketbase/client'

export interface GestaoTecnica {
  id: string
  nome: string
  funcao: 'gestor_tecnico' | 'vendedor'
  regiao: string
  carteira?: string
  ativo: boolean
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
    filter: "funcao = 'vendedor'",
    sort: 'nome',
  })

export const createGestaoTecnica = (data: Partial<GestaoTecnica>) =>
  pb.collection('gestao_tecnica').create(data)

export const updateGestaoTecnica = (id: string, data: Partial<GestaoTecnica>) =>
  pb.collection('gestao_tecnica').update(id, data)

export const deleteGestaoTecnica = (id: string) => pb.collection('gestao_tecnica').delete(id)
