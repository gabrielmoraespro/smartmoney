// ─── Assinaturas.tsx (improved) ───────────────────────────────────────────────
import { useEffect, useState, useMemo } from 'react'
import { getUserAuthHeaders, supabase } from '../../lib/supabase'
import type { Transaction } from '../../lib/types'
import { RefreshCw, AlertCircle, TrendingUp, Clock, CheckCircle, XCircle } from 'lucide-react'
import { useResponsive } from '../../hooks/useResponsive'

const C = {
  card:'#0B1120', border:'rgba(255,255,255,0.06)', borderStrong:'rgba(255,255,255,0.1)',
  accent:'#00E5A0', text:'#E8EFF8', textMuted:'#4A5878', textSub:'#8899B4',
  green:'#00E5A0', red:'#F2545B', yellow:'#F5A623', blue:'#3B8BF5', purple:'#A78BFA',
}
const fmt = (v: number) => v.toLocaleString('pt-BR', {style:'currency',currency:'BRL'})

interface Sub {
  description: string; amount: number; lastDate: string; nextDate: string
  occurrences: number; category: string; status: 'active'|'late'
}

function detectSubscriptions(txs: Transaction[]): Sub[] {
  const debits = txs.filter(t=>t.type==='debit')
  const grouped: Record<string,Transaction[]> = {}
  debits.forEach(t => {
    const k = t.description.toLowerCase().trim().replace(/\s+/g,' ')
    if (!grouped[k]) grouped[k] = []
    grouped[k].push(t)
  })

  const subs: Sub[] = []
  const now = new Date()

  Object.entries(grouped).forEach(([,ts]) => {
    if (ts.length < 2) return
    const sorted = [...ts].sort((a,b)=>a.date.localeCompare(b.date))
    const amounts = sorted.map(t=>Math.abs(Number(t.amount)))
    const avg = amounts.reduce((s,v)=>s+v,0)/amounts.length
    if (!amounts.every(a=>Math.abs(a-avg)<avg*0.1)) return

    const dates = sorted.map(t=>new Date(t.date))
    const gaps: number[] = []
    for (let i=1; i<dates.length; i++)
      gaps.push((dates[i].getTime()-dates[i-1].getTime())/(1000*60*60*24))
    const avgGap = gaps.reduce((s,v)=>s+v,0)/gaps.length
    if (avgGap<25||avgGap>40) return

    const lastDate = new Date(sorted[sorted.length-1].date)
    const nextDate = new Date(lastDate)
    nextDate.setDate(nextDate.getDate()+Math.round(avgGap))
    const daysLeft = (nextDate.getTime()-now.getTime())/(1000*60*60*24)

    subs.push({
      description: sorted[0].description,
      amount: avg,
      lastDate: sorted[sorted.length-1].date,
      nextDate: nextDate.toISOString().substring(0,10),
      occurrences: sorted.length,
      category: sorted[0].category ?? 'Assinaturas',
      status: daysLeft < -5 ? 'late' : 'active',
    })
  })

  return subs.sort((a,b)=>b.amount-a.amount)
}

