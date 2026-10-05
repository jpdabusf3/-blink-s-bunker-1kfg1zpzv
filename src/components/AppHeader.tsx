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
  CheckCheck,
  MessageSquare,
  ExternalLink,
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
import { chatService } from '@/services/chat-service'
import { AppNotification } from '@/types'
import { useRealtimeData, useRealtimeDataContext } from '@/hooks/useRealtimeData'
import { useGlobalData } from '@/store/GlobalDataProvider'
import { useLogoUrl } from '@/hooks/use-logo-url'
import { useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, CheckCircle2 as SyncOkIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

function formatSyncTimeHHMMSS(timestamp: number | null): string {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  const hh = pad(d.getHours())
  const min = pad(d.getMinutes())
  const ss = pad(d.getSeconds())
  return `${hh}:${min}:${ss}`
}

export function AppHeader() {
  const { factories, tasks, isOnline } = useAppContext()
  const { isReconnecting } = useRealtimeDataContext()
  const { lastSyncTime, isSyncing, syncStatus, syncError, syncAll } = useGlobalData()
  const { t: tr } = useI18n()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [dbNotifications, setDbNotifications] = useState<AppNotification[]>([])
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0)
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const { theme, setTheme } = useTheme()
  const { logoUrl, isLoading, hasError } = useLogoUrl()
  const [imgError, setImgError] = useState(false)
  const navigate = useNavigate()

  const currentUserId = user?.id || ''
  const showFallback = hasError || imgError
  const goHome = () => navigate('/')

  const loadNotifications = useCallback(async () => {
    try {
      await evaluateTargets()
      const data = await getNotifications()
      setDbNotifications(data)
    } catch (e) {
      console.error(e)
    }
  }, [])

  const loadUnreadChatCount = useCallback(async () => {
    if (!currentUserId) return
    try {
      const count = await chatService.getUnreadCount(currentUserId)
      setUnreadChatCount(count)
    } catch (err) {
      console.warn('[AppHeader] Erro ao carregar contagem de chat não lido:', err)
    }
  }, [currentUserId])

  useEffect(() => {
    void loadNotifications()
    void loadUnreadChatCount()
  }, [loadNotifications, loadUnreadChatCount])

  useRealtimeData('orders', () => {
    void loadNotifications()
  })
  useRealtimeData('notifications', () => {
    void loadNotifications()
  })
  useRealtimeData(['mensagens', 'leituras_mensagens', 'conversas'], () => {
    void loadUnreadChatCount()
    void loadNotifications()
  })

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id)
      setDbNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    } catch (e) {
      console.error(e)
    }
  }

  const handleMarkAllAsRead = async () => {
    if (isMarkingAll) return
    setIsMarkingAll(true)
    try {
      if (currentUserId) {
        await chatService.markAllNotificationsAsRead(currentUserId)
      }
      setDbNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } catch (err) {
      console.error('[AppHeader] Falha ao marcar todas como lidas:', err)
    } finally {
      setIsMarkingAll(false)
    }
  }

  const handleNotificationClick = async (n: {
    id: string
    isDb: boolean
    context_link?: string
    context_type?: string
    context_id?: string
  }) => {
    if (n.isDb) {
      void handleMarkAsRead(n.id)
    }
    if (n.context_link) {
      navigate(n.context_link)
    } else if (n.context_type === 'cliente' && n.context_id) {
      navigate(`/cadastro?highlight=${n.context_id}`)
    } else if (n.context_type === 'pedido' && n.context_id) {
      navigate(`/gestao-pedidos?highlight=${n.context_id}`)
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
      icon: n.type === 'success' ? CheckCircle2 : n.type === 'info' ? MessageSquare : AlertTriangle,
      title: n.title,
      message: n.message,
      context_link: n.context_link,
      context_type: n.context_type,
      context_id: n.context_id,
    })),
    ...notifications.map((n) => ({
      ...n,
      isDb: false,
      title: tr('notif.warning'),
      context_link: undefined,
      context_type: undefined,
      context_id: undefined,
    })),
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

        {/* Global Data Sync Indicator + Atualizar agora Button */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground ml-3 border-l border-border/60 pl-3">
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
            <span className="text-muted-foreground italic">Última sincronização: pendente</span>
          ) : (
            <span className="text-muted-foreground font-normal">
              Última sincronização:{' '}
              <span className="font-mono text-foreground font-medium">
                {formatSyncTimeHHMMSS(lastSyncTime)}
              </span>
            </span>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void syncAll()}
            disabled={isSyncing}
            className="h-7 px-2.5 text-xs gap-1.5 shadow-none border-border/70 hover:bg-muted font-normal"
            title="Sincronizar todos os dados agora"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
            <span>{isSyncing ? 'Atualizando...' : 'Atualizar agora'}</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        {/* Sync button for smaller screens (< lg) where full text indicator is hidden */}
        <div className="lg:hidden flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void syncAll()}
            disabled={isSyncing}
            className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
            title={
              lastSyncTime
                ? `Última sincronização: ${formatSyncTimeHHMMSS(lastSyncTime)} — Atualizar agora`
                : 'Atualizar agora'
            }
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
            <span className="hidden sm:inline text-[11px]">Atualizar agora</span>
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

        {/* Acesso direto ao Chat / Mensagens com Badge de não lidas */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/mensagens')}
          className="relative w-11 h-11 md:w-10 md:h-10 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
          title="Mensagens internas da equipe"
        >
          <MessageSquare className="w-5 h-5" />
          {unreadChatCount > 0 && (
            <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center border-2 border-card shadow-sm animate-pulse">
              {unreadChatCount > 99 ? '99+' : unreadChatCount}
            </span>
          )}
          <span className="sr-only">Mensagens da equipe</span>
        </Button>

        {/* Sininho de Notificações com Badge e Botão Marcar todas como lidas */}
        <Popover>
          <PopoverTrigger asChild>
            <div
              className="relative flex items-center justify-center w-11 h-11 md:w-10 md:h-10 rounded-full hover:bg-muted transition-colors cursor-pointer group"
              title={tr('hdr.notifications')}
            >
              <Bell className="w-6 h-6 md:w-5 md:h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              {notifCount > 0 && (
                <span className="absolute top-1 right-1 bg-destructive text-white text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center border-2 border-card shadow-sm">
                  {notifCount > 99 ? '99+' : notifCount}
                </span>
              )}
            </div>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-88 sm:w-96 p-4">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-border">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                <Bell className="w-4 h-4 text-primary" /> {tr('hdr.notifications')}
                {notifCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">
                    {notifCount}
                  </Badge>
                )}
              </h3>
              {unreadDbNotifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={isMarkingAll}
                  className="h-7 text-xs text-primary hover:text-primary/80 gap-1 px-2 font-normal"
                  title="Marcar todas as notificações como lidas"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Marcar todas como lidas</span>
                </Button>
              )}
            </div>

            <div className="space-y-2 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
              {allNotifications.length === 0 ? (
                <div className="p-6 text-center space-y-1">
                  <Bell className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-medium text-foreground">Nenhuma notificação</p>
                  <p className="text-xs text-muted-foreground">{tr('hdr.noNotif')}</p>
                </div>
              ) : (
                allNotifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className="p-3 border rounded-lg text-sm bg-muted/30 hover:bg-muted/70 transition-all flex flex-col gap-1 relative group cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <n.icon
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          n.type === 'destructive'
                            ? 'text-destructive'
                            : n.type === 'warning'
                              ? 'text-orange-500'
                              : n.type === 'success'
                                ? 'text-green-500'
                                : 'text-primary'
                        }`}
                      />
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <strong className="block text-xs font-semibold text-foreground truncate">
                            {n.title}
                          </strong>
                          {n.context_link && (
                            <ExternalLink className="w-3 h-3 text-primary shrink-0 opacity-70" />
                          )}
                        </div>
                        <span className="leading-tight text-xs text-muted-foreground line-clamp-2">
                          {n.message}
                        </span>
                      </div>
                      {n.isDb && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMarkAsRead(n.id)
                          }}
                          title={tr('hdr.markRead')}
                        >
                          <Check className="h-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 mt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Atualizado em tempo real</span>
              <Button
                variant="link"
                size="sm"
                onClick={() => navigate('/mensagens')}
                className="h-auto p-0 text-xs text-primary font-medium"
              >
                Abrir Chat da Equipe →
              </Button>
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
