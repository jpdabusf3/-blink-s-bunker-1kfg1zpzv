import pb from '@/lib/pocketbase/client'
import { ActivityLog } from '@/types'

export const getActivityLogs = () =>
  pb.collection('activity_logs').getFullList<ActivityLog>({
    sort: '-created',
    expand: 'user',
  })

export const logActivity = (action: string, details: string = '') =>
  pb.send('/backend/v1/log-activity', {
    method: 'POST',
    body: JSON.stringify({ action, details }),
    headers: { 'Content-Type': 'application/json' },
  })