export default function Assinaturas() {
  const { cols } = useResponsive()
  const [txs, setTxs]       = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const { data:{user} } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessão expirada.')
      const headers = await getUserAuthHeaders()
      const base = import.meta.env.VITE_SUPABASE_URL as string
      const res = await fetch(`${base}/rest/v1/transactions?user_id=eq.${user.id}&order=date.desc&limit=500`,{headers})
      if (!res.ok) throw new Error('Falha ao carregar transações.')
      const data = await res.json()
      setTxs((data??[]) as Transaction[])
    } catch(e:any) { setError(e.message??'Erro ao carregar.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const subs = useMemo(() => detectSubscriptions(txs), [txs])
  const totalMonthly = subs.reduce((s,sub)=>s+sub.amount,0)
  const totalAnnual = totalMonthly * 12
  const activeSubs = subs.filter(s=>s.status==='active').length
  const lateSubs   = subs.filter(s=>s.status==='late').length

  if (loading) return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{height:28,width:200,background:'rgba(255,255,255,0.06)',borderRadius:8}} />
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
        {[1,2,3].map(i=><div key={i} style={{height:100,background:'rgba(255,255,255,0.04)',borderRadius:16}} />)}
      </div>
      <div style={{height:400,background:'rgba(255,255,255,0.04)',borderRadius:16}} />
    </div>
  )

  return (
    <div style={{color:C.text,fontFamily:'system-ui,sans-serif',maxWidth:900}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24}}>
        <div>
          <h1 style={{fontSize:26,fontWeight:700,margin:0,letterSpacing:-0.5}}>Assinaturas</h1>
          <p style={{fontSize:13,color:C.textMuted,marginTop:4}}>Cobranças recorrentes detectadas automaticamente</p>
        </div>
        <button onClick={load} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 12px',background:C.card,border:`1px solid ${C.border}`,borderRadius:9,color:C.textSub,fontSize:12,cursor:'pointer'}}>
          <RefreshCw size={13}/>Atualizar
        </button>
      </div>

      {error && (
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',background:'rgba(242,84,91,0.08)',border:'1px solid rgba(242,84,91,0.2)',borderRadius:12,marginBottom:16}}>
          <AlertCircle size={16} style={{color:C.red,flexShrink:0}} />
          <p style={{color:C.red,fontSize:13,flex:1}}>{error}</p>
          <button onClick={load} style={{fontSize:12,color:C.red,background:'rgba(242,84,91,0.12)',border:'none',borderRadius:7,padding:'4px 12px',cursor:'pointer',fontWeight:600}}>Tentar novamente</button>
        </div>
      )}

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:cols({xs:2,sm:2,md:4}),gap:14,marginBottom:24}}>
        {[
          {label:'Total Mensal',   value:fmt(totalMonthly), color:C.red,    icon:<TrendingUp size={16}/>},
          {label:'Custo Anual',    value:fmt(totalAnnual),  color:C.yellow,  icon:<TrendingUp size={16}/>},
          {label:'Ativas',         value:String(activeSubs),color:C.green,  icon:<CheckCircle size={16}/>},
          {label:'Com atraso',     value:String(lateSubs),  color:lateSubs>0?C.red:C.textMuted, icon:<XCircle size={16}/>},
        ].map(k => (
          <div key={k.label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:'16px 20px',display:'flex',alignItems:'center',gap:14}}>
            <div style={{width:36,height:36,borderRadius:9,background:`${k.color}15`,display:'flex',alignItems:'center',justifyContent:'center',color:k.color,flexShrink:0}}>
              {k.icon}
            </div>
            <div>
              <p style={{fontSize:11,color:C.textMuted,marginBottom:3}}>{k.label}</p>
              <p style={{fontSize:18,fontWeight:700,color:k.color}}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {subs.length === 0 ? (
        <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:16,padding:64,textAlign:'center'}}>
          <div style={{width:56,height:56,borderRadius:16,background:'rgba(255,255,255,0.04)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
            <RefreshCw size={24} style={{color:C.textMuted}} />
          </div>
          <p style={{color:C.text,fontWeight:600,marginBottom:8}}>Nenhuma assinatura detectada</p>
          <p style={{color:C.textMuted,fontSize:13}}>São necessários pelo menos 2 meses de histórico para detectar cobranças recorrentes.</p>
        </div>
      ) : (
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,overflow:'hidden'}}>
          <div style={{padding:'18px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <p style={{fontWeight:600,color:C.text}}>Cobranças Recorrentes</p>
              <p style={{fontSize:11,color:C.textMuted,marginTop:2}}>Detectadas pelo histórico de transações</p>
            </div>
            <span style={{fontSize:11,color:C.textMuted,background:'rgba(255,255,255,0.04)',padding:'3px 10px',borderRadius:20,border:`1px solid ${C.border}`}}>
              {subs.length} detectadas
            </span>
          </div>

          {subs.map((sub,i) => {
            const nextDate = new Date(sub.nextDate)
            const daysLeft = Math.round((nextDate.getTime()-Date.now())/(1000*60*60*24))
            const isLate = sub.status==='late'
            const daysColor = isLate ? C.red : daysLeft<=5 ? C.yellow : C.textMuted

            return (
              <div key={i} style={{
                display:'flex',alignItems:'center',padding:'16px 24px',
                borderBottom:`1px solid rgba(255,255,255,0.02)`,gap:16,
                transition:'background 0.1s',
              }}
              onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')}
              onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
              >
                <div style={{
                  width:42,height:42,borderRadius:12,flexShrink:0,
                  background:isLate?'rgba(242,84,91,0.1)':'rgba(59,139,245,0.1)',
                  display:'flex',alignItems:'center',justifyContent:'center',
                }}>
                  {isLate
                    ? <AlertCircle size={18} style={{color:C.red}} />
                    : <RefreshCw size={18} style={{color:C.blue}} />
                  }
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:13,fontWeight:500,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sub.description}</p>
                  <p style={{fontSize:11,color:C.textMuted}}>{sub.category} · {sub.occurrences}x detectada</p>
                </div>
                <div style={{textAlign:'center',minWidth:100}}>
                  <p style={{fontSize:10,color:C.textMuted,marginBottom:2}}>Próxima cobrança</p>
                  <div style={{display:'flex',alignItems:'center',gap:4,justifyContent:'center'}}>
                    <Clock size={11} style={{color:daysColor}} />
                    <p style={{fontSize:12,fontWeight:600,color:daysColor}}>
                      {isLate?'Atrasada':daysLeft===0?'Hoje':daysLeft<0?`${Math.abs(daysLeft)}d atrás`:`em ${daysLeft}d`}
                    </p>
                  </div>
                </div>
                <div style={{textAlign:'right',minWidth:90}}>
                  <p style={{fontSize:16,fontWeight:700,color:C.text}}>{fmt(sub.amount)}</p>
                  <p style={{fontSize:10,color:C.textMuted}}>/mês</p>
                </div>
              </div>
            )
          })}

          {/* Footer summary */}
          <div style={{padding:'14px 24px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(255,255,255,0.01)'}}>
            <span style={{fontSize:12,color:C.textMuted}}>{subs.length} assinaturas ativas</span>
            <div style={{display:'flex',gap:24}}>
              <div style={{textAlign:'right'}}>
                <p style={{fontSize:10,color:C.textMuted}}>Total mensal</p>
                <p style={{fontSize:14,fontWeight:700,color:C.red}}>{fmt(totalMonthly)}</p>
              </div>
              <div style={{textAlign:'right'}}>
                <p style={{fontSize:10,color:C.textMuted}}>Total anual</p>
                <p style={{fontSize:14,fontWeight:700,color:C.yellow}}>{fmt(totalAnnual)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
