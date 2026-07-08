import pb from '@/lib/pocketbase/client'

export interface UserListItem {
  id: string
  name: string
  email: string
  job_title: string
  geographicArea: string
  country: string
  created: string
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
  pb.send('/backend/v1/users', { method: 'GET' })

export const getUserReport = (userId: string): Promise<UserReport> =>
  pb.send(`/backend/v1/users/${userId}/report`, { method: 'GET' })
