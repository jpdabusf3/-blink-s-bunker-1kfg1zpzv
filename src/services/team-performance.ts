import pb from '@/lib/pocketbase/client'

export interface ActionsPerUser {
  user: string
  email: string
  actions: number
}

export interface ActionTypeDistribution {
  name: string
  value: number
}

export interface TeamPerformance {
  actionsPerUser: ActionsPerUser[]
  actionTypeDistribution: ActionTypeDistribution[]
  totalLogs: number
}

export const getTeamPerformance = (
  startDate?: string,
  endDate?: string,
): Promise<TeamPerformance> => {
  const params = new URLSearchParams()
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  const query = params.toString()
  return pb.send(`/backend/v1/team-performance${query ? `?${query}` : ''}`, { method: 'GET' })
}
