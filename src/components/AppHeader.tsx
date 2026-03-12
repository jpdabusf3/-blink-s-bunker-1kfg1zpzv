import { Bell, Plus, AlertTriangle, Calendar, WifiOff, CheckCircle2, Moon, Sun } from 'lucide-react'
import { Button } from './ui/button'
import { useAppContext } from '@/store/AppContext'
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
import { useState } from 'react'
import { SidebarTrigger } from './ui/sidebar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { useTheme } from 'next-themes'

export function AppHeader() {
  const { factories, tasks, isOnline } = useAppContext()
  const [open, setOpen] = useState(false)
  const { theme, setTheme } = useTheme()

  const notifications = factories.flatMap((f) => {
    const notifs = []
    if (isPassedDeadline(f.deadline)) {
      notifs.push({
        id: `passed-${f.id}`,
        type: 'destructive',
        icon: Calendar,
        message: `${f.name}: Prazo de negociação vencido!`,
      })
    } else if (isApproachingDeadline(f.deadline)) {
      notifs.push({
        id: `approaching-${f.id}`,
        type: 'warning',
        icon: Calendar,
        message: `${f.name}: Prazo de fechamento próximo.`,
      })
    }
    if (isStale(f.lastInteraction)) {
      notifs.push({
        id: `stale-${f.id}`,
        type: 'stale',
        icon: AlertTriangle,
        message: `${f.name}: Sem interação há mais de 15 dias.`,
      })
    }
    return notifs
  })

  tasks.forEach((t) => {
    if (!t.completed && t.dueDate) {
      const isOverdue = isPassedDeadline(t.dueDate)
      const isApproaching = isApproachingDeadline(t.dueDate)
      const factory = factories.find((f) => f.id === t.factoryId)

      if (isOverdue) {
        notifications.push({
          id: `task-overdue-${t.id}`,
          type: 'destructive',
          icon: CheckCircle2,
          message: `Atrasada [${t.type}]: ${t.description} (${factory?.name || 'Fábrica'})`,
        })
      } else if (isApproaching) {
        notifications.push({
          id: `task-approaching-${t.id}`,
          type: 'warning',
          icon: Calendar,
          message: `Vence em breve [${t.type}]: ${t.description} (${factory?.name || 'Fábrica'})`,
        })
      } else if (t.priority === 'Alta') {
        notifications.push({
          id: `task-high-${t.id}`,
          type: 'warning',
          icon: CheckCircle2,
          message: `Prioridade Alta: ${t.description} (${factory?.name || 'Fábrica'})`,
        })
      }
    } else if (!t.completed && !t.dueDate && t.priority === 'Alta') {
      const factory = factories.find((f) => f.id === t.factoryId)
      notifications.push({
        id: `task-high-${t.id}`,
        type: 'warning',
        icon: CheckCircle2,
        message: `Prioridade Alta: ${t.description} (${factory?.name || 'Fábrica'})`,
      })
    }
  })

  const notifCount = notifications.length

  return (
    <header className="h-16 border-b flex items-center justify-between px-4 lg:px-6 bg-card text-card-foreground shrink-0 shadow-sm z-10 sticky top-0 print:hidden">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="md:hidden" />
        <h1 className="font-semibold text-lg lg:text-xl text-primary hidden sm:block">
          Painel Executivo
        </h1>
        {!isOnline && (
          <div
            className="flex items-center gap-1.5 text-[11px] font-medium text-orange-600 bg-orange-500/10 px-2.5 py-1 rounded-md ml-2"
            title="Sincronização pendente. Algumas funcionalidades podem estar limitadas."
          >
            <WifiOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Offline (Modo Leitura)</span>
            <span className="sm:hidden">Offline</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 lg:gap-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title="Alternar Tema"
          className="w-10 h-10 rounded-full"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-muted-foreground" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-muted-foreground" />
          <span className="sr-only">Alternar Tema</span>
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <div
              className="relative flex items-center justify-center w-11 h-11 md:w-10 md:h-10 rounded-full hover:bg-muted transition-colors cursor-pointer group"
              title="Notificações"
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
              <Bell className="w-4 h-4" /> Notificações Recentes
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">Nenhuma pendência no momento.</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-3 border rounded-lg text-sm bg-muted/30 flex items-start gap-3"
                  >
                    <n.icon
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        n.type === 'destructive'
                          ? 'text-destructive'
                          : n.type === 'warning'
                            ? 'text-orange-500'
                            : 'text-primary'
                      }`}
                    />
                    <span className="leading-tight">{n.message}</span>
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
              <span className="hidden sm:inline">Nova Fábrica</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Cadastro Rápido</DialogTitle>
              <DialogDescription>Adicione uma nova fábrica ao pipeline.</DialogDescription>
            </DialogHeader>
            <FactoryForm onSubmit={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
    </header>
  )
}
