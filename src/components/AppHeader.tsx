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
import { useRealtimeData, useRealtimeDataContext } from '@/hooks/useRealtimeData'
import { useGlobalData } from '@/store/GlobalDataProvider'
import { useLogoUrl } from '@/hooks/use-logo-url'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, CheckCircle2 as SyncOkIcon } from 'lucide-react'

function formatSyncTimestamp(timestamp: number | null): string {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  const dd = pad(d.getDate())
  const mm = pad(d.getMonth() + 1)
  const yyyy = d.getFullYear()
  const hh = pad(d.getHours())
  const min = pad(d.getMinutes())
  return `Atualizado em ${dd}/${mm}/${yyyy} ${hh}:${min}`
}

export function AppHeader() {
  const { factories, tasks, isOnline } = useAppContext()
  const { isReconnecting } = useRealtimeDataContext()
  const { lastSyncTime, isSyncing, syncStatus, syncError, syncAll } = useGlobalData()
  const { t: tr } = useI18n()
  const [open, setOpen] = useState(false)
  const [dbNotifications, setDbNotifications] = useState<AppNotification[]>([])
  const { theme, setTheme } = useTheme()
  const { logoUrl, isLoading, hasError } = useLogoUrl()
  const [imgError, setImgError] = useState(false)
  const navigate = useNavigate()

  const showFallback = hasError || imgError
  const goHome = () => navigate('/')

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

  useRealtimeData('orders', () => {
    loadNotifications()
  })
  useRealtimeData('notifications', () => {
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
    <header className="h-16 border-b border-border/40 flex items-center justify-between px-4 lg:px-6 bg-background/80 text-foreground shrink-0 backdrop-blur-md z-50 sticky top-0 print:hidden transition-colors">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="md:hidden" />
        {isLoading ? (
          <div className="h-8 lg:h-10 w-auto min-w-[80px] animate-pulse bg-muted rounded-md" />
        ) : showFallback ? (
          <button
            type="button"
            onClick={goHome}
            className="text-gradient-brand font-extrabold text-xl tracking-tight"
            aria-label="Blink Biotech"
          >
            Blink
          </button>
        ) : (
          <div
            className="bg-white dark:bg-[#1a1a1a] p-1 rounded-md inline-flex items-center justify-center cursor-pointer"
            onClick={goHome}
          >
            <img
              src={logoUrl ?? undefined}
              alt="Blink Biotech"
              className="h-8 lg:h-10 w-auto"
              onError={() => setImgError(true)}
            />
          </div>
        )}
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
        {isReconnecting && (
          <div
            className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-md ml-2 animate-pulse"
            title="Reconexão com o servidor em andamento"
          >
            <RefreshCw className="w-3 h-3 animate-spin text-amber-600 dark:text-amber-400" />
            <span>Reconectando...</span>
          </div>
        )}

        {/* Global Data Sync Indicator + Sincronizar agora Button */}
        <div className="hidden xl:flex items-center gap-2 text-xs text-muted-foreground ml-3 border-l border-border/60 pl-3">
          {/* 4 STATES: LOADING, EMPTY, ERROR, SUCCESS */}
          {isSyncing ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <RefreshCw className="w-3 h-3 animate-spin text-primary shrink-0" />
              <span>Sincronizando dados...</span>
            </div>
          ) : syncStatus === 'error' || syncError ? (
            <div className="flex items-center gap-1.5 text-destructive font-medium">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Falha ao sincronizar. Tente novamente.</span>
            </div>
          ) : !lastSyncTime ? (
            <span className="text-muted-foreground italic">Nenhum dado sincronizado ainda</span>
          ) : (
            <span className="text-muted-foreground font-normal">
              {formatSyncTimestamp(lastSyncTime)}
            </span>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void syncAll()}
            disabled={isSyncing}
            className="h-7 px-2.5 text-xs gap-1.5 shadow-none border-border/70 hover:bg-muted font-normal"
            title="Sincronizar todos os dados do banco"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
            <span>{syncStatus === 'error' ? 'Tentar novamente' : 'Sincronizar agora'}</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        {/* Sync button for smaller screens (md-lg) where full text indicator is hidden */}
        <div className="xl:hidden flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void syncAll()}
            disabled={isSyncing}
            className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
            title={
              lastSyncTime
                ? `${formatSyncTimestamp(lastSyncTime)} — Clique para sincronizar agora`
                : 'Sincronizar agora'
            }
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
            <span className="hidden sm:inline text-[11px]">Sincronizar</span>
          </Button>
        </div>
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
