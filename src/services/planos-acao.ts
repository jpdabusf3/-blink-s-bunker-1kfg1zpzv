import pb from '@/lib/pocketbase/client'
import type { PlanoAcao, PlanoStatus } from '@/types'

export interface NewPlanoAcao {
  descricao: string
  data_prevista?: string
  status?: PlanoStatus
  cliente?: string
  vendedor?: string
  atividade_origem?: string
  origem?: string
}

export const getPlanosByCliente = (clienteId: string): Promise<PlanoAcao[]> =>
  pb.collection('planos_acao').getFullList<PlanoAcao>({
    filter: `cliente = "${clienteId}"`,
    sort: '-created',
    expand: 'cliente,vendedor,atividade_origem',
  })

export const getPlanosByAtividade = (atividadeId: string): Promise<PlanoAcao[]> =>
  pb.collection('planos_acao').getFullList<PlanoAcao>({
    filter: `atividade_origem = "${atividadeId}"`,
    sort: '-created',
    expand: 'cliente,vendedor,atividade_origem',
  })

import { notifyDataChanged } from '@/hooks/useRealtimeData'

export const createPlanoAcao = async (data: NewPlanoAcao): Promise<PlanoAcao> => {
  const created = await pb.collection('planos_acao').create<PlanoAcao>({
    descricao: data.descricao,
    data_prevista: data.data_prevista || null,
    status: data.status || 'pendente',
    cliente: data.cliente || null,
    vendedor: data.vendedor || null,
    atividade_origem: data.atividade_origem || null,
    origem: data.origem || 'manual',
  })
  notifyDataChanged('planos_acao')
  return created
}

export const updatePlanoAcao = async (
  id: string,
  patch: Partial<NewPlanoAcao>,
): Promise<PlanoAcao> => {
  const updated = await pb.collection('planos_acao').update<PlanoAcao>(id, {
    descricao: patch.descricao,
    data_prevista: patch.data_prevista || null,
    status: patch.status,
  })
  notifyDataChanged('planos_acao')
  return updated
}

export const deletePlanoAcao = async (id: string): Promise<void> => {
  await pb.collection('planos_acao').delete(id)
  notifyDataChanged('planos_acao')
}
