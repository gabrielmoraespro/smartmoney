import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/button'
import { Toaster } from '../../components/ui/sonner'
import { usePlanGuard } from '../../hooks/usePlanGuard'
import { LayoutDashboard, ArrowLeftRight, Landmark, CreditCard, LogOut, Settings, Tag, RefreshCw } from 'lucide-react'

const navItems = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/transacoes', label: 'Transacoes', icon: ArrowLeftRight },
  { to: '/app/categorias', label: 'Categorias', icon: Tag },
  { to: '/app/assinaturas', label: 'Assinaturas', icon: RefreshCw },
  { to: '/app/cartoes', label: 'Cartoes', icon: CreditCard },
  { to: '/app/conectar-banco', label: 'Conectar Banco', icon: Landmark },
  { to: '/app/plano', label: 'Meu Plano', icon: CreditCard },
  { to: '/app/configuracoes', label: 'Configuracoes', icon: Settings },
]

export default function AppLayout({ session }: { session: Session }) {
  const navigate = useNavigate()
  const { isPro } = usePlanGuard()
  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/') }
  const userName = session.user.user_metadata?.full_name ?? session.user.email?.split('@')[0] ?? 'Usuario'
  const initials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="flex h-screen bg-background">
      <aside style={{ width: 240, borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', padding: '20px 12px', gap: 4, background: '#080d14' }}>
        <div style={{ padding: '0 8px 20px', borderBottom: '1px solid #1e293b', marginBottom: 8 }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: '#10b981', letterSpacing: -0.5 }}>SmartMoney</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #10b981, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</p>
              {isPro && <span style={{ fontSize: 10, fontWeight: 700, background: 'linear-gradient(90deg,#10b981,#3b82f6)', color: '#fff', borderRadius: 4, padding: '1px 6px' }}>PRO</span>}
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all font-medium ${isActive ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <Button variant="ghost" className="justify-start gap-3 text-slate-500 hover:text-slate-300 rounded-xl" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </aside>
      <main className="flex-1 overflow-auto p-8"><Outlet /></main>
      <Toaster richColors position="top-right" />
    </div>
  )
}
