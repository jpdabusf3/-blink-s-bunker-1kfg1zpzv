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
  Trash2,
  AlertCircle,
  RotateCw,
  Sparkles,
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
import { useState, useEffect, useCallback, useMemo } from 'react'
import { SidebarTrigger } from './ui/sidebar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { useTheme } from 'next-themes'
import {
  getNotifications,
  evaluateTargets,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/services/notifications'
import { chatService } from '@/services/chat-service'
import { AppNotification } from '@/types'
import { useRealtimeData, useRealtimeDataContext } from '@/hooks/useRealtimeData'
import { useGlobalData } from '@/store/GlobalDataProvider'
import { useLogoUrl } from '@/hooks/use-logo-url'
import { useAuth } from '@/hooks/use-auth'
import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { formatRelativeTimeBR } from '@/lib/contextNavigation'

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
  const [localReadIds, setLocalReadIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('blink_read_notifs')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0)
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const [isClearingAll, setIsClearingAll] = useState(false)
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all')
  const [notifLoading, setNotifLoading] = useState<boolean>(true)
  const [notifError, setNotifError] = useState<string | null>(null)
  const { theme, setTheme } = useTheme()
  const { logoUrl, isLoading, hasError } = useLogoUrl()
  const [imgError, setImgError] = useState(false)
  const navigate = useNavigate()

  const currentUserId = user?.id || ''
  const showFallback = hasError || imgError
  const goHome = () => navigate('/')

  const persistLocalRead = useCallback((id: string) => {
    setLocalReadIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      try {
        localStorage.setItem('blink_read_notifs', JSON.stringify(Array.from(next)))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  const loadNotifications = useCallback(async () => {
    try {
      setNotifError(null)
      try {
        await evaluateTargets()
      } catch {
        // endpoints backend são opcionais se offline ou sem dados
      }
      const data = await getNotifications()
      setDbNotifications(data)
    } catch (e) {
      console.error('[AppHeader] Erro ao carregar notificações:', e)
      setNotifError('Não foi possível carregar os alertas do servidor.')
    } finally {
      setNotifLoading(false)
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

  const handleMarkAsRead = async (id: string, isDb: boolean) => {
    persistLocalRead(id)
    if (isDb) {
      try {
        await markNotificationAsRead(id)
        setDbNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
      } catch (e) {
        console.error('[AppHeader] Erro ao persistir leitura no backend:', e)
      }
    }
  }

  const handleMarkAllAsRead = async () => {
    if (isMarkingAll) return
    setIsMarkingAll(true)
    try {
      // 1. Marca todas as do banco
      await markAllNotificationsAsRead(currentUserId)
      setDbNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))

      // 2. Marca todas as derivadas em cache local para persistir leitura
      const allIds = [...dbNotifications.map((n) => n.id), ...derivedAlerts.map((n) => n.id)]
      setLocalReadIds((prev) => {
        const next = new Set(prev)
        allIds.forEach((id) => next.add(id))
        try {
          localStorage.setItem('blink_read_notifs', JSON.stringify(Array.from(next)))
        } catch {
          // ignore
        }
        return next
      })

      toast({
        title: 'Notificações lidas',
        description: 'Todas as notificações foram marcadas como lidas.',
      })
    } catch (err) {
      console.error('[AppHeader] Falha ao marcar todas como lidas:', err)
      toast({
        title: 'Aviso',
        description: 'Algumas notificações foram lidas apenas localmente.',
      })
    } finally {
      setIsMarkingAll(false)
    }
  }

  const handleClearNotifications = async () => {
    if (isClearingAll) return
    setIsClearingAll(true)
    try {
      // 1. Marca todas como lidas
      await handleMarkAllAsRead()

      // 2. Zera/limpa todas as notificações do usuário atual
      const { clearNotifications: clearService } = await import('@/services/notifications')
      await clearService(currentUserId)
      setDbNotifications([])

      // 3. Marca todas como lidas no localStorage
      const allIds = derivedAlerts.map((n) => n.id)
      setLocalReadIds(new Set(allIds))
      try {
        localStorage.setItem('blink_read_notifs', JSON.stringify(allIds))
      } catch {
        // ignore
      }

      toast({
        title: 'Alertas zerados',
        description: 'Todas as notificações foram limpas e o contador foi zerado.',
      })
    } catch (err) {
      console.error('[AppHeader] Erro ao zerar notificações:', err)
      toast({
        title: 'Notificações zeradas',
        description: 'Contador de notificações zerado localmente com sucesso.',
      })
    } finally {
      setIsClearingAll(false)
    }
  }

  const handleNotificationClick = async (n: {
    id: string
    isDb: boolean
    context_link?: string
    context_type?: string
    context_id?: string
    title?: string
    message?: string
  }) => {
    // 1. Marca como lida imediatamente com persistência
    await handleMarkAsRead(n.id, n.isDb)

    // 2. Direciona para o local exato com highlight contextual
    if (n.context_link) {
      navigate(n.context_link)
      return
    }

    if (n.context_type === 'cliente' && n.context_id) {
      navigate(`/cadastro?highlight=${n.context_id}`)
      return
    }

    if (n.context_type === 'pedido' && n.context_id) {
      navigate(`/gestao-pedidos?highlight=${n.context_id}`)
      return
    }

    if (n.context_type === 'funil' && n.context_id) {
      navigate(`/funil?highlight=${n.context_id}`)
      return
    }

    // Heurística contextual inteligente para notificações do sistema sem link explícito
    if (
      n.id.startsWith('passed-') ||
      n.id.startsWith('approaching-') ||
      n.id.startsWith('stale-')
    ) {
      const clientId = n.id.replace(/^(passed|approaching|stale)-/, '')
      navigate(`/funil?cliente=${clientId}&highlight=${clientId}`)
      return
    }

    if (n.id.startsWith('task-')) {
      navigate('/atividades')
      return
    }

    if (
      n.title?.toLowerCase().includes('follow-up') ||
      n.message?.toLowerCase().includes('follow-up')
    ) {
      // Tenta achar cliente pelo nome no título ou mensagem
      const foundClient = factories.find(
        (f) =>
          (n.title && n.title.toLowerCase().includes(f.name.toLowerCase())) ||
          (n.message && n.message.toLowerCase().includes(f.name.toLowerCase())),
      )
      if (foundClient) {
        navigate(`/cadastro?highlight=${foundClient.id}`)
        return
      }
      navigate('/cadastro')
      return
    }

    if (
      n.title?.toLowerCase().includes('meta') ||
      n.title?.toLowerCase().includes('vendedor abaixo') ||
      n.message?.toLowerCase().includes('meta')
    ) {
      navigate('/metas')
      return
    }

    if (n.title?.toLowerCase().includes('pedido') || n.message?.toLowerCase().includes('pedido')) {
      navigate('/gestao-pedidos')
      return
    }

    // Padrão amigável: se não tiver alvo explícito, mantém na tela e confirma visualização
  }

  const derivedAlerts = useMemo(() => {
    const list: Array<{
      id: string
      type: 'destructive' | 'warning' | 'info' | 'success'
      icon: typeof AlertTriangle
      title: string
      message: string
      created?: string
      context_link?: string
      context_type?: string
      context_id?: string
    }> = []

    factories.forEach((f) => {
      if (isPassedDeadline(f.deadline)) {
        list.push({
          id: `passed-${f.id}`,
          type: 'destructive',
          icon: Calendar,
          title: 'Prazo expirado',
          message: `${f.name}: ${tr('notif.passed')}`,
          created: f.updated || f.created,
          context_type: 'funil',
          context_id: f.id,
          context_link: `/funil?cliente=${f.id}&highlight=${f.id}`,
        })
      } else if (isApproachingDeadline(f.deadline)) {
        list.push({
          id: `approaching-${f.id}`,
          type: 'warning',
          icon: Calendar,
          title: 'Prazo próximo do fim',
          message: `${f.name}: ${tr('notif.approaching')}`,
          created: f.updated || f.created,
          context_type: 'funil',
          context_id: f.id,
          context_link: `/funil?cliente=${f.id}&highlight=${f.id}`,
        })
      }
      if (isStale(f.lastInteraction)) {
        list.push({
          id: `stale-${f.id}`,
          type: 'warning',
          icon: AlertTriangle,
          title: 'Cliente sem interação',
          message: `${f.name}: ${tr('notif.stale')}`,
          created: f.lastInteraction || f.updated || f.created,
          context_type: 'cliente',
          context_id: f.id,
          context_link: `/cadastro?highlight=${f.id}`,
        })
      }
    })

    tasks.forEach((task) => {
      if (!task.completed && task.dueDate) {
        const isOverdue = isPassedDeadline(task.dueDate)
        const isApproaching = isApproachingDeadline(task.dueDate)
        const factory = factories.find((f) => f.id === task.factoryId)
        if (isOverdue) {
          list.push({
            id: `task-overdue-${task.id}`,
            type: 'destructive',
            icon: AlertTriangle,
            title: 'Tarefa em atraso',
            message: `${tr('notif.taskOverdue')} [${task.type}]: ${task.description} (${factory?.name || tr('common.factory')})`,
            created: task.dueDate || task.created,
            context_type: 'tarefa',
            context_id: task.id,
            context_link: '/atividades',
          })
        } else if (isApproaching) {
          list.push({
            id: `task-approaching-${task.id}`,
            type: 'warning',
            icon: Calendar,
            title: 'Tarefa vencendo',
            message: `${tr('notif.taskDue')} [${task.type}]: ${task.description} (${factory?.name || tr('common.factory')})`,
            created: task.dueDate || task.created,
            context_type: 'tarefa',
            context_id: task.id,
            context_link: '/atividades',
          })
        } else if (task.priority === 'Alta') {
          list.push({
            id: `task-high-${task.id}`,
            type: 'warning',
            icon: CheckCircle2,
            title: 'Tarefa de alta prioridade',
            message: `${tr('notif.highPri')}: ${task.description} (${factory?.name || tr('common.factory')})`,
            created: task.created,
            context_type: 'tarefa',
            context_id: task.id,
            context_link: '/atividades',
          })
        }
      } else if (!task.completed && !task.dueDate && task.priority === 'Alta') {
        const factory = factories.find((f) => f.id === task.factoryId)
        list.push({
          id: `task-high-${task.id}`,
          type: 'warning',
          icon: CheckCircle2,
          title: 'Tarefa prioritária',
          message: `${tr('notif.highPri')}: ${task.description} (${factory?.name || tr('common.factory')})`,
          created: task.created,
          context_type: 'tarefa',
          context_id: task.id,
          context_link: '/atividades',
        })
      }
    })

    return list
  }, [factories, tasks, tr])

  // Lista consolidada de itens para o painel de notificações/alertas
  const consolidatedNotifications = useMemo(() => {
    const items = [
      ...dbNotifications.map((n) => {
        const isRead = Boolean(n.isRead || localReadIds.has(n.id))
        return {
          id: n.id,
          isDb: true,
          isRead,
          type: (n.type === 'success'
            ? 'success'
            : n.type === 'warning'
              ? 'warning'
              : n.type === 'error'
                ? 'destructive'
                : 'info') as 'success' | 'warning' | 'destructive' | 'info',
          icon:
            n.type === 'success'
              ? CheckCircle2
              : n.type === 'warning'
                ? AlertTriangle
                : n.type === 'error'
                  ? AlertCircle
                  : MessageSquare,
          title: n.title || 'Notificação',
          message: n.message,
          created: n.created,
          context_link: n.context_link,
          context_type: n.context_type,
          context_id: n.context_id,
        }
      }),
      ...derivedAlerts.map((n) => {
        const isRead = localReadIds.has(n.id)
        return {
          ...n,
          isDb: false,
          isRead,
        }
      }),
    ]

    // Ordenação: não lidas primeiro, depois por created mais recente
    return items.sort((a, b) => {
      if (a.isRead !== b.isRead) {
        return a.isRead ? 1 : -1
      }
      const timeA = a.created ? new Date(a.created).getTime() : 0
      const timeB = b.created ? new Date(b.created).getTime() : 0
      return timeB - timeA
    })
  }, [dbNotifications, derivedAlerts, localReadIds])

  // Notificações ativas não lidas determinam o badge do sininho
  const unreadNotifs = useMemo(
    () => consolidatedNotifications.filter((n) => !n.isRead),
    [consolidatedNotifications],
  )
  const notifCount = unreadNotifs.length

  // Lista visual a renderizar com base na aba de filtro selecionada
  const displayedNotifications = useMemo(() => {
    if (filterTab === 'unread') {
      return unreadNotifs
    }
    return consolidatedNotifications
  }, [filterTab, unreadNotifs, consolidatedNotifications])

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

        {/* Sininho de Notificações / Painel de Alertas */}
        <Popover>
          <PopoverTrigger asChild>
            <div
              className="relative flex items-center justify-center w-11 h-11 md:w-10 md:h-10 rounded-full hover:bg-muted transition-colors cursor-pointer group"
              title="Alertas e Notificações"
              role="button"
              aria-label="Abrir painel de notificações e alertas"
            >
              <Bell className="w-6 h-6 md:w-5 md:h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              {notifCount > 0 && (
                <span className="absolute top-1 right-1 bg-destructive text-white text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center border-2 border-card shadow-sm animate-pulse">
                  {notifCount > 99 ? '99+' : notifCount}
                </span>
              )}
            </div>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[360px] sm:w-[420px] p-0 shadow-xl border-border/80"
          >
            {/* Header do painel */}
            <div className="p-4 border-b border-border/60 bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                      Alertas e Notificações
                      {notifCount > 0 ? (
                        <Badge variant="destructive" className="text-[10px] h-4.5 px-1.5 font-mono">
                          {notifCount} nova{notifCount > 1 ? 's' : ''}
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-[10px] h-4.5 px-1.5 font-normal text-muted-foreground"
                        >
                          Em dia
                        </Badge>
                      )}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Clique no alerta para ir ao registro correspondente
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {notifCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleMarkAllAsRead}
                      disabled={isMarkingAll}
                      className="h-7 text-xs text-primary hover:text-primary/90 px-2 font-normal gap-1"
                      title="Marcar todas as notificações como lidas"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Marcar lidas</span>
                    </Button>
                  )}
                  {consolidatedNotifications.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearNotifications}
                      disabled={isClearingAll}
                      className="h-7 text-xs text-muted-foreground hover:text-destructive px-2 font-normal gap-1"
                      title="Zerar e limpar todas as notificações"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Zerar</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Abas de filtro: Todas vs Não lidas */}
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                    filterTab === 'all'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  Todas ({consolidatedNotifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('unread')}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                    filterTab === 'unread'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <span>Não lidas</span>
                  {notifCount > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        filterTab === 'unread'
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-muted-foreground/20 text-foreground'
                      }`}
                    >
                      {notifCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Conteúdo: Loading Skeleton, Erro, Vazio ou Lista */}
            <div className="max-h-[380px] overflow-y-auto custom-scrollbar divide-y divide-border/40 p-2 space-y-1">
              {notifLoading ? (
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-5/6" />
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  </div>
                </div>
              ) : notifError ? (
                <div className="p-6 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{notifError}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Houve uma falha ao sincronizar as notificações.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void loadNotifications()}
                    className="gap-1.5 h-8 text-xs mx-auto"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Tentar novamente
                  </Button>
                </div>
              ) : displayedNotifications.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-muted/60 text-muted-foreground mx-auto flex items-center justify-center">
                    {filterTab === 'unread' ? (
                      <CheckCheck className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <Bell className="w-6 h-6 text-muted-foreground/50" />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {filterTab === 'unread'
                      ? 'Nenhuma notificação não lida'
                      : 'Nenhuma notificação'}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-[260px] mx-auto">
                    {filterTab === 'unread'
                      ? 'Todos os alertas e notificações já foram visualizados.'
                      : 'Você está em dia com todas as novidades e prazos do sistema.'}
                  </p>
                </div>
              ) : (
                displayedNotifications.map((n) => {
                  const Icon = n.icon
                  return (
                    <div
                      key={n.id}
                      onClick={() => void handleNotificationClick(n)}
                      className={`p-3 rounded-lg text-sm transition-all flex items-start gap-3 relative group cursor-pointer border ${
                        !n.isRead
                          ? 'bg-primary/5 hover:bg-primary/10 border-primary/20 shadow-xs'
                          : 'bg-card/40 hover:bg-muted/60 border-transparent opacity-85 hover:opacity-100'
                      }`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          void handleNotificationClick(n)
                        }
                      }}
                      title="Clique para ir ao registro correspondente e marcar como lida"
                    >
                      <div
                        className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center mt-0.5 ${
                          n.type === 'destructive'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            : n.type === 'warning'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : n.type === 'success'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-primary/10 text-primary'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <strong className="text-xs font-semibold text-foreground truncate max-w-[220px]">
                            {n.title}
                          </strong>
                          {!n.isRead ? (
                            <span
                              className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse"
                              title="Não lida"
                            />
                          ) : (
                            <span
                              className="inline-flex items-center text-[11px] text-emerald-600 dark:text-emerald-400 font-medium gap-0.5"
                              title="Lida"
                            >
                              <Check className="w-3 h-3 stroke-[2.5]" />
                              <span className="text-[10px]">Lida</span>
                            </span>
                          )}
                          {n.created && (
                            <span className="text-[10px] text-muted-foreground ml-auto font-mono">
                              {formatRelativeTimeBR(n.created)}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>

                        <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-border/30 text-[11px] text-primary">
                          <span className="inline-flex items-center gap-1 font-medium group-hover:underline">
                            Ir para o item <ExternalLink className="w-3 h-3 opacity-70" />
                          </span>
                        </div>
                      </div>

                      {/* Botão de check individual */}
                      {!n.isRead && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleMarkAsRead(n.id, n.isDb)
                          }}
                          title="Marcar como lida"
                        >
                          <Check className="h-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Rodapé do painel */}
            <div className="p-3 border-t border-border/60 bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1 text-[11px]">
                <Sparkles className="w-3 h-3 text-primary" />
                Tempo real ativo
              </span>
              <Button
                variant="link"
                size="sm"
                onClick={() => navigate('/mensagens')}
                className="h-auto p-0 text-xs text-primary font-medium hover:underline"
              >
                Abrir Mensagens da Equipe →
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
