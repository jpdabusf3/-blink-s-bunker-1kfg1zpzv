import pb from '@/lib/pocketbase/client'
import { AppNotification } from '@/types'

export const getNotifications = () =>
  pb.collection('notifications').getFullList<AppNotification>({ sort: '-created' })

export const markNotificationAsRead = async (id: string) => {
  return await pb.collection('notifications').update<AppNotification>(id, {
    isRead: true,
    read: true,
  })
}

export const markAllNotificationsAsRead = async (userId?: string): Promise<void> => {
  try {
    const filter = userId
      ? `(userId = "${userId}" || userId = "" || userId = null) && isRead = false`
      : 'isRead = false'
    const unread = await pb.collection('notifications').getFullList<AppNotification>({
      filter,
    })
    if (unread.length === 0) return

    await Promise.all(
      unread.map((n) =>
        pb
          .collection('notifications')
          .update(n.id, { isRead: true, read: true })
          .catch((err) => {
            console.warn(`[notifications] Falha ao marcar ${n.id} como lida:`, err)
            return null
          }),
      ),
    )
  } catch (err) {
    console.error('[notifications] Erro ao marcar todas como lidas:', err)
    throw err
  }
}

export const clearNotifications = async (userId?: string): Promise<void> => {
  try {
    const filter = userId ? `userId = "${userId}" || userId = "" || userId = null` : ''
    const list = await pb
      .collection('notifications')
      .getFullList<AppNotification>(filter ? { filter } : undefined)
    await Promise.all(
      list.map((n) =>
        pb
          .collection('notifications')
          .delete(n.id)
          .catch((err) => {
            console.warn(`[notifications] Falha ao remover notificação ${n.id}:`, err)
            return null
          }),
      ),
    )
  } catch (err) {
    console.error('[notifications] Erro ao zerar/excluir notificações:', err)
    throw err
  }
}

export const evaluateTargets = () => pb.send('/backend/v1/targets/evaluate', { method: 'POST' })

export const evaluatePerformanceAlerts = () =>
  pb.send('/backend/v1/performance-alerts/evaluate', { method: 'POST' })
