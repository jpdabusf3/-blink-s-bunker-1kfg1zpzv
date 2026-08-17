import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import {
  Home,
  Building2,
  BarChart2,
  Target,
  Grid,
  LogOut,
  ShoppingCart,
  ScrollText,
  Users,
  FileText,
  UserPlus,
  UserCog,
  ClipboardList,
  TrendingUp,
  Award,
  Layers,
  Upload,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/hooks/use-i18n'
import { isMasterOrCeo, isManager } from '@/lib/user-scope'

export function AppSidebar() {
  const loc = useLocation()
  const { signOut, user } = useAuth()
  const { t } = useI18n()
  const showMasterOrCeo = isMasterOrCeo(user)
  const showManager = isManager(user)
  const menu = [
    { name: t('nav.dashboard'), path: '/', icon: Home },
    { name: t('nav.cadastro'), path: '/cadastro', icon: Building2 },
    { name: 'Importar Clientes', path: '/importar-clientes', icon: Upload },
    { name: t('nav.funil'), path: '/funil', icon: BarChart2 },
    { name: 'Funil de Vendas', path: '/funil-vendas', icon: Layers },
    ...(showManager ? [{ name: 'Gestão Técnica', path: '/gestao-tecnica', icon: UserCog }] : []),
    { name: 'Implantação de Novos Pedidos', path: '/pedidos', icon: ShoppingCart },
    { name: 'Histórico de Vendas', path: '/historico-vendas', icon: TrendingUp },
    { name: t('nav.swot'), path: '/swot', icon: Target },
    { name: t('nav.prioridade'), path: '/matriz', icon: Grid },
    { name: t('nav.metas'), path: '/metas', icon: Target },
    { name: t('nav.relatorios'), path: '/relatorios', icon: BarChart2 },
    { name: 'Rel. Atividades', path: '/relatorio-atividades', icon: ClipboardList },
    { name: 'Rel. Performance', path: '/relatorio-performance', icon: Award },
    { name: t('nav.usuarios'), path: '/usuarios', icon: Users },
    ...(showMasterOrCeo ? [{ name: 'Equipe', path: '/equipe', icon: UserPlus }] : []),
    ...(showMasterOrCeo ? [{ name: 'Documentos', path: '/documentos', icon: FileText }] : []),
    ...(showMasterOrCeo
      ? [{ name: t('nav.auditoria'), path: '/admin/logs', icon: ScrollText }]
      : []),
  ]

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border bg-card text-card-foreground print:hidden lg:w-[240px]"
    >
      <SidebarHeader className="p-4 border-b border-border flex items-center justify-center">
        <div className="flex items-center gap-3 overflow-hidden px-1">
          <div className="bg-primary p-1.5 rounded-lg shrink-0">
            <Target className="w-5 h-5 text-primary-foreground" />
          </div>
          <h2 className="text-lg font-bold text-foreground truncate group-data-[collapsible=icon]:hidden">
            Blink Biotech
          </h2>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2 pt-4 flex-1">
        <SidebarMenu>
          {menu.map((m) => (
            <SidebarMenuItem key={m.path} className="mb-1">
              <SidebarMenuButton
                asChild
                isActive={loc.pathname === m.path}
                className="flex items-center gap-3 h-11 pl-4 pr-4 rounded-lg mb-1 text-sm font-medium text-muted-foreground transition-all duration-150 ease-out hover:bg-muted hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-semibold"
                tooltip={m.name}
              >
                <Link to={m.path}>
                  <m.icon className="w-5 h-5 shrink-0" />
                  <span className="group-data-[collapsible=icon]:hidden">{m.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <div className="p-2 border-t border-border mt-auto">
        <SidebarMenu>
          <SidebarMenuItem className="mb-1">
            <SidebarMenuButton
              onClick={signOut}
              tooltip={t('nav.sair')}
              className="flex items-center gap-3 h-11 pl-4 pr-4 rounded-lg mb-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden font-medium">
                {t('nav.sair')}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>
    </Sidebar>
  )
}
