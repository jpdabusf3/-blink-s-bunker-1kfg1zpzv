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
  const payload = { ...data }
  if (payload.nome) {
    payload.nome = normalizeCanonicalSellerName(payload.nome)
  }
  const created = await pb.collection('gestao_tecnica').create(payload)
  recordEntityChangeLog({
    entity_type: 'vendedor',
    entity_id: created.id,
    entity_name: created.nome,
    change_summary: `Membro ${created.nome} cadastrado na equipe (${created.funcao || 'vendedor'})`,
    action: 'create',
  }).catch(() => {})

  notifyDataChanged('gestao_tecnica')
  return created
}

export const updateGestaoTecnica = async (id: string, data: Partial<GestaoTecnica>) => {
  const payload = { ...data }
  if (payload.nome) {
    payload.nome = normalizeCanonicalSellerName(payload.nome)
  }
  let before: Record<string, any> = {}
  try {
    before = await pb.collection('gestao_tecnica').getOne(id)
  } catch {
    /* intentionally ignored */
  }

  const updated = await pb.collection('gestao_tecnica').update(id, payload)

  recordEntityChangeLog({
    entity_type: 'vendedor',
    entity_id: id,
    entity_name: updated.nome,
    change_summary: `Membro ${updated.nome} atualizado`,
    action: 'update',
  }).catch(() => {})

  notifyDataChanged('gestao_tecnica')
  return updated
}

import { recordEntityChangeLog } from './entity-change-logs'
import { normalizeCanonicalSellerName } from './integrity-service'

export const softDeleteGestaoTecnica = async (id: string, nome?: string) => {
  const res = await pb.collection('gestao_tecnica').update(id, {
    ativo: false,
    is_deleted: true,
    deleted_at: new Date().toISOString(),
  })
  recordEntityChangeLog({
    entity_type: 'vendedor',
    entity_id: id,
    entity_name: nome || 'Membro',
    change_summary: `Membro ${nome || id} excluído logicamente (soft delete)`,
    action: 'delete',
  }).catch(() => {})

  notifyDataChanged('gestao_tecnica')
  return res
}

export const deactivateGestaoTecnica = async (id: string, nome?: string) => {
  const res = await pb.collection('gestao_tecnica').update(id, {
    ativo: false,
  })
  recordEntityChangeLog({
    entity_type: 'vendedor',
    entity_id: id,
    entity_name: nome || 'Membro',
    change_summary: `Membro ${nome || id} desativado`,
    action: 'deactivate',
  }).catch(() => {})

  notifyDataChanged('gestao_tecnica')
  return res
}

export const deleteGestaoTecnica = async (id: string, nome?: string) => {
  return softDeleteGestaoTecnica(id, nome)
}
