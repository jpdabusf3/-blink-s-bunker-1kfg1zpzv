import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { notifyDataChanged } from '@/hooks/useRealtimeData'
import type { Visit } from '@/types'

export interface VisitRecord {
  id: string
  user_id: string
  factory_id: string
  visit_date?: string
  notes?: string
  potential_value?: number
  outcome?: string
  created?: string
  updated?: string
}

export interface CreateVisitInput {
  user_id?: string
  factory_id?: string
  factoryId?: string
  visit_date?: string
  date?: string
  notes?: string
  summary?: string
  potential_value?: number
  potentialValue?: number
  outcome?: string
}

export interface UpdateVisitInput {
  factory_id?: string
  factoryId?: string
  visit_date?: string
  date?: string
  notes?: string
  summary?: string
  potential_value?: number
  potentialValue?: number
  outcome?: string
}

/**
 * Converte um registro de visits do PocketBase para a interface Visit da aplicação.
 */
export function mapVisitRecord(r: any): Visit {
  const visitDate = r.visit_date || r.date || r.created || new Date().toISOString()
  const potVal = Number(r.potential_value ?? r.potentialValue ?? 0)
  const notesText = r.notes || r.summary || ''
  const factoryId = r.factory_id || r.factoryId || ''

  return {
    id: r.id,
    user_id: r.user_id || undefined,
    factoryId,
    factory_id: factoryId,
    date: visitDate,
    visit_date: visitDate,
    summary: notesText,
    notes: notesText,
    potentialValue: potVal,
    potential_value: potVal,
    outcome: r.outcome || undefined,
    created: r.created,
    updated: r.updated,
  }
}

/**
 * Lista todas as visitas cadastradas na collection visits.
 */
export async function listVisits(): Promise<Visit[]> {
  try {
    const records = await pb.collection('visits').getFullList({
      sort: '-visit_date,-created',
      requestKey: null,
    })
    return records.map(mapVisitRecord)
  } catch (err: unknown) {
    const msg = getErrorMessage(err)
    throw new Error(`Não foi possível listar as visitas: ${msg}`)
  }
}

/**
 * Cria uma nova visita no PocketBase.
 */
export async function createVisit(data: CreateVisitInput): Promise<Visit> {
  try {
    const authId = pb.authStore.record?.id
    const finalUserId = data.user_id || authId
    if (!finalUserId) {
      throw new Error('Usuário autenticado não encontrado para vincular à visita.')
    }

    const factoryId = data.factory_id || data.factoryId
    if (!factoryId) {
      throw new Error('É necessário associar a visita a uma fábrica.')
    }

    const visitDate = data.visit_date || data.date || new Date().toISOString()
    const potVal = Number(data.potential_value ?? data.potentialValue ?? 0)
    const notes = data.notes ?? data.summary ?? ''

    const payload: Record<string, unknown> = {
      user_id: finalUserId,
      factory_id: factoryId,
      visit_date: visitDate,
      notes,
      potential_value: potVal,
      outcome: data.outcome || '',
    }

    const created = await pb.collection('visits').create(payload)
    notifyDataChanged('visits')
    return mapVisitRecord(created)
  } catch (err: unknown) {
    const msg = getErrorMessage(err)
    throw new Error(`Falha ao cadastrar visita: ${msg}`)
  }
}

/**
 * Atualiza uma visita existente no PocketBase.
 */
export async function updateVisit(id: string, data: UpdateVisitInput): Promise<Visit> {
  try {
    const payload: Record<string, unknown> = {}

    if (data.factory_id !== undefined || data.factoryId !== undefined) {
      payload.factory_id = data.factory_id || data.factoryId
    }

    const visitDate = data.visit_date ?? data.date
    if (visitDate !== undefined) {
      payload.visit_date = visitDate
    }

    const notes = data.notes ?? data.summary
    if (notes !== undefined) {
      payload.notes = notes
    }

    const potVal = data.potential_value ?? data.potentialValue
    if (potVal !== undefined) {
      payload.potential_value = Number(potVal)
    }

    if (data.outcome !== undefined) {
      payload.outcome = data.outcome
    }

    const updated = await pb.collection('visits').update(id, payload)
    notifyDataChanged('visits')
    return mapVisitRecord(updated)
  } catch (err: unknown) {
    const msg = getErrorMessage(err)
    throw new Error(`Falha ao atualizar visita: ${msg}`)
  }
}

/**
 * Remove uma visita do PocketBase.
 */
export async function removeVisit(id: string): Promise<boolean> {
  try {
    await pb.collection('visits').delete(id)
    notifyDataChanged('visits')
    return true
  } catch (err: unknown) {
    const msg = getErrorMessage(err)
    throw new Error(`Falha ao excluir visita: ${msg}`)
  }
}

/**
 * Exporta padrão com list, create, update, remove
 */
export const visitsService = {
  list: listVisits,
  create: createVisit,
  update: updateVisit,
  remove: removeVisit,
}
