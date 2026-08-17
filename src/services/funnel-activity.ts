import pb from '@/lib/pocketbase/client'
import type { RecordSubscription } from 'pocketbase'

export type FunnelActionType = 'create' | 'update' | 'delete' | 'move' | 'assign' | 'status_change'

export type FunnelEntityType = 'deal' | 'client' | 'action_plan' | 'goal' | 'team_member'

export interface FunnelActivityLog {
  id: string
  user: string
  action_type: FunnelActionType
  entity_type: FunnelEntityType
  entity_id: string
  entity_name: string
  old_value: string
  new_value: string
  description: string
  created: string
  updated: string
  expand?: {
    user?: { id: string; name: string; email: string }
  }
}

export interface FunnelActivityFilters {
  dateStart?: string
  dateEnd?: string
  action_type?: FunnelActionType | 'all'
  entity_type?: FunnelEntityType | 'all'
  search?: string
}

const PAGE_SIZE = 20

function buildFilter(filters: FunnelActivityFilters = {}): string {
  const parts: string[] = []
  const userId = pb.authStore.record?.id
  if (userId) parts.push(`user = "${userId}"`)

  if (filters.dateStart) {
    parts.push(`created >= "${filters.dateStart}T00:00:00.000Z"`)
  }
  if (filters.dateEnd) {
    parts.push(`created <= "${filters.dateEnd}T23:59:59.999Z"`)
  }
  if (filters.action_type && filters.action_type !== 'all') {
    parts.push(`action_type = "${filters.action_type}"`)
  }
  if (filters.entity_type && filters.entity_type !== 'all') {
    parts.push(`entity_type = "${filters.entity_type}"`)
  }
  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim().replace(/"/g, '\\"')
    parts.push(`(entity_name ~ "${q}" || description ~ "${q}")`)
  }
  return parts.join(' && ')
}

export const funnelActivityService = {
  async getAll(
    filters: FunnelActivityFilters = {},
    page: number = 1,
    pageSize: number = PAGE_SIZE,
  ) {
    const result = await pb
      .collection('funnel_activity_log')
      .getList<FunnelActivityLog>(page, pageSize, {
        sort: '-created',
        filter: buildFilter(filters),
        expand: 'user',
      })
    return result
  },

  async create(logEntry: {
    action_type: FunnelActionType
    entity_type: FunnelEntityType
    entity_id: string
    entity_name?: string
    old_value?: string
    new_value?: string
    description: string
  }) {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Sem permissao')
    return pb.collection('funnel_activity_log').create<FunnelActivityLog>({
      user: userId,
      action_type: logEntry.action_type,
      entity_type: logEntry.entity_type,
      entity_id: logEntry.entity_id,
      entity_name: logEntry.entity_name || '',
      old_value: logEntry.old_value || '',
      new_value: logEntry.new_value || '',
      description: logEntry.description,
    })
  },

  subscribe(callback: (data: RecordSubscription<FunnelActivityLog>) => void) {
    return pb.collection('funnel_activity_log').subscribe<FunnelActivityLog>('*', (e) => {
      if (e.action === 'create') {
        try {
          callback(e)
        } catch (err) {
          console.error('funnel activity subscribe error', err)
        }
      }
    })
  },
}
