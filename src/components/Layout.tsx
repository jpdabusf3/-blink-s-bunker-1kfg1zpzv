import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { AppHeader } from './AppHeader'
import { AppBottomNav } from './AppBottomNav'
import { GeofenceTracker } from './GeofenceTracker'
import { Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <SidebarProvider>
      <GeofenceTracker />
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 relative pb-24 md:pb-8 bg-background">
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
