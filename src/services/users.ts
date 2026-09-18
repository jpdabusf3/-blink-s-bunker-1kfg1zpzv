import pb from '@/lib/pocketbase/client'
import type { ActivityLog } from '@/types'

export interface UserListItem {
  id: string
  name: string
  email: string
  job_title: string
  geographicArea: string
  country: string
  created: string
  deactivated?: boolean
  whatsapp?: string
  whatsapp_validated?: boolean
  gestao_tecnica_id?: string
  expand?: {
    gestao_tecnica_id?: {
      id: string
      nome: string
      funcao?: string
      regiao?: string
      ativo?: boolean
    }
  }
}

export interface UserReportLog {
  id: string
  action: string
  details: string
  created: string
}

export interface UserReport {
  logs: UserReportLog[]
  actionCounts: Record<string, number>
  kpis: {
    prospects: number
    homologated: number
    totalOrdersValue: number
    totalTargetsValue: number
    goalsAchieved: number
  }
}

export const getUsers = (): Promise<UserListItem[]> =>
  pb.collection('users').getFullList({ sort: 'created', expand: 'gestao_tecnica_id' })

export const getUserReport = (userId: string): Promise<UserReport> =>
  pb.send(`/backend/v1/users/${userId}/report`, { method: 'GET' })

export const manageUser = (
  userId: string,
  action: 'edit' | 'deactivate' | 'reactivate',
  data?: {
    name?: string
    job_title?: string
    geographicArea?: string
    country?: string
    whatsapp?: string
    whatsapp_validated?: boolean
  },
): Promise<{ success: boolean }> =>
  pb.send(`/backend/v1/users/${userId}/manage`, {
    method: 'POST',
    body: JSON.stringify({ action, ...data }),
    headers: { 'Content-Type': 'application/json' },
  })

export const getUserHistory = (userId: string): Promise<ActivityLog[]> =>
  pb.collection('activity_logs').getFullList<ActivityLog>({
    sort: '-created',
    expand: 'user',
    filter: `recordId = "${userId}" && target_collection = "users"`,
  })
