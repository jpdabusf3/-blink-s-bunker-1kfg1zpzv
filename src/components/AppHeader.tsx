import {
  Bell,
  Plus,
  AlertTriangle,
  Calendar,
  WifiOff,
  CheckCircle2,
  Moon,
  Sun,
  Check,
} from 'lucide-react'
import { Button } from './ui/button'
import { useAppContext } from '@/store/AppContext'
import { useI18n } from '@/hooks/use-i18n'
import { isStale, isApproachingDeadline, isPassedDeadline } from '@/lib/utils'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog'
import { FactoryForm } from './FactoryForm'
import { LanguageSelector } from './LanguageSelector'
import { useState, useEffect } from 'react'
import { SidebarTrigger } from './ui/sidebar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { useTheme } from 'next-themes'
import { getNotifications, evaluateTargets, markNotificationAsRead } from '@/services/notifications'
import { AppNotification } from '@/types'
import { useRealtime } from '@/hooks/use-realtime'

export function AppHeader() {
  const { factories, tasks, isOnline } = useAppContext()
  const { t: tr } = useI18n()
  const [open, setOpen] = useState(false)
  const [dbNotifications, setDbNotifications] = useState<AppNotification[]>([])
  const { theme, setTheme } = useTheme()

  const loadNotifications = async () => {
    try {
      await evaluateTargets()
      const data = await getNotifications()
      setDbNotifications(data)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  useRealtime('orders', () => {
    loadNotifications()
  })
  useRealtime('notifications', () => {
    loadNotifications()
  })

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id)
      setDbNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    } catch (e) {
      console.error(e)
    }
  }

  const notifications = factories.flatMap((f) => {
    const notifs = []
    if (isPassedDeadline(f.deadline)) {
      notifs.push({
        id: `passed-${f.id}`,
        type: 'destructive',
        icon: Calendar,
        message: `${f.name}: ${tr('notif.passed')}`,
      })
    } else if (isApproachingDeadline(f.deadline)) {
      notifs.push({
        id: `approaching-${f.id}`,
        type: 'warning',
        icon: Calendar,
        message: `${f.name}: ${tr('notif.approaching')}`,
      })
    }
    if (isStale(f.lastInteraction)) {
      notifs.push({
        id: `stale-${f.id}`,
        type: 'stale',
        icon: AlertTriangle,
        message: `${f.name}: ${tr('notif.stale')}`,
      })
    }
    return notifs
  })

  tasks.forEach((task) => {
    if (!task.completed && task.dueDate) {
      const isOverdue = isPassedDeadline(task.dueDate)
      const isApproaching = isApproachingDeadline(task.dueDate)
      const factory = factories.find((f) => f.id === task.factoryId)
      if (isOverdue) {
        notifications.push({
          id: `task-overdue-${task.id}`,
          type: 'destructive',
          icon: CheckCircle2,
          message: `${tr('notif.taskOverdue')} [${task.type}]: ${task.description} (${factory?.name || tr('common.factory')})`,
        })
      } else if (isApproaching) {
        notifications.push({
          id: `task-approaching-${task.id}`,
          type: 'warning',
          icon: Calendar,
          message: `${tr('notif.taskDue')} [${task.type}]: ${task.description} (${factory?.name || tr('common.factory')})`,
        })
      } else if (task.priority === 'Alta') {
        notifications.push({
          id: `task-high-${task.id}`,
          type: 'warning',
          icon: CheckCircle2,
          message: `${tr('notif.highPri')}: ${task.description} (${factory?.name || tr('common.factory')})`,
        })
      }
    } else if (!task.completed && !task.dueDate && task.priority === 'Alta') {
      const factory = factories.find((f) => f.id === task.factoryId)
      notifications.push({
        id: `task-high-${task.id}`,
        type: 'warning',
        icon: CheckCircle2,
        message: `${tr('notif.highPri')}: ${task.description} (${factory?.name || tr('common.factory')})`,
      })
    }
  })

  const unreadDbNotifications = dbNotifications.filter((n) => !n.isRead)
  const allNotifications = [
    ...unreadDbNotifications.map((n) => ({
      id: n.id,
      isDb: true,
      type: n.type === 'success' ? 'success' : n.type === 'warning' ? 'warning' : 'info',
      icon: n.type === 'success' ? CheckCircle2 : AlertTriangle,
      title: n.title,
      message: n.message,
    })),
    ...notifications.map((n) => ({ ...n, isDb: false, title: tr('notif.warning') })),
  ]

  const notifCount = allNotifications.length

  return (
    <header className="h-16 border-b flex items-center justify-between px-4 lg:px-6 bg-card text-card-foreground shrink-0 shadow-sm z-10 sticky top-0 print:hidden">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="md:hidden" />
        <h1 className="font-semibold text-lg lg:text-xl text-primary hidden sm:block">
          {tr('hdr.title')}
        </h1>
        {!isOnline && (
          <div
            className="flex items-center gap-1.5 text-[11px] font-medium text-orange-600 bg-orange-500/10 px-2.5 py-1 rounded-md ml-2"
            title={tr('hdr.offline')}
          >
            <WifiOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tr('hdr.offline')}</span>
            <span className="sm:hidden">{tr('hdr.offlineS')}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        <LanguageSelector />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={tr('hdr.theme')}
          className="w-10 h-10 rounded-full"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-muted-foreground" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-muted-foreground" />
          <span className="sr-only">{tr('hdr.theme')}</span>
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <div
              className="relative flex items-center justify-center w-11 h-11 md:w-10 md:h-10 rounded-full hover:bg-muted transition-colors cursor-pointer group"
              title={tr('hdr.notifications')}
            >
              <Bell className="w-6 h-6 md:w-5 md:h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              {notifCount > 0 && (
                <span className="absolute top-1 right-1 bg-destructive text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-card">
                  {notifCount}
                </span>
              )}
            </div>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-4">
            <h3 className="font-semibold mb-3 text-sm flex items-center gap-2">
              <Bell className="w-4 h-4" /> {tr('hdr.notifications')}
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {allNotifications.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">{tr('hdr.noNotif')}</p>
              ) : (
                allNotifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-3 border rounded-lg text-sm bg-muted/30 flex flex-col gap-1 relative group"
                  >
                    <div className="flex items-start gap-3">
                      <n.icon
                        className={`w-4 h-4 shrink-0 mt-0.5 ${n.type === 'destructive' ? 'text-destructive' : n.type === 'warning' ? 'text-orange-500' : n.type === 'success' ? 'text-green-500' : 'text-primary'}`}
                      />
                      <div className="flex-1">
                        <strong className="block text-xs mb-0.5">{n.title}</strong>
                        <span className="leading-tight text-muted-foreground">{n.message}</span>
                      </div>
                      {n.isDb && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2"
                          onClick={() => handleMarkAsRead(n.id)}
                          title={tr('hdr.markRead')}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 shadow-sm">
              <Plus className="w-5 h-5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">{tr('hdr.newFactory')}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{tr('hdr.quickReg')}</DialogTitle>
              <DialogDescription>{tr('hdr.quickRegDesc')}</DialogDescription>
            </DialogHeader>
            <FactoryForm onSubmit={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
    </header>
  )
}
