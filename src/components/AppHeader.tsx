import { Bell, Plus, AlertTriangle } from 'lucide-react'
import { Button } from './ui/button'
import { useAppContext } from '@/store/AppContext'
import { isStale } from '@/lib/utils'
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

export function AppHeader() {
  const { factories } = useAppContext()
  const staleCount = factories.filter((f) => isStale(f.lastInteraction)).length
  const [open, setOpen] = useState(false)

  return (
    <header className="h-16 border-b flex items-center justify-between px-4 lg:px-6 bg-card text-card-foreground shrink-0 shadow-sm z-10 sticky top-0">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="md:hidden" />
        <h1 className="font-semibold text-lg lg:text-xl text-primary hidden sm:block">
          Painel Executivo
        </h1>
      </div>

      <div className="flex items-center gap-4 lg:gap-6">
        <div
          className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-muted transition-colors cursor-pointer group"
          title={`${staleCount} contas sem interação recente`}
        >
          <Bell className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          {staleCount > 0 && (
            <span className="absolute top-1 right-1 bg-destructive text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-card">
              {staleCount}
            </span>
          )}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 shadow-sm">
              <Plus className="w-4 h-4" />
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
