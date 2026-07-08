import pb from '@/lib/pocketbase/client'
import { AppNotification } from '@/types'

export const getNotifications = () =>
  pb.collection('notifications').getFullList<AppNotification>({ sort: '-created' })

export const markNotificationAsRead = (id: string) =>
  pb.collection('notifications').update(id, { isRead: true })

export const evaluateTargets = () => pb.send('/backend/v1/targets/evaluate', { method: 'POST' })

export const evaluatePerformanceAlerts = () =>
  pb.send('/backend/v1/performance-alerts/evaluate', { method: 'POST' })
