import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import AIChat from '../../components/AIChat'
import { Toaster } from '../../components/ui/sonner'
import { usePlanGuard } from '../../hooks/usePlanGuard'
import { useResponsive } from '../../hooks/useResponsive'
import {
  LayoutDashboard, ArrowLeftRight, Landmark, CreditCard,
  LogOut, Settings, Tag, RefreshCw, ChevronLeft, ChevronRight,
  HelpCircle, TrendingUp, Menu, X,
} from 'lucide-react'

const NAV = [
  { to: '/app/dashboard',      label: 'Dashboard',      icon: LayoutDashboard, badge: null },
  { to: '/app/transacoes',     label: 'Transações',     icon: ArrowLeftRight,  badge: null },
  { to: '/app/categorias',     label: 'Categorias',     icon: Tag,             badge: null },
  { to: '/app/assinaturas',    label: 'Assinaturas',    icon: RefreshCw,       badge: null },
  { to: '/app/cartoes',        label: 'Cartões',        icon: CreditCard,      badge: null },
  { to: '/app/conectar-banco', label: 'Conectar Banco', icon: Landmark,        badge: '!' },
  { to: '/app/plano',          label: 'Meu Plano',      icon: TrendingUp,      badge: null },
  { to: '/app/configuracoes',  label: 'Config.',        icon: Settings,        badge: null },
]

const BOTTOM_NAV = [NAV[0], NAV[1], NAV[2], NAV[4], NAV[7]]

