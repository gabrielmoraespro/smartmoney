import { useEffect, useState, useMemo } from 'react'
import { getUserAuthHeaders, supabase } from '../../lib/supabase'
import type { Transaction } from '../../lib/types'
import { ChevronDown, ChevronUp, TrendingDown, AlertCircle, RefreshCw } from 'lucide-react'
import { useResponsive } from '../../hooks/useResponsive'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

const C = {
  card:'#0B1120', border:'rgba(255,255,255,0.06)', borderStrong:'rgba(255,255,255,0.1)',
  accent:'#00E5A0', text:'#E8EFF8', textMuted:'#4A5878', textSub:'#8899B4',
  green:'#00E5A0', red:'#F2545B', yellow:'#F5A623',
  PALETTE:['#00E5A0','#3B8BF5','#F5A623','#F2545B','#A78BFA','#F472B6','#34D399','#818CF8','#FB923C','#38BDF8'],
}
const fmt  = (v: number) => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const fmtK = (v: number) => v>=1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v.toFixed(0)}`
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function Categorias() {
  const { cols } = useResponsive()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const [expandedCat, setExpandedCat] = useState<string|null>(null)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const { data:{user} } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessão expirada.')
      const headers = await getUserAuthHeaders()
      const base = import.meta.env.VITE_SUPABASE_URL as string
      const res = await fetch(`${base}/rest/v1/transactions?user_id=eq.${user.id}&order=date.desc&limit=1000`,{headers})
      if (!res.ok) throw new Error('Falha ao carregar transações.')
      const data = await res.json()
      setTransactions((data??[]) as Transaction[])
    } catch(e:any) { setError(e.message??'Erro ao carregar.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const availableMonths = useMemo(() => {
    const set = new Set<string>()
    transactions.forEach(t => set.add(t.date.substring(0,7)))
    return Array.from(set).sort().reverse().slice(0,12)
  }, [transactions])

  const monthTx = useMemo(
    () => transactions.filter(t => t.date.startsWith(selectedMonth) && t.type==='debit'),
    [transactions, selectedMonth]
  )

  const categoryMap = useMemo(() => {
    const map: Record<string,{total:number;transactions:Transaction[]}> = {}
    monthTx.forEach(t => {
      const cat = t.category ?? 'Outros'
      if (!map[cat]) map[cat] = {total:0,transactions:[]}
      map[cat].total += Math.abs(Number(t.amount))
      map[cat].transactions.push(t)
    })
    return Object.entries(map).sort((a,b)=>b[1].total-a[1].total)
  }, [monthTx])

  const totalExpenses = monthTx.reduce((s,t)=>s+Math.abs(Number(t.amount)),0)
  const totalIncome   = transactions
    .filter(t=>t.date.startsWith(selectedMonth)&&t.type==='credit')
    .reduce((s,t)=>s+Math.abs(Number(t.amount)),0)

  // Trend last 6 months
  const trendData = useMemo(() => {
    const last6 = availableMonths.slice(0,6).reverse()
    return last6.map(m => {
      const obj: any = { month: MONTHS[parseInt(m.split('-')[1])-1] }
      categoryMap.slice(0,5).forEach(([cat]) => {
        obj[cat] = transactions
          .filter(t => t.date.startsWith(m) && t.type==='debit' && (t.category??'Outros')===cat)
          .reduce((s,t)=>s+Math.abs(Number(t.amount)),0)
      })
      return obj
    })
  }, [transactions, availableMonths, categoryMap])

  // Month-over-month change per category
  const prevMonth = availableMonths[availableMonths.indexOf(selectedMonth)+1] ?? null
  const prevTotals = useMemo(() => {
    if (!prevMonth) return {}
    const map: Record<string,number> = {}
    transactions.filter(t=>t.date.startsWith(prevMonth)&&t.type==='debit').forEach(t => {
      const cat = t.category??'Outros'
      map[cat] = (map[cat]??0)+Math.abs(Number(t.amount))
    })
    return map
  }, [transactions, prevMonth])

  const Tt = ({active,payload,label}: any) => {
    if(!active||!payload?.length) return null
    return (
      <div style={{background:'#0D1526',border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 14px',fontSize:12}}>
        <p style={{color:C.textMuted,marginBottom:6}}>{label}</p>
        {payload.map((p:any,i:number) => (
          <p key={i} style={{color:p.color,fontWeight:600}}>{p.name}: {fmt(p.value)}</p>
        ))}
      </div>
    )
  }

  if (loading) return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{height:28,width:160,background:'rgba(255,255,255,0.06)',borderRadius:8}} />
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
        {[1,2,3].map(i=><div key={i} style={{height:100,background:'rgba(255,255,255,0.04)',borderRadius:16}} />)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        {[1,2].map(i=><div key={i} style={{height:280,background:'rgba(255,255,255,0.04)',borderRadius:16}} />)}
      </div>
      <div style={{height:400,background:'rgba(255,255,255,0.04)',borderRadius:16}} />
    </div>
  )

  return (
    <div style={{color:C.text,fontFamily:'system-ui,sans-serif',maxWidth:1300}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12,marginBottom:24}}>
        <div>
          <h1 style={{fontSize:26,fontWeight:700,margin:0,letterSpacing:-0.5}}>Categorias</h1>
          <p style={{fontSize:13,color:C.textMuted,marginTop:4}}>Análise detalhada dos seus gastos por categoria</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <button onClick={load} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 12px',background:C.card,border:`1px solid ${C.border}`,borderRadius:9,color:C.textSub,fontSize:12,cursor:'pointer'}}>
            <RefreshCw size={13} />
            Atualizar
          </button>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {availableMonths.slice(0,8).map(m => {
              const [y,mo] = m.split('-')
              return (
                <button key={m} onClick={()=>setSelectedMonth(m)} style={{
                  background:selectedMonth===m?C.accent:'rgba(255,255,255,0.04)',
                  color:selectedMonth===m?'#06080F':C.textMuted,
                  border:`1px solid ${selectedMonth===m?C.accent:C.border}`,
                  borderRadius:20, padding:'5px 14px', fontSize:12, fontWeight:600, cursor:'pointer',
                  transition:'all 0.15s',
                }}>
                  {MONTHS[parseInt(mo)-1]}/{y.slice(2)}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',background:'rgba(242,84,91,0.08)',border:'1px solid rgba(242,84,91,0.2)',borderRadius:12,marginBottom:20}}>
          <AlertCircle size={16} style={{color:C.red,flexShrink:0}} />
          <p style={{color:C.red,fontSize:13,flex:1}}>{error}</p>
          <button onClick={load} style={{fontSize:12,color:C.red,background:'rgba(242,84,91,0.12)',border:'none',borderRadius:7,padding:'4px 12px',cursor:'pointer',fontWeight:600}}>Tentar novamente</button>
        </div>
      )}

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:cols({xs:1,sm:1,md:3}),gap:16,marginBottom:20}}>
        {[
          {label:'Total de Gastos',   value:fmt(totalExpenses), color:C.red,    sub:`${monthTx.length} transações`},
          {label:'Total de Receitas', value:fmt(totalIncome),   color:C.green,  sub:`${transactions.filter(t=>t.date.startsWith(selectedMonth)&&t.type==='credit').length} entradas`},
          {label:'Saldo do Período',  value:fmt(totalIncome-totalExpenses), color:totalIncome-totalExpenses>=0?C.green:C.red, sub:totalIncome>0?`${((totalIncome-totalExpenses)/totalIncome*100).toFixed(0)}% do saldo`:'Sem receitas'},
        ].map(k => (
          <div key={k.label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:'20px 24px'}}>
            <p style={{fontSize:12,fontWeight:500,color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>{k.label}</p>
            <p style={{fontSize:26,fontWeight:700,color:k.color,marginBottom:6,letterSpacing:-0.5}}>{k.value}</p>
            <p style={{fontSize:12,color:C.textMuted}}>{k.sub}</p>
          </div>
        ))}
      </div>

      {categoryMap.length === 0 ? (
        <div style={{background:C.card,border:`1px dashed ${C.border}`,borderRadius:16,padding:'64px 24px',textAlign:'center'}}>
          <div style={{width:56,height:56,borderRadius:16,background:'rgba(255,255,255,0.04)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
            <TrendingDown size={24} style={{color:C.textMuted}} />
          </div>
          <p style={{color:C.text,fontWeight:600,marginBottom:8}}>Nenhuma transação neste mês</p>
          <p style={{color:C.textMuted,fontSize:13}}>Conecte seu banco para ver análises de gastos por categoria.</p>
        </div>
      ) : (
        <>
          {/* Charts Row */}
          <div style={{display:'grid',gridTemplateColumns:cols({xs:1,md:2}),gap:16,marginBottom:20}}>
            {/* Donut */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:'20px 24px'}}>
              <p style={{fontWeight:600,color:C.text,marginBottom:4}}>Distribuição por Categoria</p>
              <p style={{fontSize:11,color:C.textMuted,marginBottom:16}}>Proporção de gastos no mês</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categoryMap.slice(0,8).map(([name,v])=>({name,value:v.total}))} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                    {categoryMap.slice(0,8).map((_,i)=><Cell key={i} fill={C.PALETTE[i%C.PALETTE.length]} stroke="transparent"/>)}
                  </Pie>
                  <Tooltip formatter={(v:number)=>fmt(v)} contentStyle={{background:'#0D1526',border:`1px solid ${C.border}`,borderRadius:8,fontSize:12}} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{display:'flex',flexDirection:'column',gap:7,marginTop:8}}>
                {categoryMap.slice(0,5).map(([cat,data],i)=>(
                  <div key={cat} style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{width:8,height:8,borderRadius:'50%',background:C.PALETTE[i%C.PALETTE.length],flexShrink:0}} />
                    <span style={{fontSize:12,color:C.textSub,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cat}</span>
                    <div style={{width:60,height:3,background:'rgba(255,255,255,0.06)',borderRadius:99,overflow:'hidden',marginRight:8}}>
                      <div style={{width:`${totalExpenses>0?(data.total/totalExpenses*100):0}%`,height:'100%',background:C.PALETTE[i%C.PALETTE.length],borderRadius:99}} />
                    </div>
                    <span style={{fontSize:11,fontWeight:600,color:C.text,minWidth:60,textAlign:'right'}}>{fmtK(data.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trend Bar Chart */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:'20px 24px'}}>
              <p style={{fontWeight:600,color:C.text,marginBottom:4}}>Tendência — Últimos 6 Meses</p>
              <p style={{fontSize:11,color:C.textMuted,marginBottom:16}}>Evolução das top 5 categorias</p>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={trendData} margin={{top:4,right:4,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{fontSize:10,fill:C.textMuted}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize:10,fill:C.textMuted}} axisLine={false} tickLine={false} width={50} tickFormatter={v=>v>=1000?`R$${(v/1000).toFixed(0)}k`:`R$${v}`} />
                  <Tooltip content={<Tt/>} />
                  {categoryMap.slice(0,5).map(([cat],i)=>(
                    <Bar key={cat} dataKey={cat} stackId="a" fill={C.PALETTE[i%C.PALETTE.length]} radius={i===Math.min(categoryMap.length-1,4)?[4,4,0,0]:[0,0,0,0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category detail list */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,overflow:'hidden'}}>
            <div style={{padding:'18px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <p style={{fontWeight:600,color:C.text}}>Detalhe por Categoria</p>
                <p style={{fontSize:11,color:C.textMuted,marginTop:2}}>Clique para ver transações</p>
              </div>
              <span style={{fontSize:11,color:C.textMuted,background:'rgba(255,255,255,0.04)',padding:'3px 10px',borderRadius:20,border:`1px solid ${C.border}`}}>
                {categoryMap.length} categorias
              </span>
            </div>

            {categoryMap.map(([cat,data],i) => {
              const pct = totalExpenses > 0 ? (data.total/totalExpenses*100) : 0
              const prevTotal = prevTotals[cat] ?? 0
              const change = prevTotal > 0 ? ((data.total-prevTotal)/prevTotal*100) : null
              const isOpen = expandedCat === cat

              return (
                <div key={cat}>
                  <button className="w-full text-left" onClick={()=>setExpandedCat(isOpen?null:cat)}
                    style={{display:'flex',alignItems:'center',padding:'14px 24px',gap:12,background:'transparent',border:'none',borderBottom:`1px solid rgba(255,255,255,0.02)`,cursor:'pointer',width:'100%',transition:'background 0.1s'}}
                    onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
                  >
                    {/* Color dot */}
                    <span style={{width:10,height:10,borderRadius:'50%',background:C.PALETTE[i%C.PALETTE.length],flexShrink:0}} />

                    {/* Category name */}
                    <span style={{fontSize:13,fontWeight:500,color:C.text,flex:1,textAlign:'left'}}>{cat}</span>

                    {/* Transaction count */}
                    <span style={{fontSize:11,color:C.textMuted,minWidth:80,textAlign:'right'}}>{data.transactions.length} tx</span>

                    {/* MoM change */}
                    {change !== null && (
                      <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,
                        background:change>0?'rgba(242,84,91,0.1)':'rgba(0,229,160,0.1)',
                        color:change>0?C.red:C.green,minWidth:52,textAlign:'center',
                      }}>
                        {change>0?'↑':'↓'}{Math.abs(change).toFixed(0)}%
                      </span>
                    )}

                    {/* Progress bar */}
                    <div style={{width:80,height:4,background:'rgba(255,255,255,0.06)',borderRadius:99,overflow:'hidden',margin:'0 12px'}}>
                      <div style={{width:`${pct}%`,height:'100%',background:C.PALETTE[i%C.PALETTE.length],borderRadius:99,transition:'width 0.5s ease'}} />
                    </div>

                    {/* Amount */}
                    <span style={{fontSize:13,fontWeight:700,color:C.text,minWidth:100,textAlign:'right'}}>{fmt(data.total)}</span>
                    <span style={{fontSize:11,color:C.textMuted,minWidth:36,textAlign:'right'}}>{pct.toFixed(0)}%</span>
                    {isOpen ? <ChevronUp size={14} style={{color:C.textMuted,flexShrink:0}} /> : <ChevronDown size={14} style={{color:C.textMuted,flexShrink:0}} />}
                  </button>

                  {isOpen && (
                    <div style={{background:'rgba(255,255,255,0.01)',borderBottom:`1px solid ${C.border}`}}>
                      {data.transactions.slice(0,20).map(t => (
                        <div key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 24px 10px 48px',borderBottom:`1px solid rgba(255,255,255,0.02)`}}>
                          <div>
                            <p style={{fontSize:13,color:C.text}}>{t.description}</p>
                            <p style={{fontSize:11,color:C.textMuted}}>{new Date(t.date).toLocaleDateString('pt-BR')}</p>
                          </div>
                          <span style={{fontSize:13,fontWeight:600,color:C.red}}>-{fmt(Math.abs(Number(t.amount)))}</span>
                        </div>
                      ))}
                      {data.transactions.length > 20 && (
                        <p style={{fontSize:12,textAlign:'center',padding:'10px 0',color:C.textMuted}}>+{data.transactions.length-20} transações</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
