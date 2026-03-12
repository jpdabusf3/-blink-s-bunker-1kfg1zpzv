import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { AppHeader } from './AppHeader'
import { Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 relative">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
