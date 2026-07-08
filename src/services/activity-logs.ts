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
    filter: `recordId = "${recordId}" && collectionName = "${collectionName}"`,
  })

export const logActivity = (
  action: string,
  details: string = '',
  recordId?: string,
  collectionName?: string,
) =>
  pb.send('/backend/v1/log-activity', {
    method: 'POST',
    body: JSON.stringify({ action, details, recordId, collectionName }),
    headers: { 'Content-Type': 'application/json' },
  })
