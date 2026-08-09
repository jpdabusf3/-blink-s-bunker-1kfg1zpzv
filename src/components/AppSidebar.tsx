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
    { name: t('nav.funil'), path: '/funil', icon: BarChart2 },
    { name: 'Funil de Vendas', path: '/funil-vendas', icon: Layers },
    ...(showManager ? [{ name: 'Gestão Técnica', path: '/gestao-tecnica', icon: UserCog }] : []),
    { name: t('nav.pedidos'), path: '/pedidos', icon: ShoppingCart },
    { name: 'Histórico de Vendas', path: '/historico-vendas', icon: TrendingUp },
    { name: t('nav.swot'), path: '/swot', icon: Target },
    { name: t('nav.prioridade'), path: '/matriz', icon: Grid },
    { name: t('nav.metas'), path: '/metas', icon: Target },
    { name: t('nav.relatorios'), path: '/relatorios', icon: BarChart2 },
    { name: 'Rel. Atividades', path: '/relatorio-atividades', icon: ClipboardList },
    { name: 'Rel. Performance', path: '/relatorio-performance', icon: Award },
    ...(showMasterOrCeo ? [{ name: 'Equipe', path: '/equipe', icon: UserPlus }] : []),
    ...(showMasterOrCeo ? [{ name: 'Documentos', path: '/documentos', icon: FileText }] : []),
    ...(showMasterOrCeo
      ? [{ name: t('nav.auditoria'), path: '/admin/logs', icon: ScrollText }]
      : []),
    ...(showMasterOrCeo ? [{ name: t('nav.usuarios'), path: '/usuarios', icon: Users }] : []),
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
              tooltip={t('nav.sair')}
              className="h-10 px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
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
