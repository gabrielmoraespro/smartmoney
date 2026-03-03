import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, TrendingUp, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react'

// ─── Shared Design ────────────────────────────────────────────────────────────
const C = {
  bg: '#04060E',
  card: '#0A0F1E',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.14)',
  accent: '#00E5A0',
  text: '#E8EFF8',
  textMuted: '#4A5878',
  textSub: '#8899B4',
  red: '#F2545B',
  yellow: '#F5A623',
  blue: '#3B8BF5',
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
      <path d="M47.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h13.1c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.2 7.4-10.5 7.4-17.5z" fill="#4285F4"/>
      <path d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.9-6c-2.1 1.4-4.8 2.3-8 2.3-6.1 0-11.3-4.1-13.2-9.7H2.7v6.2C6.7 42.8 14.8 48 24 48z" fill="#34A853"/>
      <path d="M10.8 28.8A14.8 14.8 0 0 1 10 24c0-1.7.3-3.3.8-4.8v-6.2H2.7A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.7 10.8l8.1-6z" fill="#FBBC05"/>
      <path d="M24 9.5c3.4 0 6.5 1.2 8.9 3.5l6.6-6.6C35.9 2.5 30.4 0 24 0 14.8 0 6.7 5.2 2.7 13.2l8.1 6.2C12.7 13.6 17.9 9.5 24 9.5z" fill="#EA4335"/>
    </svg>
  )
}

function AuthInput({ icon: Icon, type, placeholder, value, onChange, label }: {
  icon: any; type: string; placeholder: string;
  value: string; onChange: (v: string) => void; label: string
}) {
  const [focused, setFocused] = useState(false)
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: C.textSub, marginBottom: 6 }}>
        {label}
      </label>
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${focused ? C.borderStrong : C.border}`,
        borderRadius: 10,
        transition: 'border-color 0.15s',
      }}>
        <div style={{ padding: '0 12px', color: focused ? C.accent : C.textMuted, transition: 'color 0.15s' }}>
          <Icon size={16} />
        </div>
        <input
          type={isPassword && !show ? 'password' : isPassword ? 'text' : type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1, padding: '12px 0', background: 'transparent',
            border: 'none', outline: 'none', color: C.text, fontSize: 14,
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            style={{ padding: '0 12px', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted }}
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
    </div>
  )
}

const REDIRECT_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8888/app/dashboard'
  : 'https://smartmoneydesk.netlify.app/app/dashboard'

// ─── Login Page ───────────────────────────────────────────────────────────────
export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [loadingG, setLoadingG]   = useState(false)
  const [error, setError]         = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      navigate('/app/dashboard')
    } catch (err: any) {
      setError(err.message === 'Invalid login credentials' ? 'Email ou senha incorretos.' : err.message)
    } finally { setLoading(false) }
  }

  const handleGoogle = async () => {
    setLoadingG(true); setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: REDIRECT_URL },
    })
    if (error) { setError('Erro ao conectar com Google. Tente novamente.'); setLoadingG(false) }
  }

  return <AuthLayout title="Bem-vindo de volta" sub="Entre na sua conta SmartMoney">
    {/* Google */}
    <button type="button" onClick={handleGoogle} disabled={loadingG}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 10, width: '100%', padding: '11px 16px',
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${C.border}`, borderRadius: 10,
        color: C.text, fontSize: 14, fontWeight: 500, cursor: 'pointer',
        transition: 'all 0.15s', marginBottom: 20,
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = C.borderStrong)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
    >
      <GoogleIcon />
      {loadingG ? 'Redirecionando...' : 'Continuar com Google'}
    </button>

    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <div style={{ flex: 1, height: 1, background: C.border }} />
      <span style={{ fontSize: 12, color: C.textMuted }}>ou entre com email</span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>

    <form onSubmit={handleLogin}>
      <AuthInput icon={Mail} type="email" label="Email" placeholder="seu@email.com" value={email} onChange={setEmail} />
      <AuthInput icon={Lock} type="password" label="Senha" placeholder="••••••••" value={password} onChange={setPassword} />

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(242,84,91,0.08)', border: '1px solid rgba(242,84,91,0.2)', borderRadius: 8, marginBottom: 16 }}>
          <AlertCircle size={14} style={{ color: C.red, flexShrink: 0 }} />
          <p style={{ color: C.red, fontSize: 13 }}>{error}</p>
        </div>
      )}

      <button type="submit" disabled={loading}
        style={{
          width: '100%', padding: '12px', borderRadius: 10, border: 'none',
          background: loading ? 'rgba(0,229,160,0.5)' : C.accent,
          color: '#06080F', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s', marginBottom: 16,
        }}
        onMouseEnter={e => { if(!loading) e.currentTarget.style.opacity = '0.9' }}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        {loading ? 'Entrando...' : 'Entrar na conta'}
      </button>
    </form>

    <p style={{ textAlign: 'center', fontSize: 13, color: C.textMuted }}>
      Não tem conta?{' '}
      <Link to="/cadastro" style={{ color: C.accent, fontWeight: 600, textDecoration: 'none' }}>
        Criar conta grátis
      </Link>
    </p>
  </AuthLayout>
}

