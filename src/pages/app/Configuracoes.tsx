import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { fetchJson } from '../../lib/http'
import { usePlanGuard } from '../../hooks/usePlanGuard'
import { LogOut, Settings2, ShieldCheck, User, ExternalLink, AlertTriangle } from 'lucide-react'

const C = {
  card:'#0B1120', border:'rgba(255,255,255,0.06)', borderStrong:'rgba(255,255,255,0.1)',
  accent:'#00E5A0', text:'#E8EFF8', textMuted:'#4A5878', textSub:'#8899B4',
  red:'#F2545B', yellow:'#F5A623',
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon size={16} style={{ color: C.accent }} />
        <p style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>{title}</p>
      </div>
      <div style={{ padding: '20px 24px' }}>
        {children}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 13, color: C.textMuted }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{value}</span>
    </div>
  )
}

export default function Configuracoes() {
  const navigate = useNavigate()
  const { profile, isPro, isLoading } = usePlanGuard()
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  const handleManageSubscription = async () => {
    setLoadingPortal(true)
    const loadingId = toast.loading('Abrindo portal de assinatura...')
    try {
      const { data:{session} } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada.')
      const res = await fetchJson<{url?:string;error?:string}>('/.netlify/functions/stripe-portal', {
        method:'POST', headers:{Authorization:`Bearer ${session.access_token}`},
      })
      if (!res.ok || !res.data.url) throw new Error(res.data.error ?? 'Não foi possível abrir o portal.')
      toast.success('Redirecionando para o Stripe.', {id:loadingId})
      window.location.href = res.data.url
    } catch(err:any) {
      toast.error(err.message, {id:loadingId})
      setLoadingPortal(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success('Sessão encerrada com sucesso.')
    navigate('/')
  }

  const handleDeleteAccount = async () => {
    const confirmed = window.prompt(
      'Esta ação é irreversível e apagará todos os seus dados.\n\nDigite "CONFIRMAR" para excluir sua conta:'
    )
    if (confirmed !== 'CONFIRMAR') {
      toast.error('Exclusão cancelada.')
      return
    }
    setDeletingAccount(true)
    toast.error('Funcionalidade em desenvolvimento. Entre em contato com o suporte.')
    setDeletingAccount(false)
  }

  if (isLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ height: 28, width: 200, background: 'rgba(255,255,255,0.06)', borderRadius: 8 }} />
      {[1, 2, 3].map(i => <div key={i} style={{ height: 140, background: 'rgba(255,255,255,0.04)', borderRadius: 16 }} />)}
    </div>
  )

  return (
    <div style={{ color: C.text, fontFamily: 'system-ui,sans-serif', maxWidth: 700 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Configurações</h1>
        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Gerencie sua conta e preferências</p>
      </div>

      {/* Account info */}
      <Section title="Sua Conta" icon={User}>
        <InfoRow label="Nome"    value={profile?.full_name ?? 'Não informado'} />
        <InfoRow label="Email"   value={profile?.email ?? '—'} />
        <InfoRow label="Plano"   value={isPro ? '✨ PRO' : 'Gratuito'} />
        {profile?.plan_expires_at && (
          <InfoRow label="Renovação" value={new Date(profile.plan_expires_at).toLocaleDateString('pt-BR')} />
        )}
        <div style={{ marginTop: 16 }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px',
              background: 'transparent', border: `1px solid ${C.border}`,
              borderRadius: 9, color: C.textSub, fontSize: 13, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(242,84,91,0.3)'; e.currentTarget.style.color = C.red }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub }}
          >
            <LogOut size={15} /> Sair da conta
          </button>
        </div>
      </Section>

      {/* Subscription */}
      <Section title="Assinatura" icon={ShieldCheck}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
              {isPro ? 'Plano PRO Ativo' : 'Plano Gratuito'}
            </p>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
              {isPro ? 'Gerencie cobranças e método de pagamento' : 'Faça upgrade para desbloquear todos os recursos'}
            </p>
          </div>
          <button
            onClick={isPro ? handleManageSubscription : () => navigate('/app/plano')}
            disabled={loadingPortal}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', borderRadius: 9,
              border: isPro ? `1px solid ${C.borderStrong}` : 'none',
              background: isPro ? C.card : C.accent,
              color: isPro ? C.text : '#06080F',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {isPro ? <><ExternalLink size={13} />{loadingPortal ? 'Abrindo...' : 'Portal Stripe'}</> : 'Fazer upgrade'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: C.textMuted }}>
          🔒 Pagamento processado de forma segura via Stripe · Cancele quando quiser
        </p>
      </Section>

      {/* About */}
      <Section title="Sobre o SmartMoney" icon={Settings2}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Versão', value: '2.0.0' },
            { label: 'Open Finance', value: 'Pluggy / Banco Central' },
            { label: 'Pagamentos', value: 'Stripe' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 13, color: C.textMuted }}>{r.label}</span>
              <span style={{ fontSize: 13, color: C.textSub }}>{r.value}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href="mailto:suporte@smartmoney.app" style={{ fontSize: 12, color: C.accent, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            Contato & Suporte
          </a>
          <span style={{ color: C.border }}>·</span>
          <a href="#" style={{ fontSize: 12, color: C.textMuted, textDecoration: 'none' }}>Política de Privacidade</a>
          <span style={{ color: C.border }}>·</span>
          <a href="#" style={{ fontSize: 12, color: C.textMuted, textDecoration: 'none' }}>Termos de Uso</a>
        </div>
      </Section>

      {/* Danger zone */}
      <div style={{ background: 'rgba(242,84,91,0.04)', border: '1px solid rgba(242,84,91,0.15)', borderRadius: 16, padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <AlertTriangle size={16} style={{ color: C.red }} />
          <p style={{ fontWeight: 600, color: C.red, fontSize: 14 }}>Zona de Perigo</p>
        </div>
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
          Ações irreversíveis. Proceda com cuidado.
        </p>
        <button onClick={handleDeleteAccount} disabled={deletingAccount}
          style={{
            padding: '9px 16px', background: 'transparent',
            border: '1px solid rgba(242,84,91,0.3)', borderRadius: 9,
            color: C.red, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(242,84,91,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          {deletingAccount ? 'Excluindo...' : 'Excluir minha conta e dados'}
        </button>
      </div>
    </div>
  )
}
