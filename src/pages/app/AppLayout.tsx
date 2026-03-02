import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/button'
import { usePlanGuard } from '../../hooks/usePlanGuard'
import {
  LayoutDashboard, ArrowLeftRight, Landmark, CreditCard, LogOut, Lock
} from 'lucide-react'

const navItems = [
  { to: '/app/dashboard',      label: 'Dashboard',      icon: LayoutDashboard, proOnly: false },
  { to: '/app/transacoes',     label: 'Transações',     icon: ArrowLeftRight,  proOnly: false },
  { to: '/app/conectar-banco', label: 'Conectar Banco', icon: Landmark,        proOnly: true  },
  { to: '/app/plano',          label: 'Meu Plano',      icon: CreditCard,      proOnly: false },
]

export default function AppLayout({ session }: { session: Session }) {
  const navigate = useNavigate()
  const { isPro } = usePlanGuard()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const userName = session.user.user_metadata?.full_name
    ?? session.user.email?.split('@')[0]
    ?? 'Usuário'

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r flex flex-col p-4 gap-2">
        <div className="mb-6 px-2">
          <h1 className="text-xl font-bold text-primary">💰 SmartMoney</h1>
          <p className="text-xs text-muted-foreground mt-1 truncate">{userName}</p>
          {isPro && (
            <span className="text-xs bg-primary text-primary-foreground rounded px-2 py-0.5 mt-1 inline-block">
              PRO
            </span>
          )}
        </div>

        <nav className="flex-1 flex flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon, proOnly }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
                ${isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              {proOnly && !isPro && <Lock className="h-3 w-3 ml-auto opacity-50" />}
            </NavLink>
          ))}
        </nav>

        <Button variant="ghost" className="justify-start gap-3 text-muted-foreground"
          onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
