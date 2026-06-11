import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { Home, Building2, BarChart2, Target, Grid, LogOut, ShoppingCart } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'

export function AppSidebar() {
  const loc = useLocation()
  const { signOut } = useAuth()
  const menu = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Cadastro', path: '/cadastro', icon: Building2 },
    { name: 'Funil', path: '/funil', icon: BarChart2 },
    { name: 'Histórico de Pedidos', path: '/pedidos', icon: ShoppingCart },
    { name: 'Matriz SWOT', path: '/swot', icon: Target },
    { name: 'Prioridade', path: '/matriz', icon: Grid },
    { name: 'Metas', path: '/metas', icon: Target },
    { name: 'Relatórios', path: '/relatorios', icon: BarChart2 },
  ]

  return (
    <Sidebar collapsible="icon" className="border-r border-border shadow-sm print:hidden">
      <SidebarHeader className="p-4 border-b flex items-center justify-center">
        <div className="flex items-center gap-2 overflow-hidden px-1">
          <div className="bg-primary p-1.5 rounded-lg shrink-0">
            <Target className="w-5 h-5 text-primary-foreground" />
          </div>
          <h2 className="text-lg font-bold text-foreground truncate group-data-[collapsible=icon]:hidden">
            Blink Biotech
          </h2>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2 pt-4 flex-1">
        <SidebarMenu className="gap-2">
          {menu.map((m) => (
            <SidebarMenuItem key={m.path}>
              <SidebarMenuButton
                asChild
                isActive={loc.pathname === m.path}
                className="h-10 px-3 data-[active=true]:bg-primary/10 data-[active=true]:text-primary font-medium transition-all"
                tooltip={m.name}
              >
                <Link to={m.path}>
                  <m.icon className="w-5 h-5" />
                  <span className="group-data-[collapsible=icon]:hidden">{m.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <div className="p-2 border-t mt-auto">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              tooltip="Sair"
              className="h-10 px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="group-data-[collapsible=icon]:hidden font-medium">
                Sair da Conta
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>
    </Sidebar>
  )
}
