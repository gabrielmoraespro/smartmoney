import { useEffect, useMemo, useState, useCallback } from 'react'
import { useResponsive } from '../../hooks/useResponsive'
import { getUserAuthHeaders, supabase } from '../../lib/supabase'
import type { Account, Transaction } from '../../lib/types'
import {
  Eye, EyeOff, TrendingUp, TrendingDown, Wallet,
  ArrowDownRight, RefreshCw, AlertCircle,
  Flame, CreditCard, Calendar, BarChart2,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#06080F',
  card: '#0B1120',
  cardHover: '#0F1729',
  border: 'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.1)',
  accent: '#00E5A0',
  accentBlue: '#3B8BF5',
  text: '#E8EFF8',
  textMuted: '#4A5878',
  textSub: '#8899B4',
  green: '#00E5A0',
  red: '#F2545B',
  yellow: '#F5A623',
  purple: '#A78BFA',
  PALETTE: ['#00E5A0','#3B8BF5','#F5A623','#F2545B','#A78BFA','#F472B6','#34D399','#818CF8'],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtK = (v: number) => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v.toFixed(0)}`
const pctDiff = (a: number, b: number) => b === 0 ? 0 : ((a - b) / b) * 100

type Period = '7d'|'30d'|'month'|'last_month'|'3m'|'12m'
const PERIODS: {key: Period; label: string}[] = [
  { key: '7d',         label: '7 dias'       },
  { key: '30d',        label: '30 dias'      },
  { key: 'month',      label: 'Este mês'     },
  { key: 'last_month', label: 'Mês anterior' },
  { key: '3m',         label: '3 meses'      },
  { key: '12m',        label: '12 meses'     },
]

function getPeriodRange(p: Period): { start: Date; end: Date } {
  const now = new Date()
  const end = new Date(now); end.setHours(23,59,59,999)
  switch(p) {
    case '7d':   { const s = new Date(now); s.setDate(s.getDate()-6); s.setHours(0,0,0,0); return { start:s, end } }
    case '30d':  { const s = new Date(now); s.setDate(s.getDate()-29); s.setHours(0,0,0,0); return { start:s, end } }
    case 'month':{ const s = new Date(now.getFullYear(), now.getMonth(), 1); return { start:s, end } }
    case 'last_month': {
      const s = new Date(now.getFullYear(), now.getMonth()-1, 1)
      const e = new Date(now.getFullYear(), now.getMonth(), 0); e.setHours(23,59,59,999)
      return { start:s, end:e }
    }
    case '3m':  { const s = new Date(now); s.setMonth(s.getMonth()-3); s.setHours(0,0,0,0); return { start:s, end } }
    case '12m': { const s = new Date(now); s.setFullYear(s.getFullYear()-1); s.setHours(0,0,0,0); return { start:s, end } }
  }
}

function getPrevRange(p: Period): {start: Date; end: Date} | null {
  const now = new Date()
  switch(p) {
    case '7d': {
      const end = new Date(now); end.setDate(end.getDate()-7); end.setHours(23,59,59,999)
      const start = new Date(end); start.setDate(start.getDate()-6); start.setHours(0,0,0,0)
      return { start, end }
    }
    case '30d': {
      const end = new Date(now); end.setDate(end.getDate()-30); end.setHours(23,59,59,999)
      const start = new Date(end); start.setDate(start.getDate()-29); start.setHours(0,0,0,0)
      return { start, end }
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth()-1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0); end.setHours(23,59,59,999)
      return { start, end }
    }
    default: return null
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon: Icon, delta, loading }:
  { label:string; value:string; sub:string; color:string; icon:any; delta?:number|null; loading:boolean }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
      padding: '20px 24px', position: 'relative', overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}
    onMouseEnter={e => (e.currentTarget.style.borderColor = C.borderStrong)}
    onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
    >
      <div style={{
        position:'absolute', top:-20, right:-20,
        width:80, height:80, borderRadius:'50%',
        background: `${color}08`,
      }} />
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
        <p style={{ fontSize:12, fontWeight:500, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</p>
        <div style={{ width:32, height:32, borderRadius:9, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={15} style={{ color }} />
        </div>
      </div>
      {loading ? (
        <div style={{ height:32, background:'rgba(255,255,255,0.06)', borderRadius:8, marginBottom:8 }} />
      ) : (
        <p style={{ fontSize:26, fontWeight:700, color: C.text, marginBottom:6, letterSpacing:-0.5 }}>{value}</p>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <p style={{ fontSize:12, color:C.textMuted }}>{sub}</p>
        {delta != null && !loading && (
          <span style={{
            fontSize:11, fontWeight:600, padding:'1px 7px', borderRadius:20,
            background: delta >= 0 ? 'rgba(242,84,91,0.12)' : 'rgba(0,229,160,0.12)',
            color: delta >= 0 ? C.red : C.green,
          }}>
            {delta >= 0 ? '↑' : '↓'}{Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}

function RhythmCard({ transactions, showValues }: { transactions: Transaction[]; showValues: boolean }) {
  const now = new Date()
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()

  const debits = transactions.filter(t => {
    const d = new Date(`${t.date}T00:00:00`)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.type === 'debit'
  })

  const totalSpent = debits.reduce((s,t) => s + Math.abs(Number(t.amount)), 0)
  const dailyAvg = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0
  const projected = dailyAvg * daysInMonth
  const progressPct = (dayOfMonth / daysInMonth) * 100

  const tempo = dailyAvg > 200 ? 'Alto' : dailyAvg > 80 ? 'Moderado' : 'Baixo'
  const tempoColor = dailyAvg > 200 ? C.red : dailyAvg > 80 ? C.yellow : C.green

  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <div style={{ width:34, height:34, borderRadius:9, background:'rgba(245,166,35,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Flame size={16} style={{ color: C.yellow }} />
        </div>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:13, fontWeight:600, color:C.text }}>Ritmo de Gastos</p>
          <p style={{ fontSize:11, color:C.textMuted }}>Dia {dayOfMonth} de {daysInMonth}</p>
        </div>
        <span style={{ fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:20, background:`${tempoColor}15`, color:tempoColor }}>{tempo}</span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
        {[
          { label:'Média diária', value: showValues ? fmtK(dailyAvg) : '••••', color:C.text },
          { label:'Projeção mensal', value: showValues ? fmtK(projected) : '••••', color: projected > totalSpent*1.2 ? C.yellow : C.text },
        ].map(k => (
          <div key={k.label} style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'10px 12px' }}>
            <p style={{ fontSize:10, color:C.textMuted, marginBottom:4 }}>{k.label}</p>
            <p style={{ fontSize:16, fontWeight:700, color:k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <span style={{ fontSize:11, color:C.textMuted }}>Progresso do mês</span>
          <span style={{ fontSize:11, color:C.textSub }}>{progressPct.toFixed(0)}%</span>
        </div>
        <div style={{ height:5, background:'rgba(255,255,255,0.06)', borderRadius:99, overflow:'hidden' }}>
          <div style={{ width:`${progressPct}%`, height:'100%', background:`linear-gradient(90deg, ${tempoColor}, ${tempoColor}90)`, borderRadius:99, transition:'width 0.8s ease' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
          <span style={{ fontSize:11, fontWeight:600, color:tempoColor }}>{showValues ? fmt(totalSpent) : '•••••'}</span>
          <span style={{ fontSize:11, color:C.textMuted }}>{daysInMonth - dayOfMonth} dias restantes</span>
        </div>
      </div>
    </div>
  )
}

function MonthCompareCard({ current, previous, showValues }: { current:number; previous:number; showValues:boolean }) {
  const diff = current - previous
  const dp = pctDiff(current, previous)
  const isUp = diff > 0

  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <div style={{ width:34, height:34, borderRadius:9, background:'rgba(59,139,245,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <BarChart2 size={16} style={{ color:C.accentBlue }} />
        </div>
        <div>
          <p style={{ fontSize:13, fontWeight:600, color:C.text }}>Comparativo Mensal</p>
          <p style={{ fontSize:11, color:C.textMuted }}>Este mês vs anterior</p>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
        {[
          { label:'Este mês', value: showValues ? fmtK(current) : '••••', color:C.text },
          { label:'Mês anterior', value: showValues ? fmtK(previous) : '••••', color:C.textSub },
        ].map(k => (
          <div key={k.label} style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'10px 12px' }}>
            <p style={{ fontSize:10, color:C.textMuted, marginBottom:4 }}>{k.label}</p>
            <p style={{ fontSize:16, fontWeight:700, color:k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {previous > 0 ? (
        <div style={{
          display:'flex', alignItems:'center', gap:8, padding:'10px 14px',
          background: isUp ? 'rgba(242,84,91,0.08)' : 'rgba(0,229,160,0.08)',
          borderRadius:10, border:`1px solid ${isUp ? 'rgba(242,84,91,0.2)' : 'rgba(0,229,160,0.2)'}`,
        }}>
          {isUp
            ? <TrendingUp size={15} style={{ color:C.red, flexShrink:0 }} />
            : <TrendingDown size={15} style={{ color:C.green, flexShrink:0 }} />
          }
          <p style={{ fontSize:13, fontWeight:600, color: isUp ? C.red : C.green }}>
            {isUp ? '+' : ''}{dp.toFixed(1)}% {isUp ? 'mais gastos' : 'economizado'}
            {showValues && <span style={{ color:C.textMuted, fontWeight:400 }}> · {isUp ? '+' : ''}{fmt(diff)}</span>}
          </p>
        </div>
      ) : (
        <p style={{ fontSize:12, color:C.textMuted, textAlign:'center', padding:'8px 0' }}>Sem dados do mês anterior</p>
      )}
    </div>
  )
}

function HeatmapCalendar({ transactions, showValues }: { transactions:Transaction[]; showValues:boolean }) {
  const today = new Date()
  const y = today.getFullYear(), m = today.getMonth()
  const daysInMonth = new Date(y, m+1, 0).getDate()
  const firstDow = new Date(y, m, 1).getDay()

  const daily = useMemo(() => {
    const map: Record<string,number> = {}
    transactions.filter(t=>t.type==='debit').forEach(t => {
      const d = t.date.substring(0,10)
      if (new Date(`${d}T00:00:00`).getMonth() === m)
        map[d] = (map[d] ?? 0) + Math.abs(Number(t.amount))
    })
    return map
  }, [transactions, m])

  const maxVal = Math.max(...Object.values(daily), 1)
  const cells: (number|null)[] = [...Array(firstDow).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)]

  const getColor = (spend: number) => {
    if (!spend) return 'rgba(255,255,255,0.04)'
    const r = spend / maxVal
    if (r < 0.25) return 'rgba(0,229,160,0.25)'
    if (r < 0.5)  return 'rgba(0,229,160,0.45)'
    if (r < 0.75) return 'rgba(0,229,160,0.65)'
    return '#00E5A0'
  }

  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <div style={{ width:34, height:34, borderRadius:9, background:'rgba(0,229,160,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Calendar size={16} style={{ color:C.accent }} />
        </div>
        <div>
          <p style={{ fontSize:13, fontWeight:600, color:C.text }}>Mapa de Gastos do Mês</p>
          <p style={{ fontSize:11, color:C.textMuted }}>Intensidade por dia</p>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:3, marginBottom:4 }}>
        {['D','S','T','Q','Q','S','S'].map((l,i) => (
          <div key={i} style={{ textAlign:'center', fontSize:9, color:C.textMuted, fontWeight:600 }}>{l}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:3 }}>
        {cells.map((day,i) => {
          if (day === null) return <div key={i} />
          const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const spend = daily[ds] ?? 0
          const isToday = day === today.getDate()
          return (
            <div key={i} title={showValues ? `${day}: ${fmt(spend)}` : `${day}: ••••`}
              style={{
                aspectRatio:'1', borderRadius:4,
                background: getColor(spend),
                border: isToday ? `1px solid ${C.accent}` : '1px solid transparent',
                cursor: spend > 0 ? 'pointer' : 'default',
                transition: 'transform 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.25)'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'}
            />
          )
        })}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:10, justifyContent:'flex-end' }}>
        <span style={{ fontSize:9, color:C.textMuted }}>Menos</span>
        {['rgba(255,255,255,0.04)','rgba(0,229,160,0.25)','rgba(0,229,160,0.45)','rgba(0,229,160,0.65)','#00E5A0'].map((c,i) => (
          <div key={i} style={{ width:10, height:10, borderRadius:2, background:c }} />
        ))}
        <span style={{ fontSize:9, color:C.textMuted }}>Mais</span>
      </div>
    </div>
  )
}

// Custom Recharts Tooltip
const Tt = ({ active, payload, label, showValues }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#0D1526', border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 14px', fontSize:12 }}>
      <p style={{ color:C.textMuted, marginBottom:6 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color:p.color, fontWeight:600 }}>{p.name}: {showValues ? fmt(p.value) : '••••'}</p>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { cols } = useResponsive()
  const [period, setPeriod] = useState<Period>('month')
  const [allTx, setAllTx] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showValues, setShowValues] = useState(true)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [retries, setRetries] = useState(0)

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true)
      setError('')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessão expirada. Faça login novamente.')

      const headers = await getUserAuthHeaders()
      const base = import.meta.env.VITE_SUPABASE_URL as string

      const [txR, accR] = await Promise.all([
        fetch(`${base}/rest/v1/transactions?user_id=eq.${user.id}&order=date.desc&limit=1000`, { headers }),
        fetch(`${base}/rest/v1/accounts?user_id=eq.${user.id}&select=*`, { headers }),
      ])

      if (!txR.ok || !accR.ok) throw new Error('Falha ao carregar dados do servidor.')

      const [txData, accData] = await Promise.all([txR.json(), accR.json()])
      setAllTx((txData ?? []) as Transaction[])
      setAccounts((accData ?? []) as Account[])
    } catch (e: any) {
      setError(e.message ?? 'Erro inesperado ao carregar dados.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData, retries])

  // ── Derived ──────────────────────────────────────────────────────────────────
  const { start, end } = useMemo(() => getPeriodRange(period), [period])
  const prevRange = useMemo(() => getPrevRange(period), [period])

  const isoDate = (d: Date) => d.toISOString().substring(0,10)
  const inRange = (t: Transaction, s: Date, e: Date) => t.date >= isoDate(s) && t.date <= isoDate(e)

  const periodTx = useMemo(() => allTx.filter(t => inRange(t, start, end)), [allTx, start, end])
  const prevTx   = useMemo(() => prevRange ? allTx.filter(t => inRange(t, prevRange.start, prevRange.end)) : [], [allTx, prevRange])

  const stats = useMemo(() => {
    const income   = periodTx.filter(t=>t.type==='credit').reduce((s,t)=>s+Math.abs(Number(t.amount)), 0)
    const expenses = periodTx.filter(t=>t.type==='debit' ).reduce((s,t)=>s+Math.abs(Number(t.amount)), 0)
    return { income, expenses, balance: income - expenses }
  }, [periodTx])

  const prevExpenses = useMemo(
    () => prevTx.filter(t=>t.type==='debit').reduce((s,t)=>s+Math.abs(Number(t.amount)), 0),
    [prevTx]
  )
  const expDelta = prevExpenses > 0 ? pctDiff(stats.expenses, prevExpenses) : null

  const categories = useMemo(() => {
    const map: Record<string,number> = {}
    periodTx.filter(t=>t.type==='debit').forEach(t => {
      const cat = t.category ?? 'Outros'
      map[cat] = (map[cat] ?? 0) + Math.abs(Number(t.amount))
    })
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,value])=>({ name, value }))
  }, [periodTx])

  const cashflow = useMemo(() => {
    const days = Math.min(Math.ceil((end.getTime()-start.getTime())/86400000)+1, 90)
    const dm: Record<string,{in:number;out:number}> = {}
    for (let i=0; i<days; i++) {
      const d = new Date(start); d.setDate(start.getDate()+i)
      dm[isoDate(d)] = { in:0, out:0 }
    }
    periodTx.forEach(t => {
      if (!dm[t.date]) return
      if (t.type==='credit') dm[t.date].in += Math.abs(Number(t.amount))
      else dm[t.date].out += Math.abs(Number(t.amount))
    })

    if (period === '12m') {
      const mm: Record<string,{in:number;out:number}> = {}
      Object.entries(dm).forEach(([d,v]) => {
        const k = d.substring(0,7)
        if (!mm[k]) mm[k] = {in:0,out:0}
        mm[k].in += v.in; mm[k].out += v.out
      })
      return Object.entries(mm).map(([mo,v]) => ({
        day: new Date(`${mo}-01T00:00:00`).toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}),
        Entradas: v.in, Saídas: v.out,
      }))
    }
    return Object.entries(dm).map(([d,v]) => ({
      day: new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}),
      Entradas: v.in, Saídas: v.out,
    }))
  }, [periodTx, start, end, period])

  const recentTx = useMemo(
    () => periodTx.filter(t=>t.type==='debit').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10),
    [periodTx]
  )

  const checkBal = useMemo(
    () => accounts.filter(a=>a.is_active && a.type!=='credit').reduce((s,a)=>s+Number(a.balance||0), 0),
    [accounts]
  )
  const creditAccs = useMemo(() => accounts.filter(a=>a.is_active && a.type==='credit'), [accounts])

  const hasData = allTx.length > 0
  const totalCatExpenses = categories.reduce((s,c)=>s+c.value, 0)
  const now = new Date()

  // ── Skeleton loading ──────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Header skeleton */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div>
          <div style={{ height:28, width:160, background:'rgba(255,255,255,0.06)', borderRadius:8, marginBottom:8 }} />
          <div style={{ height:14, width:200, background:'rgba(255,255,255,0.04)', borderRadius:6 }} />
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {[1,2].map(i => <div key={i} style={{ height:36, width:100, background:'rgba(255,255,255,0.06)', borderRadius:8 }} />)}
        </div>
      </div>
      {/* KPI skeleton */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
        {[1,2,3].map(i => <div key={i} style={{ height:120, background:'rgba(255,255,255,0.04)', borderRadius:16 }} />)}
      </div>
      {/* Chart skeleton */}
      <div style={{ height:260, background:'rgba(255,255,255,0.04)', borderRadius:16 }} />
      <div style={{ display:'grid', gridTemplateColumns:cols({xs:1,sm:2}), gap:16 }}>
        {[1,2,3,4].map(i => <div key={i} style={{ height:180, background:'rgba(255,255,255,0.04)', borderRadius:16 }} />)}
      </div>
    </div>
  )

  return (
    <div style={{ color:C.text, fontFamily:'system-ui, sans-serif', maxWidth:1400 }}>
      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:700, color:C.text, margin:0, letterSpacing:-0.5 }}>Dashboard</h1>
          <p style={{ color:C.textMuted, fontSize:13, marginTop:4, textTransform:'capitalize' }}>
            {now.toLocaleDateString('pt-BR',{weekday:'long', day:'2-digit', month:'long', year:'numeric'})}
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => loadData(true)} disabled={refreshing}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:C.card, border:`1px solid ${C.border}`, borderRadius:10, color:C.textSub, fontSize:12, cursor:'pointer' }}>
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
          <button onClick={() => setShowValues(v => !v)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:C.card, border:`1px solid ${C.border}`, borderRadius:10, color:C.textSub, fontSize:12, cursor:'pointer' }}>
            {showValues ? <EyeOff size={13} /> : <Eye size={13} />}
            {showValues ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      </div>

      {/* ── Period Selector ── */}
      <div style={{ display:'flex', gap:4, marginBottom:24, background:C.card, padding:4, borderRadius:12, width:'fit-content', flexWrap:'wrap', border:`1px solid ${C.border}` }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            style={{
              padding:'6px 16px', borderRadius:8, border:'none', fontSize:12,
              fontWeight:600, cursor:'pointer', transition:'all 0.15s',
              background: period===p.key ? '#00E5A0' : 'transparent',
              color: period===p.key ? '#06080F' : C.textMuted,
            }}
          >{p.label}</button>
        ))}
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'rgba(242,84,91,0.08)', border:'1px solid rgba(242,84,91,0.2)', borderRadius:12, marginBottom:20 }}>
          <AlertCircle size={16} style={{ color:C.red, flexShrink:0 }} />
          <p style={{ color:C.red, fontSize:13, flex:1 }}>{error}</p>
          <button onClick={() => setRetries(r=>r+1)} style={{ fontSize:12, color:C.red, background:'rgba(242,84,91,0.12)', border:'none', borderRadius:7, padding:'4px 12px', cursor:'pointer', fontWeight:600 }}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div style={{ display:'grid', gridTemplateColumns:cols({xs:1,sm:1,md:3}), gap:16, marginBottom:20 }}>
        <KpiCard
          label="Saldo do Período"
          value={showValues ? fmt(stats.balance) : '•••••'}
          sub={stats.balance >= 0 ? 'Resultado positivo ✓' : 'Resultado negativo'}
          color={stats.balance >= 0 ? C.green : C.red}
          icon={Wallet}
          loading={loading}
        />
        <KpiCard
          label="Receitas"
          value={showValues ? fmt(stats.income) : '•••••'}
          sub={`${periodTx.filter(t=>t.type==='credit').length} entradas`}
          color={C.accentBlue}
          icon={TrendingUp}
          loading={loading}
        />
        <KpiCard
          label="Despesas"
          value={showValues ? fmt(stats.expenses) : '•••••'}
          sub={`${periodTx.filter(t=>t.type==='debit').length} saídas`}
          color={C.red}
          icon={TrendingDown}
          delta={expDelta}
          loading={loading}
        />
      </div>

      {!hasData ? (
        <div style={{ background:C.card, border:`1px dashed ${C.border}`, borderRadius:16, padding:'64px 24px', textAlign:'center' }}>
          <div style={{ width:56, height:56, borderRadius:16, background:'rgba(255,255,255,0.04)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <Wallet size={24} style={{ color:C.textMuted }} />
          </div>
          <p style={{ color:C.text, fontWeight:600, marginBottom:8 }}>Nenhuma transação encontrada</p>
          <p style={{ color:C.textMuted, fontSize:13 }}>Conecte seu banco em "Conectar Banco" para importar suas transações automaticamente.</p>
        </div>
      ) : (
        <>
          {/* ── Account Summary ── */}
          {accounts.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns: creditAccs.length > 0 ? cols({xs:1,md:2}) : '1fr', gap:16, marginBottom:20 }}>
              <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                  <div style={{ width:34, height:34, borderRadius:9, background:'rgba(59,139,245,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Wallet size={16} style={{ color:C.accentBlue }} />
                  </div>
                  <div>
                    <p style={{ fontSize:13, fontWeight:600, color:C.text }}>Contas Correntes</p>
                    <p style={{ fontSize:11, color:C.textMuted }}>{accounts.filter(a=>a.is_active&&a.type!=='credit').length} conta(s) ativa(s)</p>
                  </div>
                </div>
                <p style={{ fontSize:28, fontWeight:700, color: checkBal>=0?C.green:C.red, marginBottom:10, letterSpacing:-0.5 }}>
                  {showValues ? fmt(checkBal) : '•••••'}
                </p>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {accounts.filter(a=>a.is_active&&a.type!=='credit').map(a => (
                    <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:'rgba(255,255,255,0.03)', borderRadius:8 }}>
                      <span style={{ fontSize:12, color:C.textSub }}>{a.bank_name}</span>
                      <span style={{ fontSize:12, fontWeight:600, color:C.text }}>{showValues ? fmt(Number(a.balance)||0) : '••••'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {creditAccs.length > 0 && (
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                    <div style={{ width:34, height:34, borderRadius:9, background:'rgba(167,139,250,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <CreditCard size={16} style={{ color:C.purple }} />
                    </div>
                    <div>
                      <p style={{ fontSize:13, fontWeight:600, color:C.text }}>Limite Disponível</p>
                      <p style={{ fontSize:11, color:C.textMuted }}>{creditAccs.length} cartão(ões)</p>
                    </div>
                  </div>
                  <p style={{ fontSize:28, fontWeight:700, color:C.purple, marginBottom:10, letterSpacing:-0.5 }}>
                    {showValues ? fmt(creditAccs.reduce((s,a)=>s+Number(a.balance||0),0)) : '•••••'}
                  </p>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {creditAccs.map(a => (
                      <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:'rgba(255,255,255,0.03)', borderRadius:8 }}>
                        <span style={{ fontSize:12, color:C.textSub }}>{a.bank_name}</span>
                        <span style={{ fontSize:12, fontWeight:600, color:C.purple }}>{showValues ? fmt(Number(a.balance)||0) : '••••'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Cashflow Chart ── */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px', marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
              <div>
                <p style={{ fontWeight:600, color:C.text, marginBottom:3 }}>Fluxo de Caixa</p>
                <p style={{ fontSize:11, color:C.textMuted }}>Entradas vs Saídas · {PERIODS.find(p=>p.key===period)?.label}</p>
              </div>
              <div style={{ display:'flex', gap:16 }}>
                {[{color:C.green,label:'Entradas'},{color:C.red,label:'Saídas'}].map(l => (
                  <div key={l.label} style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:l.color }} />
                    <span style={{ fontSize:11, color:C.textMuted }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={cashflow} margin={{top:10,right:10,left:-10,bottom:0}}>
                <defs>
                  {[{id:'gE',color:C.green},{id:'gS',color:C.red}].map(g => (
                    <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={g.color} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={g.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="day" tick={{fontSize:10,fill:C.textMuted}} axisLine={false} tickLine={false}
                  interval={period==='12m'?0:period==='30d'?4:'preserveStartEnd'} />
                <YAxis tickFormatter={fmtK} tick={{fontSize:10,fill:C.textMuted}} axisLine={false} tickLine={false} />
                <Tooltip content={<Tt showValues={showValues} />} />
                <Area type="monotone" dataKey="Entradas" stroke={C.green} strokeWidth={2} fill="url(#gE)" dot={false} />
                <Area type="monotone" dataKey="Saídas"   stroke={C.red}   strokeWidth={2} fill="url(#gS)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── Rhythm + Compare Row ── */}
          <div style={{ display:'grid', gridTemplateColumns:cols({xs:1,md:2}), gap:16, marginBottom:20 }}>
            <RhythmCard transactions={allTx} showValues={showValues} />
            <MonthCompareCard current={stats.expenses} previous={prevExpenses} showValues={showValues} />
          </div>

          {/* ── Heatmap ── */}
          <div style={{ marginBottom:20 }}>
            <HeatmapCalendar transactions={allTx} showValues={showValues} />
          </div>

          {/* ── Categories + Recent Tx ── */}
          <div style={{ display:'grid', gridTemplateColumns:cols({xs:1,lg:2}), gap:16, marginBottom:20 }}>
            {/* Donut */}
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px' }}>
              <p style={{ fontWeight:600, color:C.text, marginBottom:3 }}>Por Categoria</p>
              <p style={{ fontSize:11, color:C.textMuted, marginBottom:16 }}>{PERIODS.find(p=>p.key===period)?.label}</p>
              {categories.length === 0 ? (
                <p style={{ color:C.textMuted, textAlign:'center', padding:'32px 0', fontSize:13 }}>Sem despesas categorizadas</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={categories} cx="50%" cy="50%" innerRadius={46} outerRadius={72} paddingAngle={3} dataKey="value">
                        {categories.map((_,i) => <Cell key={i} fill={C.PALETTE[i%C.PALETTE.length]} stroke="transparent" />)}
                      </Pie>
                      <Tooltip formatter={(v:number) => showValues ? fmt(v) : '••••'} contentStyle={{background:'#0D1526',border:`1px solid ${C.border}`,borderRadius:8,fontSize:12}} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
                    {categories.slice(0,6).map((cat,i) => (
                      <div key={cat.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0, flex:1 }}>
                          <span style={{ width:8, height:8, borderRadius:'50%', background:C.PALETTE[i%C.PALETTE.length], display:'inline-block', flexShrink:0 }} />
                          <span style={{ fontSize:12, color:C.textSub, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cat.name}</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, marginLeft:8 }}>
                          <div style={{ width:48, height:3, background:'rgba(255,255,255,0.06)', borderRadius:99, overflow:'hidden' }}>
                            <div style={{ width:`${(cat.value/totalCatExpenses)*100}%`, height:'100%', background:C.PALETTE[i%C.PALETTE.length], borderRadius:99 }} />
                          </div>
                          <span style={{ fontSize:11, fontWeight:600, color:C.text, minWidth:48, textAlign:'right' }}>
                            {showValues ? fmtK(cat.value) : '••'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Recent Transactions */}
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, overflow:'hidden' }}>
              <div style={{ padding:'20px 24px 14px' }}>
                <p style={{ fontWeight:600, color:C.text, marginBottom:3 }}>Transações Recentes</p>
                <p style={{ fontSize:11, color:C.textMuted }}>Últimas despesas do período</p>
              </div>
              <div style={{ maxHeight:320, overflowY:'auto' }}>
                {recentTx.length === 0 ? (
                  <p style={{ color:C.textMuted, textAlign:'center', padding:'40px 0', fontSize:13 }}>Nenhuma transação.</p>
                ) : recentTx.map(t => (
                  <div key={t.id}
                    style={{ display:'flex', alignItems:'center', padding:'11px 24px', gap:12, borderBottom:`1px solid rgba(255,255,255,0.03)`, cursor:'pointer', transition:'background 0.1s' }}
                    onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
                  >
                    <div style={{ width:34, height:34, borderRadius:9, flexShrink:0, background:'rgba(242,84,91,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <ArrowDownRight size={14} style={{ color:C.red }} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, fontWeight:500, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.description}</p>
                      <p style={{ fontSize:11, color:C.textMuted }}>{new Date(t.date).toLocaleDateString('pt-BR')} · {t.category ?? 'Outros'}</p>
                    </div>
                    <p style={{ fontSize:13, fontWeight:700, color:C.red, flexShrink:0 }}>
                      -{showValues ? fmt(Math.abs(Number(t.amount))) : '•••••'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Top Categories Bar ── */}
          {categories.length > 0 && (
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px', marginBottom:20 }}>
              <p style={{ fontWeight:600, color:C.text, marginBottom:3 }}>Top Categorias</p>
              <p style={{ fontSize:11, color:C.textMuted, marginBottom:20 }}>{PERIODS.find(p=>p.key===period)?.label}</p>
              <ResponsiveContainer width="100%" height={Math.max(categories.length*34, 120)}>
                <BarChart data={categories} layout="vertical" margin={{top:0,right:90,left:0,bottom:0}}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:C.textSub}} axisLine={false} tickLine={false} width={120} />
                  <Tooltip formatter={(v:number) => showValues ? fmt(v) : '••••'} contentStyle={{background:'#0D1526',border:`1px solid ${C.border}`,borderRadius:8,fontSize:12}} />
                  <Bar dataKey="value" name="Gasto" radius={[0,6,6,0]} label={{position:'right',formatter:(v:number)=>showValues?fmtK(v):'••',fontSize:11,fill:C.textMuted}}>
                    {categories.map((_,i) => <Cell key={i} fill={C.PALETTE[i%C.PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
