import { useEffect, useRef } from 'react'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { AppHeader } from './AppHeader'
import { AppBottomNav } from './AppBottomNav'
import { GeofenceTracker } from './GeofenceTracker'
import { Outlet } from 'react-router-dom'
import { useMonitorActive } from './dashboard/MonitorMode'

export default function Layout() {
  // Modo Monitor do Painel: esconde o chrome (menu lateral, barra superior e
  // barra inferior mobile) sem refatorar o layout — só não renderiza o chrome
  // enquanto o modo está ativo. O conteúdo continua sendo a própria página.
  const monitorActive = useMonitorActive()
  const mainRef = useRef<HTMLElement | null>(null)
  const savedScrollRef = useRef(0)

  // Guarda a posição de rolagem ao ENTRAR no modo monitor e devolve ao SAIR,
  // para que o Painel volte exatamente onde o usuário estava.
  useEffect(() => {
    if (monitorActive) {
      savedScrollRef.current = mainRef.current?.scrollTop ?? 0
    } else {
      requestAnimationFrame(() => {
        if (mainRef.current) mainRef.current.scrollTop = savedScrollRef.current
      })
    }
  }, [monitorActive])

  if (monitorActive) {
    return (
      <SidebarProvider>
        <GeofenceTracker />
        <div className="flex h-screen w-full overflow-hidden bg-background">
          <div className="flex-1 flex flex-col min-w-0">
            <main
              ref={mainRef}
              className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 relative bg-background"
            >
              <div className="mx-auto w-full max-w-[1280px] animate-fade-in">
                <Outlet />
              </div>
              {/* main ref também aqui: mesmo nó lógico nos dois modos */}
            </main>
          </div>
        </div>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <GeofenceTracker />
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main
            ref={mainRef}
            className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 relative pb-24 md:pb-8 bg-background"
          >
            {/* ref={mainRef} preserva a posição de rolagem ao sair do modo monitor */}
            <div className="mx-auto w-full max-w-[1280px] animate-fade-in">
              <Outlet />
            </div>
          </main>
        </div>
        <AppBottomNav />
      </div>
    </SidebarProvider>
  )
}
