import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePlanGuard } from '../../hooks/usePlanGuard'
import { supabase } from '../../lib/supabase'
import { Check, Zap, AlertCircle, CheckCircle2, Crown } from 'lucide-react'

const C = {
  card:'#0B1120', border:'rgba(255,255,255,0.06)', borderStrong:'rgba(255,255,255,0.1)',
  accent:'#00E5A0', text:'#E8EFF8', textMuted:'#4A5878', textSub:'#8899B4',
  red:'#F2545B', yellow:'#F5A623', blue:'#3B8BF5',
}
const PRO_PRICE_ID = 'price_1T6ef9EmHzv0i1aVwxx1QM9p'

const FREE_FEATURES = [
  '1 conta bancária conectada',
  'Até 500 transações',
  'Dashboard e relatórios básicos',
  'Detecção de assinaturas',
  'Categorização automática',
]
const PRO_FEATURES = [
  'Até 2 contas bancárias conectadas',
  'Transações ilimitadas',
  'Relatórios avançados com tendências',
  'Exportação CSV completa',
  'Sincronização automática',
  'Suporte prioritário',
  'Acesso antecipado a novos recursos',
]

export default function Plano() {
  const { profile, isPro, isLoading } = usePlanGuard()
  const [starting, setStarting] = useState(false)
  const [checkoutError, setError] = useState('')
  const [searchParams] = useSearchParams()
  const status = useMemo(() => searchParams.get('checkout'), [searchParams])

  const handleUpgrade = async () => {
    setStarting(true); setError('')
    try {
      const { data:{session} } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada. Faça login novamente.')
      const res = await fetch('/.netlify/functions/stripe-checkout', {
        method:'POST',
        headers:{ Authorization:`Bearer ${session.access_token}`, 'Content-Type':'application/json' },
        body:JSON.stringify({ priceId: PRO_PRICE_ID }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha ao iniciar checkout.')
      window.location.href = data.url
    } catch(err:any) {
      setError(err.message)
      setStarting(false)
    }
  }

  if (isLoading) return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{height:28,width:160,background:'rgba(255,255,255,0.06)',borderRadius:8}} />
      <div style={{height:400,background:'rgba(255,255,255,0.04)',borderRadius:16}} />
    </div>
  )

  return (
    <div style={{color:C.text,fontFamily:'system-ui,sans-serif',maxWidth:720}}>
      <div style={{marginBottom:28}}>
        <h1 style={{fontSize:26,fontWeight:700,margin:0,letterSpacing:-0.5}}>Meu Plano</h1>
        <p style={{fontSize:13,color:C.textMuted,marginTop:4}}>
          Plano atual: <strong style={{color:isPro?C.accent:C.textSub}}>{isPro?'✨ PRO':'Gratuito'}</strong>
        </p>
      </div>

      {/* Status banners */}
      {status==='success' && (
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 18px',background:'rgba(0,229,160,0.08)',border:'1px solid rgba(0,229,160,0.2)',borderRadius:12,marginBottom:20}}>
          <CheckCircle2 size={18} style={{color:C.accent,flexShrink:0}} />
          <div>
            <p style={{color:C.accent,fontWeight:600,fontSize:14}}>Checkout concluído!</p>
            <p style={{color:C.textMuted,fontSize:12,marginTop:2}}>Estamos processando sua assinatura. Isso pode levar alguns minutos.</p>
          </div>
        </div>
      )}
      {status==='canceled' && (
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 18px',background:'rgba(245,166,35,0.08)',border:'1px solid rgba(245,166,35,0.2)',borderRadius:12,marginBottom:20}}>
          <AlertCircle size={18} style={{color:C.yellow,flexShrink:0}} />
          <p style={{color:C.yellow,fontSize:14}}>Checkout cancelado. Pode tentar novamente quando quiser.</p>
        </div>
      )}

      {isPro ? (
        // ── PRO Active State ──
        <div style={{background:'linear-gradient(135deg, rgba(0,229,160,0.08) 0%, rgba(59,139,245,0.05) 100%)',border:'1px solid rgba(0,229,160,0.2)',borderRadius:18,padding:28,marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
            <div style={{width:48,height:48,borderRadius:14,background:'rgba(0,229,160,0.15)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Crown size={22} style={{color:C.accent}} />
            </div>
            <div>
              <p style={{fontSize:18,fontWeight:700,color:C.text}}>Você é PRO! 🎉</p>
              <p style={{fontSize:13,color:C.textMuted,marginTop:2}}>
                {profile?.plan_expires_at
                  ? `Renovação em ${new Date(profile.plan_expires_at).toLocaleDateString('pt-BR')}`
                  : 'Assinatura ativa e válida'}
              </p>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {PRO_FEATURES.map(f => (
              <div key={f} style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:18,height:18,borderRadius:'50%',background:'rgba(0,229,160,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <Check size={11} style={{color:C.accent}} />
                </div>
                <span style={{fontSize:13,color:C.textSub}}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // ── Upgrade State ──
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16}}>
          {/* Free card */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:24}}>
            <div style={{marginBottom:20}}>
              <p style={{fontSize:12,fontWeight:700,color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Plano Atual</p>
              <p style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:4}}>Gratuito</p>
              <p style={{fontSize:28,fontWeight:700,color:C.text}}>R$ 0<span style={{fontSize:13,fontWeight:400,color:C.textMuted}}>/mês</span></p>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {FREE_FEATURES.map(f => (
                <div key={f} style={{display:'flex',alignItems:'center',gap:8}}>
                  <Check size={14} style={{color:C.textMuted,flexShrink:0}} />
                  <span style={{fontSize:13,color:C.textMuted}}>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pro card */}
          <div style={{
            background:'linear-gradient(135deg, rgba(0,229,160,0.06) 0%, rgba(59,139,245,0.04) 100%)',
            border:'1px solid rgba(0,229,160,0.25)', borderRadius:18, padding:24,
            position:'relative', overflow:'hidden',
          }}>
            <div style={{position:'absolute',top:16,right:16,background:'linear-gradient(135deg,#00E5A0,#0088FF)',borderRadius:20,padding:'3px 12px',fontSize:11,fontWeight:700,color:'#fff'}}>
              RECOMENDADO
            </div>
            <div style={{marginBottom:20}}>
              <p style={{fontSize:12,fontWeight:700,color:C.accent,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>SmartMoney PRO</p>
              <p style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:4}}>R$ 19,90<span style={{fontSize:13,fontWeight:400,color:C.textMuted}}>/mês</span></p>
              <p style={{fontSize:12,color:C.textMuted}}>≈ R$ 0,66/dia · cancele quando quiser</p>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:24}}>
              {PRO_FEATURES.map(f => (
                <div key={f} style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:16,height:16,borderRadius:'50%',background:'rgba(0,229,160,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <Check size={10} style={{color:C.accent}} />
                  </div>
                  <span style={{fontSize:13,color:C.textSub}}>{f}</span>
                </div>
              ))}
            </div>

            {checkoutError && (
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:'rgba(242,84,91,0.08)',border:'1px solid rgba(242,84,91,0.2)',borderRadius:8,marginBottom:14}}>
                <AlertCircle size={14} style={{color:C.red,flexShrink:0}} />
                <p style={{color:C.red,fontSize:12}}>{checkoutError}</p>
              </div>
            )}

            <button onClick={handleUpgrade} disabled={starting}
              style={{
                display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                width:'100%',padding:'12px 16px',borderRadius:10,border:'none',
                background:starting?'rgba(0,229,160,0.5)':C.accent,
                color:'#06080F',fontSize:14,fontWeight:700,
                cursor:starting?'not-allowed':'pointer',transition:'all 0.15s',
              }}
              onMouseEnter={e=>{if(!starting)e.currentTarget.style.opacity='0.9'}}
              onMouseLeave={e=>e.currentTarget.style.opacity='1'}
            >
              <Zap size={16} />
              {starting?'Redirecionando...':'Assinar PRO — R$19,90/mês'}
            </button>
            {starting && (
              <p style={{fontSize:11,textAlign:'center',color:C.textMuted,marginTop:10}}>
                Redirecionando para o checkout seguro do Stripe...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Value proposition */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginTop:20}}>
        {[
          {icon:'🔒',title:'100% Seguro',sub:'Checkout via Stripe. Cancele quando quiser.'},
          {icon:'🏦',title:'Open Finance',sub:'Conexão certificada pelo Banco Central.'},
          {icon:'💰',title:'Melhor preço',sub:'Metade do preço dos concorrentes.'},
        ].map(k=>(
          <div key={k.title} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'14px 16px',textAlign:'center'}}>
            <p style={{fontSize:20,marginBottom:6}}>{k.icon}</p>
            <p style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:4}}>{k.title}</p>
            <p style={{fontSize:11,color:C.textMuted}}>{k.sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
