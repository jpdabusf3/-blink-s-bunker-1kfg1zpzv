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
  ClipboardList,
  TrendingUp,
  Award,
  Layers,
  Upload,
  Settings2,
  Package,
  MapPin,
  Sparkles,
  Calendar,
  Database,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/hooks/use-i18n'
import { isMasterOrCeo, isManager } from '@/lib/user-scope'
import { cn } from '@/lib/utils'
import logoBlink from '@/assets/logo-blink-6759b.png'

export function AppSidebar() {
  const loc = useLocation()
  const { signOut, user } = useAuth()
  const { t } = useI18n()
  const showMasterOrCeo = isMasterOrCeo(user)
  const menu = [
    { name: t('nav.dashboard'), path: '/', icon: Home },
    { name: 'Maestro', path: '/maestro', icon: Sparkles, badge: 'IA' },
    { name: t('nav.cadastro'), path: '/cadastro', icon: Building2 },
    { name: 'Mapa de Clientes', path: '/mapa', icon: MapPin },
    { name: 'Importar Faturamento', path: '/importar-faturamento', icon: Layers },
    { name: t('nav.funil'), path: '/funil', icon: BarChart2 },
    { name: 'Funil de Vendas', path: '/funil-vendas', icon: Layers },
    { name: 'Implantação de Novos Pedidos', path: '/pedidos', icon: ShoppingCart, badge: 'NF' },
    { name: 'Pedidos', path: '/gestao-pedidos', icon: ShoppingCart },
    { name: 'Produtos', path: '/produtos', icon: Package },
    { name: 'Resumo', path: '/resumo', icon: BarChart2 },
    { name: 'Histórico', path: '/historico', icon: TrendingUp },
    { name: 'Histórico de Vendas', path: '/historico-vendas', icon: TrendingUp },
    { name: t('nav.swot'), path: '/swot', icon: Target },
    { name: t('nav.prioridade'), path: '/matriz', icon: Grid },
    { name: 'Agenda', path: '/agenda', icon: Calendar },
    { name: 'Relatório de Vendas', path: '/relatorio-vendas', icon: FileText },
    { name: t('nav.metas'), path: '/metas', icon: Target },
    { name: t('nav.relatorios'), path: '/relatorios', icon: BarChart2 },
    { name: 'Relatórios Automáticos', path: '/relatorios-automaticos', icon: FileText },
    { name: 'Rel. Atividades', path: '/relatorio-atividades', icon: ClipboardList },
    { name: 'Rel. Performance', path: '/relatorio-performance', icon: Award },
    { name: t('nav.usuarios'), path: '/usuarios', icon: Users },
    { name: 'Migração de Dados', path: '/migracao', icon: Database },
    ...(showMasterOrCeo ? [{ name: 'Equipe', path: '/equipe', icon: UserPlus }] : []),
    ...(showMasterOrCeo ? [{ name: 'Documentos', path: '/documentos', icon: FileText }] : []),
    ...(showMasterOrCeo
      ? [{ name: t('nav.auditoria'), path: '/admin/logs', icon: ScrollText }]
      : []),
    { name: 'Histórico Funil', path: '/historico-funil', icon: ClipboardList },
  ]

  return (
    <Sidebar
      collapsible="icon"
      className="relative bg-[hsl(var(--sidebar-background))] text-sidebar-foreground print:hidden lg:w-[240px]"
    >
      {/* Subtle right gradient border from primary/20 to transparent */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-primary/20 via-border/30 to-transparent z-20"
        aria-hidden="true"
      />

      <SidebarHeader className="p-4 border-b border-border/30 flex items-center justify-center">
        <div className="flex items-center gap-3 overflow-hidden px-1">
          <img
            src={logoBlink}
            alt="Blink Biotech Logo"
            className="h-8 w-auto shrink-0 object-contain"
          />
          <h2 className="text-lg font-bold truncate group-data-[collapsible=icon]:hidden">
            <span className="text-gradient-brand">Blink</span>{' '}
            <span className="text-foreground">Biotech</span>
          </h2>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2 pt-4 flex-1">
        <SidebarMenu>
          {menu.map((m) => {
            const isActive = loc.pathname === m.path
            return (
              <SidebarMenuItem key={m.path} className="mb-1">
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className={cn(
                    'relative flex items-center gap-3 h-11 pl-4 pr-4 rounded-lg mb-1 text-sm font-medium transition-all duration-150 ease-out',
                    'hover:bg-[hsl(var(--sidebar-accent))] hover:text-foreground hover:translate-x-[2px]',
                    isActive
                      ? 'bg-primary/12 text-primary font-semibold shadow-sm'
                      : 'text-muted-foreground',
                  )}
                  tooltip={m.name}
                >
                  <Link to={m.path} className="flex items-center justify-between w-full">
                    {/* Active left accent bar */}
                    {isActive && (
                      <span
                        className="absolute left-1 top-2 bottom-2 w-[3px] rounded-full bg-primary"
                        aria-hidden="true"
                      />
                    )}
                    <div className="flex items-center gap-3">
                      <m.icon
                        className={cn(
                          'w-5 h-5 shrink-0 transition-transform duration-150',
                          isActive
                            ? 'text-primary'
                            : 'text-muted-foreground group-hover:text-foreground',
                        )}
                      />
                      <span className="group-data-[collapsible=icon]:hidden">{m.name}</span>
                    </div>
                    {(m as any).badge && (
                      <span className="group-data-[collapsible=icon]:hidden text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground shadow-sm">
                        {(m as any).badge}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>
      <div className="p-2 border-t border-border/30 mt-auto">
        <SidebarMenu>
          <SidebarMenuItem className="mb-1">
            <SidebarMenuButton
              onClick={signOut}
              tooltip={t('nav.sair')}
              className="flex items-center gap-3 h-11 pl-4 pr-4 rounded-lg mb-1 text-sm font-medium text-muted-foreground transition-all duration-150 ease-out hover:bg-destructive/10 hover:text-destructive hover:translate-x-[2px]"
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
