import pb from '@/lib/pocketbase/client'
import { ActivityLog } from '@/types'

export const getActivityLogs = () =>
  pb.collection('activity_logs').getFullList<ActivityLog>({
    sort: '-created',
    expand: 'user',
  })

export const getActivityLogsByRecord = (recordId: string, collectionName: string) =>
  pb.collection('activity_logs').getFullList<ActivityLog>({
    sort: '-created',
    expand: 'user',
    filter: `recordId = "${recordId}" && target_collection = "${collectionName}"`,
  })

export interface ActivityLogMeta {
  tipo?: string
  proximo_passo?: string
  status_anterior?: string
  status_novo?: string
  origem?: string
}

import { notifyDataChanged } from '@/hooks/useRealtimeData'

export const logActivity = async (
  action: string,
  details: string = '',
  recordId?: string,
  collectionName?: string,
  meta?: ActivityLogMeta,
) => {
  const res = await pb.send('/backend/v1/log-activity', {
    method: 'POST',
    body: JSON.stringify({
      action,
      details,
      recordId,
      collectionName,
      ...(meta || {}),
    }),
    headers: { 'Content-Type': 'application/json' },
  })
  notifyDataChanged('activity_logs')
  return res
}

export interface BatchActivityLogItem {
  action: string
  details?: string
  recordId?: string
  collectionName?: string
  tipo?: string
  proximo_passo?: string
  status_anterior?: string
  status_novo?: string
  origem?: string
}

export const logActivityBatch = async (entries: BatchActivityLogItem[]) => {
  if (!entries || entries.length === 0) return { success: true, count: 0 }
  const res = await pb.send<{ success: boolean; count: number }>(
    '/backend/v1/log-assignment-batch',
    {
      method: 'POST',
      body: JSON.stringify({ entries }),
      headers: { 'Content-Type': 'application/json' },
    },
  )
  notifyDataChanged('activity_logs')
  return res
}

/**
 * Busca histórico de atribuições e auditoria de carteira:
 * - Para um cliente específico (recordId fornecido) ou para toda a carteira (global)
 * Filtra registros que contenham 'Atribuição' ou 'vendedor' ou 'gestor' ou target_collection='factories'
 */
export const getAssignmentAuditLogs = async (clientId?: string) => {
  let filter = `target_collection = "factories"`
  if (clientId) {
    filter += ` && recordId = "${clientId}"`
  }
  return pb.collection('activity_logs').getFullList<ActivityLog>({
    sort: '-created',
    expand: 'user',
    filter,
  })
}