export default function AppLayout({ session }: { session: Session }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isPro } = usePlanGuard()
  const { isMobile, isTablet } = useResponsive()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)

  const isNarrow = isMobile || isTablet

  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = drawerOpen && isNarrow ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen, isNarrow])

  const userName = session.user.user_metadata?.full_name
    ?? session.user.email?.split('@')[0] ?? 'Usuário'
  const initials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const SideNavItem = ({ to, label, icon: Icon, badge }: typeof NAV[0]) => {
    const isActive = location.pathname.startsWith(to)
    const isHov = hovered === to
    return (
      <div style={{ position: 'relative' }}>
        <NavLink to={to}
          onMouseEnter={() => setHovered(to)}
          onMouseLeave={() => setHovered(null)}
          style={{
            display: 'flex', alignItems: 'center',
            gap: collapsed ? 0 : 10,
            padding: collapsed ? '9px 0' : '9px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 10, marginBottom: 2, textDecoration: 'none', transition: 'all 0.15s',
            background: isActive
              ? 'linear-gradient(90deg,rgba(0,229,160,0.15) 0%,rgba(0,229,160,0.05) 100%)'
              : isHov ? 'rgba(255,255,255,0.04)' : 'transparent',
            position: 'relative',
          }}
        >
          {isActive && <div style={{ position:'absolute', left:0, top:'50%', transform:'translateY(-50%)', width:3, height:20, borderRadius:'0 3px 3px 0', background:'#00E5A0' }} />}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Icon size={17} style={{ color: isActive ? '#00E5A0' : '#4A5878', transition: 'color 0.15s' }} />
            {badge && !collapsed && <div style={{ position:'absolute', top:-4, right:-4, width:8, height:8, borderRadius:'50%', background:'#EF4444', border:'1.5px solid #070C18' }} />}
          </div>
          {!collapsed && (
            <span style={{ fontSize:13, fontWeight:isActive?600:400, color:isActive?'#E8EFF8':'#4A5878', transition:'color 0.15s', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {label}
            </span>
          )}
        </NavLink>
        {collapsed && isHov && (
          <div style={{ position:'absolute', left:52, top:'50%', transform:'translateY(-50%)', background:'#0D1526', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'6px 12px', fontSize:12, color:'#E8EFF8', whiteSpace:'nowrap', zIndex:200, pointerEvents:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.5)' }}>
            {label}
          </div>
        )}
      </div>
    )
  }

  const SidebarContent = ({ inDrawer = false }: { inDrawer?: boolean }) => {
    const showText = inDrawer || !collapsed
    return (
      <>
        <div style={{ display:'flex', alignItems:'center', justifyContent:showText?'space-between':'center', padding:showText?'0 4px 16px':'0 0 16px', marginBottom:8, borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#00E5A0,#0088FF)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <TrendingUp size={14} style={{ color:'#fff' }} />
            </div>
            {showText && <span style={{ fontSize:15, fontWeight:700, color:'#E8EFF8', letterSpacing:-0.3 }}>Smart<span style={{ color:'#00E5A0' }}>Money</span></span>}
          </div>
          {inDrawer && <button onClick={() => setDrawerOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#4A5878', padding:4 }}><X size={20} /></button>}
        </div>

        <nav style={{ flex:1, display:'flex', flexDirection:'column', overflowY:'auto' }}>
          {NAV.map(item => <SideNavItem key={item.to} {...item} />)}
        </nav>

        <div style={{ height:1, background:'rgba(255,255,255,0.05)', margin:'12px 0' }} />

        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
          {showText && (
            <a href="mailto:suporte@smartmoney.app"
              style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:10, textDecoration:'none', color:'#4A5878', fontSize:13, transition:'background 0.15s' }}
              onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.04)')}
              onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
            >
              <HelpCircle size={16} /> Suporte
            </a>
          )}
          <button onClick={handleLogout}
            style={{ display:'flex', alignItems:'center', gap:showText?10:0, justifyContent:showText?'flex-start':'center', padding:showText?'8px 12px':'8px 0', borderRadius:10, background:'transparent', border:'none', color:'#4A5878', fontSize:13, cursor:'pointer', width:'100%', transition:'all 0.15s' }}
            onMouseEnter={e=>{ e.currentTarget.style.background='rgba(239,68,68,0.08)'; e.currentTarget.style.color='#EF4444' }}
            onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#4A5878' }}
          >
            <LogOut size={16} style={{ flexShrink:0 }} />
            {showText && 'Sair'}
          </button>
        </div>

        <div style={{ height:1, background:'rgba(255,255,255,0.05)', margin:'12px 0' }} />
        <div style={{ display:'flex', alignItems:'center', gap:showText?10:0, justifyContent:showText?'flex-start':'center', padding:showText?'4px 4px':'4px 0' }}>
          <div style={{ width:34, height:34, borderRadius:10, flexShrink:0, background:'linear-gradient(135deg,#00E5A0 0%,#0088FF 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff' }}>{initials}</div>
          {showText && (
            <div style={{ minWidth:0, flex:1 }}>
              <p style={{ fontSize:12, fontWeight:600, color:'#C8D8E8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{userName}</p>
              {isPro
                ? <span style={{ fontSize:9, fontWeight:800, background:'linear-gradient(90deg,#00E5A0,#0088FF)', color:'#fff', borderRadius:4, padding:'1px 6px' }}>PRO</span>
                : <span style={{ fontSize:10, color:'#4A5878' }}>Free</span>
              }
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <div style={{ display:'flex', height:'100vh', background:'#06080F', overflow:'hidden' }}>

      {/* Desktop Sidebar */}
      {!isNarrow && (
        <aside style={{
          width: collapsed ? 64 : 240, minWidth: collapsed ? 64 : 240,
          height: '100vh',
          background: 'linear-gradient(180deg,#070C18 0%,#080E1C 100%)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column',
          padding: collapsed ? '16px 8px' : '16px 10px',
          transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden', position: 'relative', zIndex: 50,
        }}>
          <SidebarContent />
          <button onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expandir (Ctrl+B)' : 'Recolher (Ctrl+B)'}
            style={{ position:'absolute', right:-12, top:'50%', transform:'translateY(-50%)', width:24, height:24, borderRadius:'50%', background:'#0D1526', border:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#4A5878', zIndex:51, transition:'all 0.15s' }}
            onMouseEnter={e=>{ e.currentTarget.style.background='#162035'; e.currentTarget.style.color='#00E5A0' }}
            onMouseLeave={e=>{ e.currentTarget.style.background='#0D1526'; e.currentTarget.style.color='#4A5878' }}
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </aside>
      )}

      {/* Mobile Top Bar */}
      {isNarrow && (
        <header style={{ position:'fixed', top:0, left:0, right:0, zIndex:100, height:56, background:'#070C18', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', paddingTop:'env(safe-area-inset-top)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:26, height:26, borderRadius:7, background:'linear-gradient(135deg,#00E5A0,#0088FF)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <TrendingUp size={13} style={{ color:'#fff' }} />
            </div>
            <span style={{ fontSize:15, fontWeight:700, color:'#E8EFF8' }}>Smart<span style={{ color:'#00E5A0' }}>Money</span></span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {isPro && <span style={{ fontSize:9, fontWeight:800, background:'linear-gradient(90deg,#00E5A0,#0088FF)', color:'#fff', borderRadius:4, padding:'2px 7px' }}>PRO</span>}
            <button onClick={() => setDrawerOpen(true)} style={{ width:36, height:36, borderRadius:9, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#8899B4' }}>
              <Menu size={18} />
            </button>
          </div>
        </header>
      )}

      {/* Mobile Drawer */}
      {isNarrow && drawerOpen && (
        <>
          <div onClick={() => setDrawerOpen(false)} style={{ position:'fixed', inset:0, zIndex:150, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', animation:'fadeIn 0.2s ease' }} />
          <div style={{ position:'fixed', top:0, left:0, bottom:0, zIndex:151, width:280, background:'linear-gradient(180deg,#070C18 0%,#080E1C 100%)', borderRight:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', padding:'20px 12px', animation:'slideInLeft 0.25s cubic-bezier(0.4,0,0.2,1)', overflowY:'auto' }}>
            <SidebarContent inDrawer />
          </div>
        </>
      )}

      {/* Main Content */}
      <main style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        background: '#06080F',
        padding: isNarrow ? '72px 16px 84px' : '28px 32px',
      }}>
        <Outlet />
      </main>

      {/* Mobile Bottom Nav */}
      {isNarrow && (
        <nav style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:100, background:'#070C18', borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'stretch', paddingBottom:'env(safe-area-inset-bottom)' }}>
          {BOTTOM_NAV.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname.startsWith(to)
            return (
              <NavLink key={to} to={to} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, padding:'10px 4px', textDecoration:'none', position:'relative' }}>
                {isActive && <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:24, height:2, borderRadius:'0 0 2px 2px', background:'#00E5A0' }} />}
                <Icon size={20} style={{ color: isActive ? '#00E5A0' : '#4A5878', transition:'color 0.15s' }} />
                <span style={{ fontSize:10, fontWeight:isActive?600:400, color:isActive?'#00E5A0':'#4A5878', lineHeight:1 }}>{label}</span>
              </NavLink>
            )
          })}
          <button onClick={() => setDrawerOpen(true)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, padding:'10px 4px', background:'none', border:'none', cursor:'pointer' }}>
            <Menu size={20} style={{ color:'#4A5878' }} />
            <span style={{ fontSize:10, color:'#4A5878', lineHeight:1 }}>Mais</span>
          </button>
        </nav>
      )}

      <AIChat />
      <Toaster richColors position={isNarrow ? 'bottom-center' : 'top-right'} />

      <style>{`
        * { scrollbar-width: thin; scrollbar-color: #1A2540 transparent; }
        *::-webkit-scrollbar { width: 5px; height: 5px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: #1A2540; border-radius: 99px; }
        *::-webkit-scrollbar-thumb:hover { background: #2A3550; }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideInLeft { from { transform: translateX(-100%) } to { transform: translateX(0) } }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
