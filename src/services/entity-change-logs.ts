import pb from '@/lib/pocketbase/client'
import { notifyDataChanged } from '@/hooks/useRealtimeData'

export type EntityType = 'produto' | 'vendedor' | 'faturamento' | 'cliente'

export interface EntityChangeLogItem {
  id: string
  entity_type: EntityType | string
  entity_id: string
  entity_name?: string
  user_id?: string
  user_name?: string
  field?: string
  old_value?: string
  new_value?: string
  change_summary: string
  action?: 'create' | 'update' | 'delete' | 'deactivate' | 'restore'
  created: string
  updated: string
  expand?: {
    user_id?: {
      id: string
      name?: string
      email?: string
    }
  }
}

/**
 * Grava um log de alteração/exclusão/criação em entity_change_logs.
 * Nunca interrompe nem quebra o fluxo chamador caso falhe.
 */
export async function recordEntityChangeLog(params: {
  entity_type: EntityType | string
  entity_id: string
  entity_name?: string
  field?: string
  old_value?: string | null
  new_value?: string | null
  change_summary: string
  action?: 'create' | 'update' | 'delete' | 'deactivate' | 'restore'
  user_id?: string
  user_name?: string
}): Promise<void> {
  try {
    const authRecord = pb.authStore.record as { id?: string; name?: string; email?: string } | null
    const finalUserId = params.user_id || authRecord?.id || undefined
    const finalUserName =
      params.user_name || authRecord?.name || authRecord?.email || 'Usuário autenticado'

    await pb.collection('entity_change_logs').create({
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      entity_name: params.entity_name || '',
      user_id: finalUserId || null,
      user_name: finalUserName,
      field: params.field || '',
      old_value: params.old_value ?? '',
      new_value: params.new_value ?? '',
      change_summary: params.change_summary,
      action: params.action || 'update',
    })
    notifyDataChanged('entity_change_logs')
  } catch (err) {
    console.warn('[entity-change-logs] Falha ao registrar log de entidade:', err)
  }
}

/**
 * Obtém logs de auditoria de uma entidade específica
 */
export async function getEntityChangeLogs(
  entityType: EntityType | string,
  entityId: string,
): Promise<EntityChangeLogItem[]> {
  try {
    const records = await pb.collection('entity_change_logs').getFullList({
      filter: `entity_type = '${entityType}' && entity_id = '${entityId}'`,
      sort: '-created',
      expand: 'user_id',
    })
    return records.map((r: any) => ({
      id: r.id,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      entity_name: r.entity_name || '',
      user_id: r.user_id || undefined,
      user_name: r.user_name || r.expand?.user_id?.name || r.expand?.user_id?.email || 'Sistema',
      field: r.field || undefined,
      old_value: r.old_value !== undefined ? String(r.old_value) : undefined,
      new_value: r.new_value !== undefined ? String(r.new_value) : undefined,
      change_summary: r.change_summary || 'Alteração realizada',
      action: r.action || 'update',
      created: r.created,
      updated: r.updated,
      expand: r.expand,
    }))
  } catch (err) {
    console.warn('[entity-change-logs] Falha ao listar logs:', err)
    return []
  }
}

/**
 * Compara dois objetos antes/depois e grava logs de campo por campo
 */
export async function diffAndRecordEntityChanges(params: {
  entity_type: EntityType | string
  entity_id: string
  entity_name?: string
  before: Record<string, any>
  after: Record<string, any>
  fieldLabels?: Record<string, string>
}): Promise<void> {
  try {
    const { entity_type, entity_id, entity_name, before, after, fieldLabels = {} } = params
    for (const key of Object.keys(after)) {
      if (key === 'updated' || key === 'created' || key === 'id') continue
      const oldVal =
        before[key] !== undefined && before[key] !== null ? String(before[key]).trim() : ''
      const newVal =
        after[key] !== undefined && after[key] !== null ? String(after[key]).trim() : ''

      if (oldVal !== newVal) {
        const label = fieldLabels[key] || key
        const oldDisplay = oldVal ? `'${oldVal}'` : "''(vazio)"
        const newDisplay = newVal ? `'${newVal}'` : "''(vazio)"
        const summary = `${label} alterado de ${oldDisplay} para ${newDisplay}`

        await recordEntityChangeLog({
          entity_type,
          entity_id,
          entity_name,
          field: key,
          old_value: oldVal,
          new_value: newVal,
          change_summary: summary,
          action: 'update',
        })
      }
    }
  } catch (err) {
    console.warn('[entity-change-logs] Falha ao diff e registrar alterações:', err)
  }
}