// ─── Cadastro Page ────────────────────────────────────────────────────────────
export function CadastroPage() {
  const navigate = useNavigate()
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [loadingG, setLoadingG]   = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) { setError('A senha deve ter no mínimo 6 caracteres.'); return }
    setLoading(true); setError('')
    try {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name } },
      })
      if (error) throw error
      setSuccess(true)
      setTimeout(() => navigate('/app/dashboard'), 1500)
    } catch (err: any) {
      setError(err.message === 'User already registered' ? 'Este email já está cadastrado.' : err.message)
    } finally { setLoading(false) }
  }

  const handleGoogle = async () => {
    setLoadingG(true); setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: REDIRECT_URL },
    })
    if (error) { setError('Erro ao conectar com Google. Tente novamente.'); setLoadingG(false) }
  }

  const pwStrength = password.length === 0 ? null
    : password.length < 6 ? 'fraca'
    : password.length < 10 ? 'média'
    : 'forte'
  const pwColor = pwStrength === 'fraca' ? C.red : pwStrength === 'média' ? C.textSub : C.accent

  if (success) return (
    <AuthLayout title="" sub="">
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,229,160,0.12)', border: '2px solid rgba(0,229,160,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <CheckCircle size={28} style={{ color: C.accent }} />
        </div>
        <p style={{ color: C.text, fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Conta criada!</p>
        <p style={{ color: C.textMuted, fontSize: 13 }}>Redirecionando para o dashboard...</p>
      </div>
    </AuthLayout>
  )

  return <AuthLayout title="Criar conta" sub="Comece a controlar suas finanças hoje — grátis">
    <button type="button" onClick={handleGoogle} disabled={loadingG}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 10, width: '100%', padding: '11px 16px',
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${C.border}`, borderRadius: 10,
        color: C.text, fontSize: 14, fontWeight: 500, cursor: 'pointer',
        transition: 'all 0.15s', marginBottom: 20,
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = C.borderStrong)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
    >
      <GoogleIcon />
      {loadingG ? 'Redirecionando...' : 'Cadastrar com Google'}
    </button>

    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <div style={{ flex: 1, height: 1, background: C.border }} />
      <span style={{ fontSize: 12, color: C.textMuted }}>ou cadastre com email</span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>

    <form onSubmit={handleSignup}>
      <AuthInput icon={User}  type="text"     label="Nome"  placeholder="Seu nome" value={name}     onChange={setName} />
      <AuthInput icon={Mail}  type="email"    label="Email" placeholder="seu@email.com" value={email}    onChange={setEmail} />
      <AuthInput icon={Lock}  type="password" label="Senha" placeholder="Mínimo 6 caracteres" value={password} onChange={setPassword} />

      {/* Password strength */}
      {password && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            {['fraca','média','forte'].map((level, i) => (
              <div key={level} style={{
                flex: 1, height: 3, borderRadius: 99,
                background: pwStrength === 'fraca' && i === 0 ? C.red
                  : pwStrength === 'média' && i <= 1 ? C.yellow
                  : pwStrength === 'forte' ? C.accent
                  : 'rgba(255,255,255,0.06)',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>
          <p style={{ fontSize: 11, color: pwColor }}>Senha {pwStrength}</p>
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(242,84,91,0.08)', border: '1px solid rgba(242,84,91,0.2)', borderRadius: 8, marginBottom: 16 }}>
          <AlertCircle size={14} style={{ color: C.red, flexShrink: 0 }} />
          <p style={{ color: C.red, fontSize: 13 }}>{error}</p>
        </div>
      )}

      <button type="submit" disabled={loading}
        style={{
          width: '100%', padding: '12px', borderRadius: 10, border: 'none',
          background: loading ? 'rgba(0,229,160,0.5)' : C.accent,
          color: '#06080F', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s', marginBottom: 16,
        }}
        onMouseEnter={e => { if(!loading) e.currentTarget.style.opacity = '0.9' }}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        {loading ? 'Criando conta...' : 'Criar conta grátis'}
      </button>
    </form>

    <p style={{ textAlign: 'center', fontSize: 13, color: C.textMuted }}>
      Já tem conta?{' '}
      <Link to="/login" style={{ color: C.accent, fontWeight: 600, textDecoration: 'none' }}>
        Entrar
      </Link>
    </p>
  </AuthLayout>
}

// ─── Shared Auth Layout ───────────────────────────────────────────────────────
function AuthLayout({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: C.bg, padding: 16, position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{ position: 'absolute', top: -200, left: '50%', transform: 'translateX(-50%)', width: 600, height: 400, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(0,229,160,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 400, animation: 'fadeIn 0.3s ease' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #00E5A0, #0088FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <TrendingUp size={22} style={{ color: '#fff' }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0, letterSpacing: -0.3 }}>
            Smart<span style={{ color: C.accent }}>Money</span>
          </h1>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Controle financeiro inteligente</p>
        </div>

        {/* Card */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 18, padding: 28,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}>
          {title && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h2>
              {sub && <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>{sub}</p>}
            </div>
          )}
          {children}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: C.textMuted, marginTop: 16 }}>
          🔒 Seus dados são protegidos com criptografia de ponta
        </p>
      </div>

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}

export default LoginPage
