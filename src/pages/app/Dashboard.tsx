// Dashboard.tsx — versão completa com precisão total, seletores de período e espelho de todas as seções
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import AIChat from '../../components/AIChat'
import { useResponsive } from '../../hooks/useResponsive'
import { getUserAuthHeaders, supabase } from '../../lib/supabase'
import type { Account, Transaction } from '../../lib/types'
import {
  Eye, EyeOff, TrendingUp, TrendingDown, Wallet,
  ArrowDownRight, ArrowUpRight, RefreshCw, AlertCircle,
  Flame, CreditCard, Calendar, BarChart2, ChevronLeft,
  ChevronRight, CheckCircle, Clock,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts'

// ─── Design tokens ──────────────────────────────────────────────────────────
const C = {
  bg: '#06080F', card: '#0B1120',
  border: 'rgba(255,255,255,0.06)', borderStrong: 'rgba(255,255,255,0.1)',
  accent: '#00E5A0', accentBlue: '#3B8BF5',
  text: '#E8EFF8', textMuted: '#4A5878', textSub: '#8899B4',
  green: '#00E5A0', red: '#F2545B', yellow: '#F5A623', purple: '#A78BFA',
  PALETTE: ['#00E5A0','#3B8BF5','#F5A623','#F2545B','#A78BFA','#F472B6','#34D399','#818CF8','#FB923C','#38BDF8'],
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MONTHS_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const fmt  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtK = (v: number) => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v.toFixed(0)}`
const pctDiff = (a: number, b: number) => b === 0 ? 0 : ((a - b) / b) * 100
const isoDate = (d: Date) => d.toISOString().substring(0, 10)
const toYM = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`

// ── Classificação precisa das transações ────────────────────────────────────
const isExpense = (t: Transaction) => t.type === 'debit'   // só débitos = despesas
const isIncome  = (t: Transaction) => t.type === 'credit'  // só créditos = receitas
const txAmt     = (t: Transaction) => Math.abs(Number(t.amount))

// ─── Period Range type ───────────────────────────────────────────────────────
type PeriodRange = { start: string; end: string; label: string }

const PRESETS: { label: string; fn: () => PeriodRange }[] = [
  { label: 'Hoje',             fn: () => { const d = isoDate(new Date()); return { start:d, end:d, label:'Hoje' } } },
  { label: 'Esta semana',      fn: () => { const now=new Date(), dow=now.getDay(), s=new Date(now); s.setDate(now.getDate()-dow); s.setHours(0,0,0,0); return {start:isoDate(s),end:isoDate(now),label:'Esta semana'} } },
  { label: 'Este mês',         fn: () => { const now=new Date(); return {start:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`,end:isoDate(now),label:'Este mês'} } },
  { label: 'Mês anterior',     fn: () => { const now=new Date(), s=new Date(now.getFullYear(),now.getMonth()-1,1), e=new Date(now.getFullYear(),now.getMonth(),0); return {start:isoDate(s),end:isoDate(e),label:'Mês anterior'} } },
  { label: 'Últimos 30 dias',  fn: () => { const now=new Date(), s=new Date(now); s.setDate(s.getDate()-29); return {start:isoDate(s),end:isoDate(now),label:'Últimos 30 dias'} } },
  { label: 'Últimos 90 dias',  fn: () => { const now=new Date(), s=new Date(now); s.setDate(s.getDate()-89); return {start:isoDate(s),end:isoDate(now),label:'Últimos 90 dias'} } },
  { label: 'Últimos 6 meses',  fn: () => { const now=new Date(), s=new Date(now); s.setMonth(s.getMonth()-6); return {start:isoDate(s),end:isoDate(now),label:'Últimos 6 meses'} } },
  { label: 'Este ano',         fn: () => { const now=new Date(); return {start:`${now.getFullYear()}-01-01`,end:isoDate(now),label:'Este ano'} } },
  { label: 'Últimos 12 meses', fn: () => { const now=new Date(), s=new Date(now); s.setFullYear(s.getFullYear()-1); return {start:isoDate(s),end:isoDate(now),label:'Últimos 12 meses'} } },
]

// ─── CalendarPicker ──────────────────────────────────────────────────────────
function CalendarPicker({ value, onChange }: { value: PeriodRange; onChange: (r: PeriodRange) => void }) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [step, setStep] = useState<'start'|'end'|null>(null)
  const [tempStart, setTempStart] = useState('')
  const [hovered, setHovered] = useState<string|null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setStep(null) } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const calDays = useMemo(() => {
    const firstDow = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate()
    return [...Array(firstDow).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)]
  }, [viewYear, viewMonth])

  const ds = (day: number) => `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`

  const dayInRange = (d: string) => {
    if (step === 'end' && tempStart && hovered) {
      const s = tempStart < hovered ? tempStart : hovered
      const e = tempStart < hovered ? hovered : tempStart
      return d >= s && d <= e
    }
    return d >= value.start && d <= value.end
  }

  const handleDay = (day: number) => {
    const d = ds(day)
    if (!step || step === 'start') {
      setTempStart(d)
      setStep('end')
    } else {
      const s = tempStart < d ? tempStart : d
      const e = tempStart < d ? d : tempStart
      onChange({ start:s, end:e, label:'Personalizado' })
      setStep(null)
      setOpen(false)
    }
  }

  const prevM = () => { if (viewMonth===0){setViewYear(y=>y-1);setViewMonth(11)} else setViewMonth(m=>m-1) }
  const nextM = () => { if (viewMonth===11){setViewYear(y=>y+1);setViewMonth(0)} else setViewMonth(m=>m+1) }

  const displayLabel = () => {
    if (value.label !== 'Personalizado') return value.label
    const fmtD = (s: string) => new Date(s+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'})
    return `${fmtD(value.start)} — ${fmtD(value.end)}`
  }

  return (
    <div ref={ref} style={{ position:'relative', display:'inline-block' }}>
      <button onClick={()=>{ setOpen(o=>!o); setStep(null) }} style={{
        display:'flex', alignItems:'center', gap:8, padding:'9px 18px',
        borderRadius:10, background:open?'rgba(0,229,160,0.08)':C.card,
        border:`1px solid ${open?C.accent:C.border}`,
        color:C.text, fontSize:13, fontWeight:600, cursor:'pointer', transition:'all 0.15s',
      }}>
        <Calendar size={14} style={{color:C.accent}}/>
        {displayLabel()}
        <ChevronRight size={12} style={{color:C.textMuted, transform:open?'rotate(90deg)':'none', transition:'0.15s'}}/>
      </button>

      {open && (
        <div style={{
          position:'absolute', top:'100%', left:0, marginTop:6, zIndex:300,
          background:'#0D1526', border:`1px solid ${C.borderStrong}`,
          borderRadius:14, boxShadow:'0 24px 64px rgba(0,0,0,0.8)',
          display:'flex', overflow:'hidden',
        }}>
          {/* Presets */}
          <div style={{ width:176, borderRight:`1px solid ${C.border}`, padding:'12px 8px', display:'flex', flexDirection:'column', gap:2 }}>
            <p style={{ fontSize:9, fontWeight:800, color:C.textMuted, padding:'4px 10px', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>PERÍODOS RÁPIDOS</p>
            {PRESETS.map(p => {
              const active = value.label === p.label
              return (
                <button key={p.label} onClick={()=>{ onChange(p.fn()); setOpen(false); setStep(null) }} style={{
                  textAlign:'left', padding:'7px 10px', borderRadius:8, border:'none',
                  background:active?'rgba(0,229,160,0.12)':'transparent',
                  color:active?C.accent:C.textSub, fontSize:12, cursor:'pointer', fontWeight:active?600:400, transition:'all 0.1s',
                }}
                onMouseEnter={e=>{ if(!active)(e.currentTarget.style.background='rgba(255,255,255,0.05)') }}
                onMouseLeave={e=>{ if(!active)(e.currentTarget.style.background='transparent') }}>
                  {p.label}
                </button>
              )
            })}
          </div>

          {/* Calendar */}
          <div style={{ padding:18, minWidth:270 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <button onClick={prevM} style={{ background:'none', border:'none', cursor:'pointer', color:C.textSub, padding:4, borderRadius:6 }}><ChevronLeft size={16}/></button>
              <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{MONTHS_FULL[viewMonth]} {viewYear}</span>
              <button onClick={nextM} style={{ background:'none', border:'none', cursor:'pointer', color:C.textSub, padding:4, borderRadius:6 }}><ChevronRight size={16}/></button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
              {['D','S','T','Q','Q','S','S'].map((l,i)=>(
                <div key={i} style={{ textAlign:'center', fontSize:9, fontWeight:700, color:C.textMuted, padding:'3px 0' }}>{l}</div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
              {calDays.map((day,i)=>{
                if(!day) return <div key={i}/>
                const d = ds(day)
                const isStart = d === (step==='end'?tempStart:value.start)
                const isEnd   = d === value.end && step===null
                const inRng   = dayInRange(d)
                const isToday = d === isoDate(new Date())
                const hovd    = hovered === d
                return (
                  <button key={i} onClick={()=>handleDay(day)}
                    onMouseEnter={()=>setHovered(d)} onMouseLeave={()=>setHovered(null)}
                    style={{
                      aspectRatio:'1', borderRadius:6, border:'none', cursor:'pointer',
                      fontSize:11, fontWeight:(isStart||isEnd)?700:400,
                      background:isStart||isEnd?C.accent:inRng?'rgba(0,229,160,0.15)':hovd?'rgba(255,255,255,0.06)':'transparent',
                      color:isStart||isEnd?'#06080F':inRng?C.accent:isToday?C.accent:C.textSub,
                      outline:isToday&&!isStart&&!isEnd?`1px solid ${C.accent}40`:'none',
                      transition:'all 0.08s',
                    }}>
                    {day}
                  </button>
                )
              })}
            </div>
            {step==='end'
              ? <p style={{ marginTop:10, fontSize:11, color:C.accent, textAlign:'center' }}>Clique na data final</p>
              : <button onClick={()=>setStep('start')} style={{ marginTop:10, width:'100%', padding:'7px', borderRadius:8, border:`1px solid ${C.border}`, background:'transparent', color:C.textMuted, fontSize:11, cursor:'pointer' }}>Selecionar intervalo personalizado</button>
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MonthSelector ────────────────────────────────────────────────────────────
function MonthSelector({ value, onChange }: { value: string; onChange: (ym: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const [year, month] = value.split('-').map(Number)
  const [navYear, setNavYear] = useState(year)

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
        borderRadius:8, border:`1px solid ${open?C.accent:C.border}`,
        background:'rgba(255,255,255,0.03)', color:C.text, fontSize:11, fontWeight:600, cursor:'pointer', transition:'all 0.15s',
      }}>
        <Calendar size={10} style={{color:C.accent}}/>
        {MONTHS_SHORT[month-1]}/{String(year).slice(2)}
      </button>
      {open && (
        <div style={{ position:'absolute', top:'100%', right:0, marginTop:4, zIndex:200, background:'#0D1526', border:`1px solid ${C.borderStrong}`, borderRadius:12, padding:12, minWidth:210, boxShadow:'0 16px 48px rgba(0,0,0,0.7)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <button onClick={()=>setNavYear(y=>y-1)} style={{ background:'none', border:'none', cursor:'pointer', color:C.textSub, padding:2 }}><ChevronLeft size={14}/></button>
            <span style={{ fontSize:12, fontWeight:700, color:C.text }}>{navYear}</span>
            <button onClick={()=>setNavYear(y=>y+1)} style={{ background:'none', border:'none', cursor:'pointer', color:C.textSub, padding:2 }}><ChevronRight size={14}/></button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:3 }}>
            {MONTHS_SHORT.map((m, i)=>{
              const sel = navYear===year && i+1===month
              return (
                <button key={m} onClick={()=>{ onChange(`${navYear}-${String(i+1).padStart(2,'0')}`); setOpen(false) }} style={{
                  padding:'7px 4px', borderRadius:7, border:'none', cursor:'pointer',
                  background:sel?C.accent:'transparent', color:sel?'#06080F':C.textSub,
                  fontSize:11, fontWeight:sel?700:400, transition:'all 0.1s',
                }}
                onMouseEnter={e=>{ if(!sel)(e.currentTarget.style.background='rgba(255,255,255,0.06)') }}
                onMouseLeave={e=>{ if(!sel)(e.currentTarget.style.background='transparent') }}>
                  {m}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tooltip ────────────────────────────────────────────────────────────────
const Tt = ({ active, payload, label, showValues }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#0D1526', border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 14px', fontSize:12 }}>
      <p style={{ color:C.textMuted, marginBottom:6 }}>{label}</p>
      {payload.map((p: any, i: number)=>(
        <p key={i} style={{ color:p.color, fontWeight:600 }}>{p.name}: {showValues?fmt(p.value):'••••'}</p>
      ))}
    </div>
  )
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon: Icon, delta }: { label:string; value:string; sub:string; color:string; icon:any; delta?:number|null }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px', position:'relative', overflow:'hidden', transition:'border-color 0.2s' }}
      onMouseEnter={e=>(e.currentTarget.style.borderColor=C.borderStrong)}
      onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}>
      <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:`${color}08` }}/>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
        <p style={{ fontSize:11, fontWeight:500, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.07em' }}>{label}</p>
        <div style={{ width:32, height:32, borderRadius:9, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={15} style={{color}}/>
        </div>
      </div>
      <p style={{ fontSize:26, fontWeight:700, color:C.text, marginBottom:6, letterSpacing:-0.5 }}>{value}</p>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <p style={{ fontSize:12, color:C.textMuted }}>{sub}</p>
        {delta != null && (
          <span style={{ fontSize:11, fontWeight:600, padding:'1px 7px', borderRadius:20, background:delta>=0?'rgba(242,84,91,0.12)':'rgba(0,229,160,0.12)', color:delta>=0?C.red:C.green }}>
            {delta>=0?'↑':'↓'}{Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Ritmo de Gastos ─────────────────────────────────────────────────────────
function RhythmCard({ allTx, showValues }: { allTx:Transaction[]; showValues:boolean }) {
  const [selMonth, setSelMonth] = useState(toYM(new Date()))
  const [selY, selM] = selMonth.split('-').map(Number)
  const now = new Date()
  const isCurrent = selMonth === toYM(now)
  const dayOfMonth = isCurrent ? now.getDate() : new Date(selY,selM,0).getDate()
  const daysInMonth = new Date(selY,selM,0).getDate()

  const debits = useMemo(()=>allTx.filter(t=>{
    const d=new Date(`${t.date}T00:00:00`); return d.getFullYear()===selY && d.getMonth()+1===selM && isExpense(t)
  }),[allTx,selY,selM])

  const totalSpent = debits.reduce((s,t)=>s+txAmt(t),0)
  const dailyAvg   = dayOfMonth>0 ? totalSpent/dayOfMonth : 0
  const projected  = isCurrent ? dailyAvg*daysInMonth : totalSpent
  const progress   = Math.min((dayOfMonth/daysInMonth)*100,100)
  const tempo = dailyAvg>200?'Alto':dailyAvg>80?'Moderado':'Baixo'
  const tColor = dailyAvg>200?C.red:dailyAvg>80?C.yellow:C.green

  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <div style={{ width:34, height:34, borderRadius:9, background:'rgba(245,166,35,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Flame size={16} style={{color:C.yellow}}/>
        </div>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:13, fontWeight:600, color:C.text }}>Ritmo de Gastos</p>
          <p style={{ fontSize:11, color:C.textMuted }}>{isCurrent?`Dia ${dayOfMonth} de ${daysInMonth}`:'Mês completo'}</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:20, background:`${tColor}15`, color:tColor }}>{tempo}</span>
          <MonthSelector value={selMonth} onChange={setSelMonth}/>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
        {[
          {label:'Total gasto', val:showValues?fmt(totalSpent):'••••', color:C.text},
          {label:isCurrent?'Projeção mensal':'Média diária', val:showValues?(isCurrent?fmt(projected):fmtK(dailyAvg)):'••••', color:isCurrent&&projected>totalSpent*1.2?C.yellow:C.text},
        ].map(k=>(
          <div key={k.label} style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'10px 12px' }}>
            <p style={{ fontSize:10, color:C.textMuted, marginBottom:4 }}>{k.label}</p>
            <p style={{ fontSize:16, fontWeight:700, color:k.color }}>{k.val}</p>
          </div>
        ))}
      </div>
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <span style={{ fontSize:11, color:C.textMuted }}>Progresso do mês</span>
          <span style={{ fontSize:11, color:C.textSub }}>{progress.toFixed(0)}%</span>
        </div>
        <div style={{ height:5, background:'rgba(255,255,255,0.06)', borderRadius:99, overflow:'hidden' }}>
          <div style={{ width:`${progress}%`, height:'100%', background:`linear-gradient(90deg,${tColor},${tColor}80)`, borderRadius:99, transition:'width 0.8s ease' }}/>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
          <span style={{ fontSize:11, fontWeight:600, color:tColor }}>{showValues?fmt(totalSpent):'•••••'}</span>
          <span style={{ fontSize:11, color:C.textMuted }}>{isCurrent?`${daysInMonth-dayOfMonth} dias restantes`:`${debits.length} transações`}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Comparativo Mensal ──────────────────────────────────────────────────────
function MonthCompareCard({ allTx, showValues }: { allTx:Transaction[]; showValues:boolean }) {
  const now = new Date()
  const [mA, setMA] = useState(toYM(new Date(now.getFullYear(),now.getMonth()-1,1)))
  const [mB, setMB] = useState(toYM(now))

  const sumM = (ym: string) => {
    const [y,m] = ym.split('-').map(Number)
    return allTx.filter(t=>{ const d=new Date(`${t.date}T00:00:00`); return d.getFullYear()===y && d.getMonth()+1===m && isExpense(t) }).reduce((s,t)=>s+txAmt(t),0)
  }

  const valA = useMemo(()=>sumM(mA),[allTx,mA])
  const valB = useMemo(()=>sumM(mB),[allTx,mB])
  const diff = valB-valA
  const dp   = valA>0?pctDiff(valB,valA):0
  const isUp = diff>0
  const [yA,moA]=mA.split('-').map(Number), [yB,moB]=mB.split('-').map(Number)

  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <div style={{ width:34, height:34, borderRadius:9, background:'rgba(59,139,245,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <BarChart2 size={16} style={{color:C.accentBlue}}/>
        </div>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:13, fontWeight:600, color:C.text }}>Comparativo Mensal</p>
          <p style={{ fontSize:11, color:C.textMuted }}>Compare gastos entre dois meses</p>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
        {[
          {label:`${MONTHS_SHORT[moA-1]}/${String(yA).slice(2)}`, val:showValues?fmtK(valA):'••••', ym:mA, set:setMA, color:C.textSub},
          {label:`${MONTHS_SHORT[moB-1]}/${String(yB).slice(2)}`, val:showValues?fmtK(valB):'••••', ym:mB, set:setMB, color:C.text},
        ].map(k=>(
          <div key={k.ym} style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'10px 12px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
              <p style={{ fontSize:10, color:C.textMuted }}>{k.label}</p>
              <MonthSelector value={k.ym} onChange={k.set}/>
            </div>
            <p style={{ fontSize:16, fontWeight:700, color:k.color }}>{k.val}</p>
          </div>
        ))}
      </div>
      {(valA>0||valB>0) ? (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:isUp?'rgba(242,84,91,0.08)':'rgba(0,229,160,0.08)', borderRadius:10, border:`1px solid ${isUp?'rgba(242,84,91,0.2)':'rgba(0,229,160,0.2)'}` }}>
          {isUp ? <TrendingUp size={15} style={{color:C.red,flexShrink:0}}/> : <TrendingDown size={15} style={{color:C.green,flexShrink:0}}/>}
          <p style={{ fontSize:13, fontWeight:600, color:isUp?C.red:C.green }}>
            {valA===0?'Sem dados anteriores':`${isUp?'+':''}${dp.toFixed(1)}% ${isUp?'mais gastos':'economizado'}`}
            {showValues&&valA>0&&<span style={{color:C.textMuted,fontWeight:400}}> · {isUp?'+':''}{fmt(diff)}</span>}
          </p>
        </div>
      ) : (
        <p style={{ fontSize:12, color:C.textMuted, textAlign:'center', padding:'8px 0' }}>Sem dados disponíveis</p>
      )}
    </div>
  )
}

// ─── Mapa de Gastos (Heatmap com seletor de mês) ────────────────────────────
function HeatmapCalendar({ allTx, showValues }: { allTx:Transaction[]; showValues:boolean }) {
  const [selMonth, setSelMonth] = useState(toYM(new Date()))
  const [selY,selM] = selMonth.split('-').map(Number)
  const daysInMonth = new Date(selY,selM,0).getDate()
  const firstDow    = new Date(selY,selM-1,1).getDay()
  const today = new Date()
  const isCurrent = selMonth === toYM(today)

  const daily = useMemo(()=>{
    const map: Record<string,number> = {}
    allTx.filter(t=>isExpense(t)&&t.date.startsWith(selMonth)).forEach(t=>{ map[t.date]=(map[t.date]??0)+txAmt(t) })
    return map
  },[allTx,selMonth])

  const maxVal = Math.max(...Object.values(daily),1)
  const cells: (number|null)[] = [...Array(firstDow).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)]

  const getColor = (s: number) => {
    if(!s) return 'rgba(255,255,255,0.04)'
    const r=s/maxVal
    if(r<0.25) return 'rgba(0,229,160,0.18)'
    if(r<0.5)  return 'rgba(0,229,160,0.38)'
    if(r<0.75) return 'rgba(0,229,160,0.62)'
    return '#00E5A0'
  }

  const topDays = Object.entries(daily).sort((a,b)=>b[1]-a[1]).slice(0,3)

  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:9, background:'rgba(0,229,160,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Calendar size={16} style={{color:C.accent}}/>
          </div>
          <div>
            <p style={{ fontSize:13, fontWeight:600, color:C.text }}>Mapa de Gastos do Mês</p>
            <p style={{ fontSize:11, color:C.textMuted }}>Intensidade por dia · {MONTHS_FULL[selM-1]} {selY}</p>
          </div>
        </div>
        <MonthSelector value={selMonth} onChange={setSelMonth}/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:24, alignItems:'start' }}>
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:4 }}>
            {['D','S','T','Q','Q','S','S'].map((l,i)=>(
              <div key={i} style={{ textAlign:'center', fontSize:9, color:C.textMuted, fontWeight:600 }}>{l}</div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
            {cells.map((day,i)=>{
              if(!day) return <div key={i}/>
              const ds = `${selY}-${String(selM).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const spend = daily[ds]??0
              const isT = isCurrent && day===today.getDate()
              return (
                <div key={i} title={spend>0?(showValues?`${day}: ${fmt(spend)}`:`${day}: ••••`):String(day)}
                  style={{ aspectRatio:'1', borderRadius:4, background:getColor(spend), border:isT?`1.5px solid ${C.accent}`:'1px solid transparent', cursor:spend>0?'pointer':'default', transition:'transform 0.1s' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.transform='scale(1.3)'}
                  onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.transform='scale(1)'}/>
              )
            })}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:10, justifyContent:'flex-end' }}>
            <span style={{ fontSize:9, color:C.textMuted }}>Menos</span>
            {['rgba(255,255,255,0.04)','rgba(0,229,160,0.18)','rgba(0,229,160,0.38)','rgba(0,229,160,0.62)','#00E5A0'].map((c,i)=>(
              <div key={i} style={{ width:10, height:10, borderRadius:2, background:c }}/>
            ))}
            <span style={{ fontSize:9, color:C.textMuted }}>Mais</span>
          </div>
        </div>
        {topDays.length>0 && (
          <div style={{ minWidth:130 }}>
            <p style={{ fontSize:9, fontWeight:800, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Top dias</p>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {topDays.map(([d,v],idx)=>{
                const dayNum = new Date(`${d}T00:00:00`).getDate()
                return (
                  <div key={d} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:'rgba(255,255,255,0.03)', borderRadius:9 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:idx===0?C.red:idx===1?C.yellow:C.textSub, minWidth:14 }}>{dayNum}</span>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:10, color:C.textMuted }}>{new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR',{weekday:'short'})}</p>
                      <p style={{ fontSize:11, fontWeight:600, color:C.text }}>{showValues?fmtK(v):'••••'}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Detectar assinaturas ────────────────────────────────────────────────────
interface SubDetected { description:string; amount:number; nextDate:string; status:'active'|'late' }

function detectSubs(txs: Transaction[]): SubDetected[] {
  const grouped: Record<string,Transaction[]> = {}
  txs.filter(isExpense).forEach(t=>{
    const k=t.description.toLowerCase().trim().replace(/\s+/g,' ')
    if(!grouped[k]) grouped[k]=[]
    grouped[k].push(t)
  })
  return Object.values(grouped).flatMap(ts=>{
    if(ts.length<2) return []
    const sorted=[...ts].sort((a,b)=>a.date.localeCompare(b.date))
    const amounts=sorted.map(t=>txAmt(t))
    const avg=amounts.reduce((s,v)=>s+v,0)/amounts.length
    if(!amounts.every(a=>Math.abs(a-avg)<avg*0.12)) return []
    const dates=sorted.map(t=>new Date(t.date))
    const gaps: number[]=[]
    for(let i=1;i<dates.length;i++) gaps.push((dates[i].getTime()-dates[i-1].getTime())/86400000)
    const avgGap=gaps.reduce((s,v)=>s+v,0)/gaps.length
    if(avgGap<25||avgGap>40) return []
    const last=new Date(sorted[sorted.length-1].date)
    const next=new Date(last); next.setDate(next.getDate()+Math.round(avgGap))
    const daysLeft=(next.getTime()-Date.now())/86400000
    return [{ description:sorted[0].description, amount:avg, nextDate:next.toISOString().substring(0,10), status:(daysLeft<-5?'late':'active') as 'active'|'late' }]
  }).sort((a,b)=>b.amount-a.amount)
}

// ─── Detectar parcelamentos ──────────────────────────────────────────────────
interface InstItem { description:string; monthly:number; paid:number; total:number; remaining:number }

function detectInstallments(txs: Transaction[]): InstItem[] {
  const REGEX=/(\d+)\s*[\/\-]\s*(\d+)/
  const groups: Record<string,Transaction[]> = {}
  txs.filter(isExpense).forEach(t=>{
    if(!REGEX.test(t.description)) return
    const k=t.description.replace(REGEX,'').toLowerCase().trim()
    if(!groups[k]) groups[k]=[]
    groups[k].push(t)
  })
  return Object.values(groups).flatMap(ts=>{
    if(!ts.length) return []
    const sorted=[...ts].sort((a,b)=>a.date.localeCompare(b.date))
    const m=sorted[0].description.match(REGEX)
    if(!m) return []
    const total=parseInt(m[2])
    if(total<=1) return []
    const monthly=txAmt(sorted[0])
    const paid=sorted.length
    const remaining=(total-paid)*monthly
    return [{ description:sorted[0].description.replace(REGEX,'').trim(), monthly, paid, total, remaining }]
  }).sort((a,b)=>b.remaining-a.remaining).slice(0,5)
}

// ─── Dashboard principal ─────────────────────────────────────────────────────
export default function Dashboard() {
  const { cols } = useResponsive()
  const [allTx, setAllTx]       = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showValues, setShowValues] = useState(true)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]       = useState('')
  const [retries, setRetries]   = useState(0)
  const [period, setPeriod]     = useState<PeriodRange>(()=>PRESETS.find(p=>p.label==='Este mês')!.fn())

  const loadData = useCallback(async (isRefresh=false) => {
    try {
      isRefresh?setRefreshing(true):setLoading(true)
      setError('')
      const {data:{user}} = await supabase.auth.getUser()
      if(!user) throw new Error('Sessão expirada. Faça login novamente.')
      const headers = await getUserAuthHeaders()
      const base = import.meta.env.VITE_SUPABASE_URL as string
      const [txR,accR] = await Promise.all([
        fetch(`${base}/rest/v1/transactions?user_id=eq.${user.id}&order=date.desc&limit=1000`,{headers}),
        fetch(`${base}/rest/v1/accounts?user_id=eq.${user.id}&select=*`,{headers}),
      ])
      if(!txR.ok||!accR.ok) throw new Error('Falha ao carregar dados do servidor.')
      const [txData,accData] = await Promise.all([txR.json(),accR.json()])
      setAllTx((txData??[]) as Transaction[])
      setAccounts((accData??[]) as Account[])
    } catch(e:any) {
      setError(e.message??'Erro inesperado.')
    } finally {
      setLoading(false); setRefreshing(false)
    }
  },[])

  useEffect(()=>{ loadData() },[loadData,retries])

  // ── Período filtrado ────────────────────────────────────────────────────────
  const periodTx = useMemo(()=>allTx.filter(t=>t.date>=period.start&&t.date<=period.end),[allTx,period])

  // ── Stats PRECISOS — crédito ≠ despesa ─────────────────────────────────────
  const stats = useMemo(()=>{
    const income   = periodTx.filter(isIncome).reduce((s,t)=>s+txAmt(t),0)
    const expenses = periodTx.filter(isExpense).reduce((s,t)=>s+txAmt(t),0)
    return { income, expenses, balance:income-expenses, incCount:periodTx.filter(isIncome).length, expCount:periodTx.filter(isExpense).length }
  },[periodTx])

  // ── Delta vs período anterior equivalente ───────────────────────────────────
  const prevExpenses = useMemo(()=>{
    const diffMs = new Date(period.end).getTime()-new Date(period.start).getTime()
    const pe = new Date(new Date(period.start).getTime()-86400000)
    const ps = new Date(pe.getTime()-diffMs)
    const s=isoDate(ps), e=isoDate(pe)
    return allTx.filter(t=>t.date>=s&&t.date<=e&&isExpense(t)).reduce((s,t)=>s+txAmt(t),0)
  },[allTx,period])
  const expDelta = prevExpenses>0 ? pctDiff(stats.expenses,prevExpenses) : null

  // ── Categorias (só débitos) ─────────────────────────────────────────────────
  const categories = useMemo(()=>{
    const map: Record<string,number>={}
    periodTx.filter(isExpense).forEach(t=>{ const c=t.category??'Outros'; map[c]=(map[c]??0)+txAmt(t) })
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,value])=>({name,value}))
  },[periodTx])
  const totalCatAmt = categories.reduce((s,c)=>s+c.value,0)

  // ── Cashflow ────────────────────────────────────────────────────────────────
  const cashflow = useMemo(()=>{
    const diffD = Math.ceil((new Date(period.end).getTime()-new Date(period.start).getTime())/86400000)+1
    if(diffD>90){
      const mm: Record<string,{in:number;out:number}>={}
      periodTx.forEach(t=>{ const k=t.date.substring(0,7); if(!mm[k]) mm[k]={in:0,out:0}; if(isIncome(t)) mm[k].in+=txAmt(t); else if(isExpense(t)) mm[k].out+=txAmt(t) })
      return Object.entries(mm).sort((a,b)=>a[0].localeCompare(b[0])).map(([mo,v])=>({ day:new Date(`${mo}-01T00:00:00`).toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}), Receitas:v.in, Despesas:v.out }))
    }
    const dm: Record<string,{in:number;out:number}>={}
    for(let i=0;i<diffD;i++){ const d=new Date(new Date(period.start+'T00:00:00')); d.setDate(d.getDate()+i); dm[isoDate(d)]={in:0,out:0} }
    periodTx.forEach(t=>{ if(!dm[t.date]) return; if(isIncome(t)) dm[t.date].in+=txAmt(t); else if(isExpense(t)) dm[t.date].out+=txAmt(t) })
    return Object.entries(dm).map(([d,v])=>({ day:new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}), Receitas:v.in, Despesas:v.out }))
  },[periodTx,period])

  // ── Contas ──────────────────────────────────────────────────────────────────
  const checkingAccs = useMemo(()=>accounts.filter(a=>a.is_active&&a.type!=='credit'),[accounts])
  const creditAccs   = useMemo(()=>accounts.filter(a=>a.is_active&&a.type==='credit'),[accounts])
  const checkBal     = useMemo(()=>checkingAccs.reduce((s,a)=>s+Number(a.balance||0),0),[checkingAccs])
  const creditAvail  = useMemo(()=>creditAccs.reduce((s,a)=>s+Number(a.balance||0),0),[creditAccs])

  // ── Assinaturas e parcelamentos ─────────────────────────────────────────────
  const subs = useMemo(()=>detectSubs(allTx),[allTx])
  const subsTotal = subs.reduce((s,sub)=>s+sub.amount,0)
  const installs  = useMemo(()=>detectInstallments(allTx),[allTx])
  const installsTotal = installs.reduce((s,i)=>s+i.remaining,0)

  // ── Por conta ───────────────────────────────────────────────────────────────
  const cardStats = useMemo(()=>accounts.filter(a=>a.is_active).map(acc=>{
    const ax=periodTx.filter(t=>t.account_id===acc.id)
    return { ...acc, spent:ax.filter(isExpense).reduce((s,t)=>s+txAmt(t),0), received:ax.filter(isIncome).reduce((s,t)=>s+txAmt(t),0), txCount:ax.length }
  }).filter(a=>a.txCount>0),[accounts,periodTx])

  // ── Transações recentes ────────────────────────────────────────────────────
  const recentTx = useMemo(()=>[...periodTx].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12),[periodTx])

  // ── Histórico mensal para AIChat ───────────────────────────────────────────
  const historicalMonths = useMemo(()=>{
    const map: Record<string,{income:number;expenses:number}> = {}
    allTx.forEach(t=>{
      const ym = t.date.substring(0,7)
      if (!map[ym]) map[ym]={income:0,expenses:0}
      if (isIncome(t))   map[ym].income   += txAmt(t)
      if (isExpense(t))  map[ym].expenses += txAmt(t)
    })
    return Object.entries(map)
      .sort((a,b)=>a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([ym,v])=>{
        const [y,m] = ym.split('-').map(Number)
        return { month: `${MONTHS_SHORT[m-1]}/${String(y).slice(2)}`, income:v.income, expenses:v.expenses }
      })
  },[allTx])

  const hasData = allTx.length>0
  const now = new Date()

  if(loading) return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div>
          <div style={{ height:28, width:160, background:'rgba(255,255,255,0.06)', borderRadius:8, marginBottom:8 }}/>
          <div style={{ height:14, width:200, background:'rgba(255,255,255,0.04)', borderRadius:6 }}/>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {[1,2].map(i=><div key={i} style={{ height:36, width:120, background:'rgba(255,255,255,0.06)', borderRadius:8 }}/>)}
        </div>
      </div>
      <div style={{ height:44, width:320, background:'rgba(255,255,255,0.04)', borderRadius:12 }}/>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
        {[1,2,3].map(i=><div key={i} style={{ height:120, background:'rgba(255,255,255,0.04)', borderRadius:16 }}/>)}
      </div>
      <div style={{ height:260, background:'rgba(255,255,255,0.04)', borderRadius:16 }}/>
      <div style={{ display:'grid', gridTemplateColumns:cols({xs:1,sm:2}), gap:16 }}>
        {[1,2,3,4].map(i=><div key={i} style={{ height:180, background:'rgba(255,255,255,0.04)', borderRadius:16 }}/>)}
      </div>
    </div>
  )

  return (
    <div style={{ color:C.text, fontFamily:'system-ui,sans-serif', maxWidth:1400 }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:700, color:C.text, margin:0, letterSpacing:-0.5 }}>Dashboard</h1>
          <p style={{ color:C.textMuted, fontSize:13, marginTop:4, textTransform:'capitalize' }}>
            {now.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>loadData(true)} disabled={refreshing}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:C.card, border:`1px solid ${C.border}`, borderRadius:10, color:C.textSub, fontSize:12, cursor:'pointer' }}>
            <RefreshCw size={13} style={{ animation:refreshing?'spin 1s linear infinite':'none' }}/>
            {refreshing?'Atualizando...':'Atualizar'}
          </button>
          <button onClick={()=>setShowValues(v=>!v)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:C.card, border:`1px solid ${C.border}`, borderRadius:10, color:C.textSub, fontSize:12, cursor:'pointer' }}>
            {showValues?<EyeOff size={13}/>:<Eye size={13}/>}
            {showValues?'Ocultar':'Mostrar'}
          </button>
        </div>
      </div>

      {/* ── Seletor Calendário ── */}
      <div style={{ marginBottom:24 }}>
        <CalendarPicker value={period} onChange={setPeriod}/>
      </div>

      {/* ── Erro ── */}
      {error && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'rgba(242,84,91,0.08)', border:'1px solid rgba(242,84,91,0.2)', borderRadius:12, marginBottom:20 }}>
          <AlertCircle size={16} style={{color:C.red,flexShrink:0}}/>
          <p style={{ color:C.red, fontSize:13, flex:1 }}>{error}</p>
          <button onClick={()=>setRetries(r=>r+1)} style={{ fontSize:12, color:C.red, background:'rgba(242,84,91,0.12)', border:'none', borderRadius:7, padding:'4px 12px', cursor:'pointer', fontWeight:600 }}>Tentar novamente</button>
        </div>
      )}

      {/* ── KPIs PRECISOS ── */}
      <div style={{ display:'grid', gridTemplateColumns:cols({xs:1,sm:1,md:3}), gap:16, marginBottom:20 }}>
        <KpiCard label="Saldo do Período" value={showValues?fmt(stats.balance):'•••••'} sub={stats.balance>=0?'Resultado positivo ✓':'Resultado negativo'} color={stats.balance>=0?C.green:C.red} icon={Wallet}/>
        <KpiCard label="Total de Receitas" value={showValues?fmt(stats.income):'•••••'} sub={`${stats.incCount} créditos no período`} color={C.accentBlue} icon={TrendingUp}/>
        <KpiCard label="Total de Despesas" value={showValues?fmt(stats.expenses):'•••••'} sub={`${stats.expCount} débitos no período`} color={C.red} icon={TrendingDown} delta={expDelta}/>
      </div>

      {/* ── Saldo real das contas (dados em tempo real via Pluggy) ── */}
      {accounts.length>0 && (
        <div style={{ display:'grid', gridTemplateColumns:creditAccs.length>0?cols({xs:1,md:2}):'1fr', gap:16, marginBottom:20 }}>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <div style={{ width:34, height:34, borderRadius:9, background:'rgba(59,139,245,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Wallet size={16} style={{color:C.accentBlue}}/>
              </div>
              <div>
                <p style={{ fontSize:13, fontWeight:600, color:C.text }}>Saldo em Conta</p>
                <p style={{ fontSize:11, color:C.textMuted }}>{checkingAccs.length} conta(s) · atualizado via Open Finance</p>
              </div>
            </div>
            <p style={{ fontSize:28, fontWeight:700, color:checkBal>=0?C.green:C.red, marginBottom:10, letterSpacing:-0.5 }}>
              {showValues?fmt(checkBal):'•••••'}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {checkingAccs.map(a=>(
                <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:'rgba(255,255,255,0.03)', borderRadius:8 }}>
                  <span style={{ fontSize:12, color:C.textSub }}>{a.bank_name}</span>
                  <span style={{ fontSize:12, fontWeight:600, color:Number(a.balance||0)>=0?C.text:C.red }}>{showValues?fmt(Number(a.balance||0)):'••••'}</span>
                </div>
              ))}
            </div>
          </div>

          {creditAccs.length>0 && (
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                <div style={{ width:34, height:34, borderRadius:9, background:'rgba(167,139,250,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <CreditCard size={16} style={{color:C.purple}}/>
                </div>
                <div>
                  <p style={{ fontSize:13, fontWeight:600, color:C.text }}>Limite Disponível</p>
                  <p style={{ fontSize:11, color:C.textMuted }}>{creditAccs.length} cartão(ões) · saldo real via Open Finance</p>
                </div>
              </div>
              <p style={{ fontSize:28, fontWeight:700, color:C.purple, marginBottom:10, letterSpacing:-0.5 }}>
                {showValues?fmt(creditAvail):'•••••'}
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {creditAccs.map(a=>(
                  <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:'rgba(255,255,255,0.03)', borderRadius:8 }}>
                    <div>
                      <span style={{ fontSize:12, color:C.textSub }}>{a.bank_name}</span>
                      <span style={{ fontSize:10, color:C.textMuted, marginLeft:6 }}>Cartão de Crédito</span>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <p style={{ fontSize:12, fontWeight:600, color:C.purple }}>{showValues?fmt(Number(a.balance||0)):'••••'}</p>
                      <p style={{ fontSize:9, color:C.textMuted }}>disponível</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!hasData ? (
        <div style={{ background:C.card, border:`1px dashed ${C.border}`, borderRadius:16, padding:'64px 24px', textAlign:'center' }}>
          <div style={{ width:56, height:56, borderRadius:16, background:'rgba(255,255,255,0.04)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <Wallet size={24} style={{color:C.textMuted}}/>
          </div>
          <p style={{ color:C.text, fontWeight:600, marginBottom:8 }}>Nenhuma transação encontrada</p>
          <p style={{ color:C.textMuted, fontSize:13 }}>Conecte seu banco em "Conectar Banco" para importar suas transações automaticamente.</p>
        </div>
      ) : (
        <>
          {/* ── Fluxo de Caixa ── */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px', marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
              <div>
                <p style={{ fontWeight:600, color:C.text, marginBottom:3 }}>Fluxo de Caixa</p>
                <p style={{ fontSize:11, color:C.textMuted }}>Receitas vs Despesas · {period.label}</p>
              </div>
              <div style={{ display:'flex', gap:16 }}>
                {[{color:C.green,label:'Receitas'},{color:C.red,label:'Despesas'}].map(l=>(
                  <div key={l.label} style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:l.color }}/>
                    <span style={{ fontSize:11, color:C.textMuted }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={cashflow} margin={{top:10,right:10,left:-10,bottom:0}}>
                <defs>
                  {[{id:'gE',c:C.green},{id:'gS',c:C.red}].map(g=>(
                    <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={g.c} stopOpacity={0.25}/>
                      <stop offset="95%" stopColor={g.c} stopOpacity={0}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                <XAxis dataKey="day" tick={{fontSize:10,fill:C.textMuted}} axisLine={false} tickLine={false} interval={cashflow.length>30?Math.floor(cashflow.length/10):'preserveStartEnd'}/>
                <YAxis tickFormatter={fmtK} tick={{fontSize:10,fill:C.textMuted}} axisLine={false} tickLine={false}/>
                <Tooltip content={<Tt showValues={showValues}/>}/>
                <Area type="monotone" dataKey="Receitas" stroke={C.green} strokeWidth={2} fill="url(#gE)" dot={false}/>
                <Area type="monotone" dataKey="Despesas" stroke={C.red}   strokeWidth={2} fill="url(#gS)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── Ritmo + Comparativo ── */}
          <div style={{ display:'grid', gridTemplateColumns:cols({xs:1,md:2}), gap:16, marginBottom:20 }}>
            <RhythmCard allTx={allTx} showValues={showValues}/>
            <MonthCompareCard allTx={allTx} showValues={showValues}/>
          </div>

          {/* ── Mapa de Gastos ── */}
          <div style={{ marginBottom:20 }}>
            <HeatmapCalendar allTx={allTx} showValues={showValues}/>
          </div>

          {/* ── Espelho: Categorias ── */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px', marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div>
                <p style={{ fontWeight:600, color:C.text }}>Categorias de Gastos</p>
                <p style={{ fontSize:11, color:C.textMuted }}>Somente débitos · {period.label}</p>
              </div>
              <span style={{ fontSize:11, color:C.textMuted, background:'rgba(255,255,255,0.04)', padding:'3px 10px', borderRadius:20, border:`1px solid ${C.border}` }}>{categories.length} categorias</span>
            </div>
            {categories.length===0 ? (
              <p style={{ color:C.textMuted, textAlign:'center', padding:'32px 0', fontSize:13 }}>Sem despesas neste período</p>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:cols({xs:1,md:2}), gap:20 }}>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={categories} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {categories.map((_,i)=><Cell key={i} fill={C.PALETTE[i%C.PALETTE.length]} stroke="transparent"/>)}
                    </Pie>
                    <Tooltip formatter={(v:number)=>showValues?fmt(v):'••••'} contentStyle={{background:'#0D1526',border:`1px solid ${C.border}`,borderRadius:8,fontSize:12}}/>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display:'flex', flexDirection:'column', gap:8, justifyContent:'center' }}>
                  {categories.slice(0,6).map((cat,i)=>(
                    <div key={cat.name} style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ width:8, height:8, borderRadius:'50%', background:C.PALETTE[i%C.PALETTE.length], flexShrink:0 }}/>
                      <span style={{ fontSize:12, color:C.textSub, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cat.name}</span>
                      <div style={{ width:50, height:3, background:'rgba(255,255,255,0.06)', borderRadius:99, overflow:'hidden', marginRight:6 }}>
                        <div style={{ width:`${totalCatAmt>0?(cat.value/totalCatAmt*100):0}%`, height:'100%', background:C.PALETTE[i%C.PALETTE.length], borderRadius:99 }}/>
                      </div>
                      <span style={{ fontSize:11, fontWeight:700, color:C.text, minWidth:52, textAlign:'right' }}>{showValues?fmtK(cat.value):'••'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Espelho: Cartões por conta ── */}
          {cardStats.length>0 && (
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px', marginBottom:20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <div>
                  <p style={{ fontWeight:600, color:C.text }}>Desempenho por Conta</p>
                  <p style={{ fontSize:11, color:C.textMuted }}>Gastos e receitas por instituição · {period.label}</p>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:cols({xs:1,sm:2,md:3}), gap:12 }}>
                {cardStats.map((acc,i)=>(
                  <div key={acc.id} style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${C.border}`, borderRadius:12, padding:'14px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                      <div style={{ width:32, height:32, borderRadius:9, background:`${C.PALETTE[i%C.PALETTE.length]}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <CreditCard size={14} style={{color:C.PALETTE[i%C.PALETTE.length]}}/>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:12, fontWeight:600, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{acc.bank_name}</p>
                        <p style={{ fontSize:10, color:C.textMuted }}>{acc.type} · {acc.txCount} tx</p>
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      <div>
                        <p style={{ fontSize:9, color:C.textMuted, marginBottom:2 }}>Gastos</p>
                        <p style={{ fontSize:13, fontWeight:700, color:C.red }}>{showValues?fmt(acc.spent):'••••'}</p>
                      </div>
                      <div>
                        <p style={{ fontSize:9, color:C.textMuted, marginBottom:2 }}>Receitas</p>
                        <p style={{ fontSize:13, fontWeight:700, color:C.green }}>{showValues?fmt(acc.received):'••••'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Espelho: Assinaturas ── */}
          {subs.length>0 && (
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, overflow:'hidden', marginBottom:20 }}>
              <div style={{ padding:'18px 24px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <p style={{ fontWeight:600, color:C.text }}>Assinaturas Detectadas</p>
                  <p style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>Cobranças recorrentes identificadas nos débitos</p>
                </div>
                <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                  <div style={{ textAlign:'right' }}>
                    <p style={{ fontSize:10, color:C.textMuted }}>Total mensal</p>
                    <p style={{ fontSize:14, fontWeight:700, color:C.red }}>{showValues?fmt(subsTotal):'••••'}</p>
                  </div>
                  <span style={{ fontSize:11, color:C.textMuted, background:'rgba(255,255,255,0.04)', padding:'3px 10px', borderRadius:20, border:`1px solid ${C.border}` }}>{subs.length} detectadas</span>
                </div>
              </div>
              {subs.slice(0,5).map((sub,i)=>{
                const next=new Date(sub.nextDate)
                const dl=Math.round((next.getTime()-Date.now())/86400000)
                const late=sub.status==='late'
                const dc=late?C.red:dl<=5?C.yellow:C.textMuted
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', padding:'12px 24px', borderBottom:`1px solid rgba(255,255,255,0.02)`, gap:12, transition:'background 0.1s' }}
                    onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <div style={{ width:36, height:36, borderRadius:10, flexShrink:0, background:late?'rgba(242,84,91,0.1)':'rgba(0,229,160,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {late?<AlertCircle size={16} style={{color:C.red}}/>:<CheckCircle size={16} style={{color:C.green}}/>}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, fontWeight:500, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sub.description}</p>
                      <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
                        <Clock size={10} style={{color:dc}}/>
                        <p style={{ fontSize:11, color:dc }}>{late?'Atrasada':dl===0?'Vence hoje':dl<0?`${Math.abs(dl)}d atrás`:`em ${dl}d`}</p>
                      </div>
                    </div>
                    <p style={{ fontSize:14, fontWeight:700, color:C.text, flexShrink:0 }}>
                      {showValues?fmt(sub.amount):'••••'}<span style={{ fontSize:10, color:C.textMuted, marginLeft:2 }}>/mês</span>
                    </p>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Espelho: Parcelamentos ── */}
          {installs.length>0 && (
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, overflow:'hidden', marginBottom:20 }}>
              <div style={{ padding:'18px 24px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <p style={{ fontWeight:600, color:C.text }}>Parcelamentos em Aberto</p>
                  <p style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>Detectados pelo padrão "X/Y" nos débitos</p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ fontSize:10, color:C.textMuted }}>Total restante</p>
                  <p style={{ fontSize:14, fontWeight:700, color:C.yellow }}>{showValues?fmt(installsTotal):'••••'}</p>
                </div>
              </div>
              {installs.map((inst,i)=>{
                const pct=inst.total>0?(inst.paid/inst.total*100):0
                return (
                  <div key={i} style={{ padding:'12px 24px', borderBottom:`1px solid rgba(255,255,255,0.02)`, display:'flex', alignItems:'center', gap:16, transition:'background 0.1s' }}
                    onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, fontWeight:500, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inst.description||'Parcelamento'}</p>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
                        <div style={{ flex:1, height:4, background:'rgba(255,255,255,0.06)', borderRadius:99, overflow:'hidden' }}>
                          <div style={{ width:`${pct}%`, height:'100%', background:C.accent, borderRadius:99, transition:'width 0.5s ease' }}/>
                        </div>
                        <span style={{ fontSize:10, color:C.textMuted, whiteSpace:'nowrap' }}>{inst.paid}/{inst.total} pagas</span>
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <p style={{ fontSize:11, color:C.textMuted }}>Mensal</p>
                      <p style={{ fontSize:13, fontWeight:700, color:C.text }}>{showValues?fmt(inst.monthly):'••••'}</p>
                      <p style={{ fontSize:10, color:C.yellow }}>Resta: {showValues?fmt(inst.remaining):'••••'}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Categorias (bar) + Transações recentes ── */}
          <div style={{ display:'grid', gridTemplateColumns:cols({xs:1,lg:2}), gap:16, marginBottom:20 }}>
            {categories.length>0 && (
              <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px' }}>
                <p style={{ fontWeight:600, color:C.text, marginBottom:3 }}>Top Categorias</p>
                <p style={{ fontSize:11, color:C.textMuted, marginBottom:20 }}>{period.label}</p>
                <ResponsiveContainer width="100%" height={Math.max(categories.length*34,120)}>
                  <BarChart data={categories} layout="vertical" margin={{top:0,right:80,left:0,bottom:0}}>
                    <XAxis type="number" hide/>
                    <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:C.textSub}} axisLine={false} tickLine={false} width={110}/>
                    <Tooltip formatter={(v:number)=>showValues?fmt(v):'••••'} contentStyle={{background:'#0D1526',border:`1px solid ${C.border}`,borderRadius:8,fontSize:12}}/>
                    <Bar dataKey="value" name="Gasto" radius={[0,6,6,0]} label={{position:'right',formatter:(v:number)=>showValues?fmtK(v):'••',fontSize:11,fill:C.textMuted}}>
                      {categories.map((_,i)=><Cell key={i} fill={C.PALETTE[i%C.PALETTE.length]}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, overflow:'hidden' }}>
              <div style={{ padding:'20px 24px 14px' }}>
                <p style={{ fontWeight:600, color:C.text, marginBottom:3 }}>Transações Recentes</p>
                <p style={{ fontSize:11, color:C.textMuted }}>Últimas do período · créditos e débitos separados</p>
              </div>
              <div style={{ maxHeight:360, overflowY:'auto' }}>
                {recentTx.length===0 ? (
                  <p style={{ color:C.textMuted, textAlign:'center', padding:'40px 0', fontSize:13 }}>Nenhuma transação.</p>
                ) : recentTx.map(t=>(
                  <div key={t.id} style={{ display:'flex', alignItems:'center', padding:'11px 24px', gap:12, borderBottom:`1px solid rgba(255,255,255,0.03)`, cursor:'pointer', transition:'background 0.1s' }}
                    onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <div style={{ width:34, height:34, borderRadius:9, flexShrink:0, background:isIncome(t)?'rgba(0,229,160,0.1)':'rgba(242,84,91,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {isIncome(t)?<ArrowUpRight size={14} style={{color:C.green}}/>:<ArrowDownRight size={14} style={{color:C.red}}/>}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, fontWeight:500, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.description}</p>
                      <p style={{ fontSize:11, color:C.textMuted }}>
                        {new Date(`${t.date}T00:00:00`).toLocaleDateString('pt-BR')} · {t.category??(isIncome(t)?'Receita':'Outros')}
                      </p>
                    </div>
                    <p style={{ fontSize:13, fontWeight:700, color:isIncome(t)?C.green:C.red, flexShrink:0 }}>
                      {isIncome(t)?'+':'-'}{showValues?fmt(txAmt(t)):'•••••'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      <AIChat financialContext={{
        transactions: periodTx as any,
        accounts: accounts as any,
        categories: categories.map((c,i)=>({ id:String(i), name:c.name })),
        totalIncome:   stats.income,
        totalExpenses: stats.expenses,
        balance:       stats.balance,
        currentMonth:  period.label !== 'Personalizado'
          ? period.label
          : `${new Date(period.start+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})} – ${new Date(period.end+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}`,
        historicalMonths,
      }}/>
    </div>
  )
}
