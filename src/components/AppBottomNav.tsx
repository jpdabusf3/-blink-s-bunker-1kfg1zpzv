import { Home, Building2, BarChart2, Target, Grid } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function AppBottomNav() {
  const loc = useLocation()
  const menu = [
    { name: 'Início', path: '/', icon: Home },
    { name: 'Fábricas', path: '/cadastro', icon: Building2 },
    { name: 'Funil', path: '/funil', icon: BarChart2 },
    { name: 'SWOT', path: '/swot', icon: Target },
    { name: 'Prioridade', path: '/matriz', icon: Grid },
  ]

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-[68px] bg-card border-t shadow-[0_-4px_20px_rgba(0,0,0,0.05)] flex items-center justify-around px-1 z-50 pb-[env(safe-area-inset-bottom)]">
      {menu.map((m) => {
        const isActive = loc.pathname === m.path
        return (
          <Link
            key={m.path}
            to={m.path}
            className={cn(
              'flex flex-col items-center justify-center w-full h-full gap-1 transition-colors relative',
              isActive ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {isActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-md" />
            )}
            <m.icon className={cn('w-[22px] h-[22px]', isActive && 'text-primary')} />
            <span className="text-[10px] leading-none">{m.name}</span>
          </Link>
        )
      })}
    </div>
  )
}
