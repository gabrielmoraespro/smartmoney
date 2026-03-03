import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useResponsive } from '../../hooks/useResponsive'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import type { Transaction, Account } from '../../lib/types'
import {
  Search, X, ChevronDown, ArrowUpRight, ArrowDownRight,
  Download, ChevronLeft, ChevronRight, Eye, EyeOff,
  Calendar, SlidersHorizontal, MoreVertical, TrendingUp,
  TrendingDown, Hash, DollarSign, Filter, RefreshCw,
  AlertCircle, Trash2, Check
} from 'lucide-react'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#06080F', card: '#0B1120', border: 'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.1)', accent: '#00E5A0',
  text: '#E8EFF8', textMuted: '#4A5878', textSub: '#8899B4',
  green: '#00E5A0', red: '#F2545B', yellow: '#F5A623', blue: '#3B8BF5',
}

// ─── Types & Constants ────────────────────────────────────────────────────────
const LIMIT = 25
type SortKey    = 'date_desc'|'date_asc'|'amount_desc'|'amount_asc'
type TypeFilter = 'all'|'credit'|'debit'
type PeriodKey  = 'this_month'|'last_month'|'last_30'|'last_90'|'last_6m'|'this_year'|'last_year'|'custom'

const PERIOD_LABELS: Record<PeriodKey,string> = {
  this_month:'Este mês', last_month:'Mês passado', last_30:'Últimos 30 dias',
  last_90:'Últimos 90 dias', last_6m:'Últimos 6 meses', this_year:'Este ano',
  last_year:'Ano passado', custom:'Personalizado',
}
const SORT_LABELS: Record<SortKey,string> = {
  date_desc:'Data (mais recente)', date_asc:'Data (mais antiga)',
  amount_desc:'Valor (maior)', amount_asc:'Valor (menor)',
}
const CAT_COLORS: Record<string,string> = {
  'Alimentação':'#F5A623','Supermercado':'#00E5A0','Transporte':'#3B8BF5',
  'Moradia':'#A78BFA','Saúde':'#F472B6','Lazer':'#34D399','Educação':'#FBBF24',
  'Vestuário':'#818CF8','Outros':'#4A5878','Delivery de alimentos':'#FB923C',
  'Restaurantes':'#F87171','Farmácia':'#4ADE80','Combustível':'#38BDF8',
}
const getCatColor = (cat?: string) => {
  if (!cat) return '#4A5878'
  for (const [k,v] of Object.entries(CAT_COLORS)) {
    if (cat.toLowerCase().includes(k.toLowerCase())) return v
  }
  return '#4A5878'
}
const fmt  = (v: number) => Math.abs(v).toLocaleString('pt-BR', {style:'currency',currency:'BRL'})
const fmtK = (v: number) => v>=1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v.toFixed(0)}`

function getPeriodDates(k: PeriodKey, cs?: string, ce?: string): {from:string;to:string} {
  const now = new Date()
  const iso = (d: Date) => d.toISOString().substring(0,10)
  switch(k) {
    case 'this_month':  return {from:iso(new Date(now.getFullYear(),now.getMonth(),1)), to:iso(now)}
    case 'last_month':  return {from:iso(new Date(now.getFullYear(),now.getMonth()-1,1)), to:iso(new Date(now.getFullYear(),now.getMonth(),0))}
    case 'last_30':     { const d=new Date(now); d.setDate(d.getDate()-29); return {from:iso(d),to:iso(now)} }
    case 'last_90':     { const d=new Date(now); d.setDate(d.getDate()-89); return {from:iso(d),to:iso(now)} }
    case 'last_6m':     { const d=new Date(now); d.setMonth(d.getMonth()-6); return {from:iso(d),to:iso(now)} }
    case 'this_year':   return {from:`${now.getFullYear()}-01-01`, to:iso(now)}
    case 'last_year':   return {from:`${now.getFullYear()-1}-01-01`, to:`${now.getFullYear()-1}-12-31`}
    case 'custom':      return {from:cs??iso(new Date(now.getFullYear(),now.getMonth(),1)), to:ce??iso(now)}
  }
}

// ─── Dropdown Component ───────────────────────────────────────────────────────
function Dropdown({label,icon,children}: {label:string;icon?:React.ReactNode;children:React.ReactNode}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if(ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} style={{position:'relative'}}>
      <button onClick={() => setOpen(o=>!o)} style={{
        display:'flex', alignItems:'center', gap:6, padding:'8px 12px',
        background:C.card, border:`1px solid ${C.border}`, borderRadius:9,
        color:C.text, fontSize:12, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap',
        transition:'border-color 0.15s',
      }}
      onMouseEnter={e=>(e.currentTarget.style.borderColor=C.borderStrong)}
      onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}
      >
        {icon}{label}<ChevronDown size={12} style={{color:C.textMuted}} />
      </button>
      {open && (
        <div onClick={()=>setOpen(false)} style={{
          position:'absolute', top:'100%', left:0, marginTop:4, zIndex:50,
          background:'#0D1526', border:`1px solid ${C.borderStrong}`,
          borderRadius:10, minWidth:190, boxShadow:'0 12px 32px rgba(0,0,0,0.6)',
          overflow:'hidden',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}
function DItem({label,active,onClick}: {label:string;active?:boolean;onClick:()=>void}) {
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:8, width:'100%', textAlign:'left',
      padding:'9px 14px', background:active?'rgba(0,229,160,0.1)':'transparent',
      color:active?C.accent:C.text, fontSize:13, cursor:'pointer', border:'none',
      transition:'background 0.1s',
    }}
    onMouseEnter={e=>{ if(!active)(e.currentTarget as HTMLButtonElement).style.background='rgba(255,255,255,0.04)' }}
    onMouseLeave={e=>{ if(!active)(e.currentTarget as HTMLButtonElement).style.background='transparent' }}
    >
      {active && <Check size={12} style={{color:C.accent,flexShrink:0}} />}
      {!active && <span style={{width:12}} />}
      {label}
    </button>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({label,value,color,icon}: {label:string;value:string;color:string;icon:React.ReactNode}) {
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:'16px 20px',display:'flex',alignItems:'center',gap:14}}>
      <div style={{width:40,height:40,borderRadius:10,background:`${color}15`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color}}>
        {icon}
      </div>
      <div>
        <p style={{color:C.textMuted,fontSize:11,marginBottom:3}}>{label}</p>
        <p style={{color:C.text,fontWeight:700,fontSize:18}}>{value}</p>
      </div>
    </div>
  )
}

// ─── Transaction Modal (Detail + Edit) ───────────────────────────────────────
function TxModal({tx,accountsMap,showValues,onClose,onDelete}: {
  tx:Transaction; accountsMap:Record<string,string>; showValues:boolean;
  onClose:()=>void; onDelete:(id:string)=>void
}) {
  const [deleting, setDeleting] = useState(false)
  const handleDelete = async () => {
    if (!window.confirm(`Remover "${tx.description}"? Esta ação não pode ser desfeita.`)) return
    setDeleting(true)
    const { error } = await supabase.from('transactions').delete().eq('id', tx.id)
    if (error) {
      toast.error('Não foi possível remover a transação.')
      setDeleting(false)
    } else {
      toast.success('Transação removida.')
      onDelete(tx.id)
      onClose()
    }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,backdropFilter:'blur(4px)'}}
      onClick={onClose}
    >
      <div style={{background:'#0D1526',border:`1px solid ${C.borderStrong}`,borderRadius:18,padding:28,width:420,maxWidth:'90vw',animation:'slideUp 0.2s ease'}}
        onClick={e=>e.stopPropagation()}
      >
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:44,height:44,borderRadius:12,background:tx.type==='credit'?'rgba(0,229,160,0.12)':'rgba(242,84,91,0.12)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              {tx.type==='credit'
                ? <ArrowUpRight size={20} style={{color:C.green}} />
                : <ArrowDownRight size={20} style={{color:C.red}} />
              }
            </div>
            <div>
              <p style={{fontWeight:700,color:C.text,fontSize:16}}>Detalhes</p>
              <p style={{fontSize:12,color:C.textMuted}}>{tx.type==='credit'?'Receita':'Despesa'}</p>
            </div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:C.textMuted,padding:4}}>
            <X size={20} />
          </button>
        </div>

        <p style={{fontSize:34,fontWeight:800,color:tx.type==='credit'?C.green:C.red,marginBottom:20,letterSpacing:-1}}>
          {tx.type==='credit'?'+':'-'}{showValues ? fmt(Number(tx.amount)) : '•••••'}
        </p>

        <div style={{display:'flex',flexDirection:'column',marginBottom:20}}>
          {[
            ['Descrição',  tx.description],
            ['Data',       new Date(`${tx.date}T00:00:00`).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})],
            ['Categoria',  tx.category ?? 'Outros'],
            ['Conta',      accountsMap[tx.account_id] ?? '—'],
            ['Método',     tx.payment_method ?? '—'],
            ['Origem',     tx.is_manual ? '✏️ Manual' : '🏦 Open Finance'],
          ].map(([label,value]) => (
            <div key={label} style={{display:'flex',justifyContent:'space-between',padding:'11px 0',borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:13,color:C.textMuted}}>{label}</span>
              <span style={{fontSize:13,fontWeight:500,color:C.text,textAlign:'right',maxWidth:240,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{value}</span>
            </div>
          ))}
        </div>

        {tx.is_manual && (
          <button onClick={handleDelete} disabled={deleting}
            style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'10px 16px',background:'rgba(242,84,91,0.08)',border:'1px solid rgba(242,84,91,0.2)',borderRadius:10,color:C.red,fontSize:13,fontWeight:600,cursor:'pointer',justifyContent:'center',transition:'all 0.15s'}}
            onMouseEnter={e=>(e.currentTarget.style.background='rgba(242,84,91,0.15)')}
            onMouseLeave={e=>(e.currentTarget.style.background='rgba(242,84,91,0.08)')}
          >
            <Trash2 size={15} />
            {deleting ? 'Removendo...' : 'Remover transação'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Transacoes() {
  const { cols, isMobile } = useResponsive()
  const [allTx, setAllTx]     = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]     = useState('')

  const [search, setSearch]             = useState('')
  const [typeFilter, setTypeFilter]     = useState<TypeFilter>('all')
  const [accountFilter, setAccFilter]   = useState('all')
  const [categoryFilter, setCatFilter]  = useState('all')
  const [sortKey, setSortKey]           = useState<SortKey>('date_desc')
  const [period, setPeriod]             = useState<PeriodKey>('this_month')
  const [customStart, setCStart]        = useState('')
  const [customEnd, setCEnd]            = useState('')
  const [showCustom, setShowCustom]     = useState(false)
  const [showValues, setShowValues]     = useState(true)
  const [page, setPage]                 = useState(0)
  const [selectedTx, setSelectedTx]     = useState<Transaction|null>(null)

  const loadData = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true)
    setError('')
    try {
      const { data: {user} } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessão expirada.')
      const [txRes, accRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', user.id).order('date',{ascending:false}).limit(1000),
        supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true),
      ])
      if (txRes.error)  throw new Error(txRes.error.message)
      if (accRes.error) throw new Error(accRes.error.message)
      setAllTx((txRes.data ?? []) as Transaction[])
      setAccounts((accRes.data ?? []) as Account[])
    } catch (e: any) {
      setError(e.message ?? 'Erro ao carregar transações.')
      toast.error('Falha ao carregar dados. ' + (e.message ?? ''))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const {from, to} = useMemo(() => getPeriodDates(period, customStart, customEnd), [period,customStart,customEnd])
  const categories = useMemo(() => Array.from(new Set(allTx.map(t=>t.category??'Outros').filter(Boolean))).sort(), [allTx])
  const accountsMap = useMemo(() => accounts.reduce((m,a) => { m[a.id]=a.bank_name; return m }, {} as Record<string,string>), [accounts])

  const filtered = useMemo(() => {
    let txs = allTx.filter(t => t.date >= from && t.date <= to)
    if (typeFilter !== 'all') txs = txs.filter(t => t.type === typeFilter)
    if (accountFilter !== 'all') txs = txs.filter(t => t.account_id === accountFilter)
    if (categoryFilter !== 'all') txs = txs.filter(t => (t.category??'Outros') === categoryFilter)
    if (search.trim()) txs = txs.filter(t => t.description.toLowerCase().includes(search.toLowerCase()))
    switch(sortKey) {
      case 'date_desc':   txs.sort((a,b) => b.date.localeCompare(a.date));               break
      case 'date_asc':    txs.sort((a,b) => a.date.localeCompare(b.date));               break
      case 'amount_desc': txs.sort((a,b) => Math.abs(Number(b.amount))-Math.abs(Number(a.amount))); break
      case 'amount_asc':  txs.sort((a,b) => Math.abs(Number(a.amount))-Math.abs(Number(b.amount))); break
    }
    return txs
  }, [allTx, from, to, typeFilter, accountFilter, categoryFilter, search, sortKey])

  const stats = useMemo(() => {
    const income  = filtered.filter(t=>t.type==='credit').reduce((s,t)=>s+Math.abs(Number(t.amount)),0)
    const expense = filtered.filter(t=>t.type==='debit' ).reduce((s,t)=>s+Math.abs(Number(t.amount)),0)
    return {income, expense, balance:income-expense, count:filtered.length}
  }, [filtered])

  const paginated   = useMemo(() => filtered.slice(page*LIMIT,(page+1)*LIMIT), [filtered, page])
  const totalPages  = Math.ceil(filtered.length / LIMIT)
  const hasFilters  = typeFilter!=='all'||accountFilter!=='all'||categoryFilter!=='all'||search.trim()!==''

  const grouped = useMemo(() => {
    const map: Record<string,Transaction[]> = {}
    paginated.forEach(t => { if(!map[t.date]) map[t.date]=[]; map[t.date].push(t) })
    return Object.entries(map).sort((a,b) => sortKey==='date_asc' ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0]))
  }, [paginated, sortKey])

  const exportCSV = () => {
    const rows = [['Data','Descrição','Categoria','Conta','Tipo','Valor']]
    filtered.forEach(t => rows.push([t.date,t.description,t.category??'Outros',accountsMap[t.account_id]??'',t.type,String(Math.abs(Number(t.amount)))]))
    const csv = rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}))
    a.download = `transacoes_${from}_${to}.csv`
    a.click()
    toast.success(`${filtered.length} transações exportadas.`)
  }

  const clearFilters = () => {
    setTypeFilter('all'); setAccFilter('all'); setCatFilter('all')
    setSearch(''); setPage(0)
  }

  const handleDelete = (id: string) => {
    setAllTx(prev => prev.filter(t => t.id !== id))
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <div style={{height:28,width:160,background:'rgba(255,255,255,0.06)',borderRadius:8}} />
        <div style={{display:'flex',gap:8}}>
          {[1,2,3].map(i=><div key={i} style={{height:36,width:100,background:'rgba(255,255,255,0.04)',borderRadius:8}} />)}
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
        {[1,2,3,4].map(i=><div key={i} style={{height:80,background:'rgba(255,255,255,0.04)',borderRadius:14}} />)}
      </div>
      {[...Array(8)].map((_,i)=><div key={i} style={{height:52,background:'rgba(255,255,255,0.04)',borderRadius:10,opacity:1-i*0.1}} />)}
    </div>
  )

  return (
    <div style={{color:C.text,fontFamily:'system-ui,sans-serif',maxWidth:1400}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:26,fontWeight:700,margin:0,letterSpacing:-0.5}}>Transações</h1>
          <p style={{color:C.textMuted,fontSize:13,marginTop:4}}>
            {filtered.length} registros · {PERIOD_LABELS[period]}
          </p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button onClick={()=>loadData(true)} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 12px',background:C.card,border:`1px solid ${C.border}`,borderRadius:9,color:C.textSub,fontSize:12,cursor:'pointer'}}>
            <RefreshCw size={13} style={{animation:refreshing?'spin 1s linear infinite':'none'}} />
            Atualizar
          </button>
          <button onClick={()=>setShowValues(v=>!v)} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 12px',background:C.card,border:`1px solid ${C.border}`,borderRadius:9,color:C.textSub,fontSize:12,cursor:'pointer'}}>
            {showValues ? <EyeOff size={13} /> : <Eye size={13} />}
            {showValues?'Ocultar':'Mostrar'}
          </button>
          <button onClick={exportCSV} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',background:'#00E5A0',border:'none',borderRadius:9,color:'#06080F',fontSize:12,fontWeight:700,cursor:'pointer',transition:'opacity 0.15s'}}
            onMouseEnter={e=>(e.currentTarget.style.opacity='0.85')}
            onMouseLeave={e=>(e.currentTarget.style.opacity='1')}
          >
            <Download size={13} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',background:'rgba(242,84,91,0.08)',border:'1px solid rgba(242,84,91,0.2)',borderRadius:12,marginBottom:16}}>
          <AlertCircle size={16} style={{color:C.red,flexShrink:0}} />
          <p style={{color:C.red,fontSize:13,flex:1}}>{error}</p>
          <button onClick={()=>loadData()} style={{fontSize:12,color:C.red,background:'rgba(242,84,91,0.12)',border:'none',borderRadius:7,padding:'4px 12px',cursor:'pointer',fontWeight:600}}>Tentar novamente</button>
        </div>
      )}

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:cols({xs:2,sm:2,md:4}),gap:12,marginBottom:20}}>
        <StatCard label="Registros" value={String(stats.count)} color={C.blue} icon={<Hash size={18}/>} />
        <StatCard label="Receitas"  value={showValues?fmtK(stats.income):'••••'} color={C.green} icon={<TrendingUp size={18}/>} />
        <StatCard label="Despesas"  value={showValues?fmtK(stats.expense):'••••'} color={C.red} icon={<TrendingDown size={18}/>} />
        <StatCard label="Saldo"     value={showValues?fmtK(stats.balance):'••••'} color={stats.balance>=0?C.green:C.red} icon={<DollarSign size={18}/>} />
      </div>

      {/* Toolbar */}
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        {/* Search */}
        <div style={{position:'relative',flex:1,minWidth:200,maxWidth:280}}>
          <Search size={14} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:C.textMuted}} />
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}} placeholder="Buscar transações..."
            style={{width:'100%',padding:'8px 32px',background:C.card,border:`1px solid ${C.border}`,borderRadius:9,color:C.text,fontSize:13,outline:'none',boxSizing:'border-box',transition:'border-color 0.15s'}}
            onFocus={e=>(e.target.style.borderColor=C.borderStrong)}
            onBlur={e=>(e.target.style.borderColor=C.border)}
          />
          {search && <button onClick={()=>setSearch('')} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:C.textMuted}}><X size={14}/></button>}
        </div>

        {/* Period */}
        <div style={{position:'relative'}}>
          <Dropdown label={PERIOD_LABELS[period]} icon={<Calendar size={13} style={{color:C.textMuted}}/>}>
            {(Object.keys(PERIOD_LABELS) as PeriodKey[]).filter(k=>k!=='custom').map(k => (
              <DItem key={k} label={PERIOD_LABELS[k]} active={period===k} onClick={()=>{setPeriod(k);setShowCustom(false);setPage(0)}} />
            ))}
            <div style={{height:1,background:C.border,margin:'4px 0'}} />
            <DItem label="Personalizado..." active={period==='custom'} onClick={()=>{setPeriod('custom');setShowCustom(true)}} />
          </Dropdown>
          {showCustom && (
            <div style={{position:'absolute',top:'100%',left:0,marginTop:4,zIndex:100,background:'#0D1526',border:`1px solid ${C.borderStrong}`,borderRadius:12,padding:16,minWidth:240,boxShadow:'0 12px 32px rgba(0,0,0,0.6)'}}>
              <p style={{color:C.textMuted,fontSize:12,marginBottom:10}}>Período personalizado</p>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {[['De',customStart,setCStart],['Até',customEnd,setCEnd]].map(([label,val,setFn]) => (
                  <div key={label as string}>
                    <label style={{color:C.textMuted,fontSize:11,display:'block',marginBottom:4}}>{label as string}</label>
                    <input type="date" value={val as string} onChange={e=>(setFn as any)(e.target.value)}
                      style={{width:'100%',padding:'7px 10px',background:'#06080F',border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:13,boxSizing:'border-box'}} />
                  </div>
                ))}
                <button onClick={()=>{setShowCustom(false);setPage(0)}}
                  style={{padding:8,background:C.accent,border:'none',borderRadius:8,color:'#06080F',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>

        <Dropdown label={typeFilter==='all'?'Todos':(typeFilter==='credit'?'Receitas':'Despesas')} icon={<Filter size={13} style={{color:C.textMuted}}/>}>
          <DItem label="Todos"    active={typeFilter==='all'}    onClick={()=>{setTypeFilter('all');   setPage(0)}} />
          <DItem label="Receitas" active={typeFilter==='credit'} onClick={()=>{setTypeFilter('credit');setPage(0)}} />
          <DItem label="Despesas" active={typeFilter==='debit'}  onClick={()=>{setTypeFilter('debit'); setPage(0)}} />
        </Dropdown>

        {accounts.length > 0 && (
          <Dropdown label={accountFilter==='all'?'Todas Contas':(accountsMap[accountFilter]??'Conta')}>
            <DItem label="Todas as contas" active={accountFilter==='all'} onClick={()=>{setAccFilter('all');setPage(0)}} />
            {accounts.map(a => <DItem key={a.id} label={a.bank_name} active={accountFilter===a.id} onClick={()=>{setAccFilter(a.id);setPage(0)}} />)}
          </Dropdown>
        )}

        {categories.length > 0 && (
          <Dropdown label={categoryFilter==='all'?'Categorias':categoryFilter} icon={<SlidersHorizontal size={13} style={{color:C.textMuted}}/>}>
            <DItem label="Todas categorias" active={categoryFilter==='all'} onClick={()=>{setCatFilter('all');setPage(0)}} />
            {categories.map(c => <DItem key={c} label={c} active={categoryFilter===c} onClick={()=>{setCatFilter(c);setPage(0)}} />)}
          </Dropdown>
        )}

        <Dropdown label={SORT_LABELS[sortKey]}>
          {(Object.keys(SORT_LABELS) as SortKey[]).map(k => <DItem key={k} label={SORT_LABELS[k]} active={sortKey===k} onClick={()=>setSortKey(k)} />)}
        </Dropdown>

        {hasFilters && (
          <button onClick={clearFilters} style={{display:'flex',alignItems:'center',gap:5,padding:'8px 12px',background:'rgba(242,84,91,0.08)',border:'1px solid rgba(242,84,91,0.2)',borderRadius:9,color:C.red,fontSize:12,cursor:'pointer',fontWeight:500}}>
            <X size={12}/> Limpar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,overflow:'hidden',marginBottom:16}}>
        {/* Header row */}
        <div style={{display:isMobile?'none':'grid',gridTemplateColumns:'2fr 1.2fr 1fr 0.7fr 1fr 36px',padding:'10px 20px',borderBottom:`1px solid ${C.border}`,background:'rgba(255,255,255,0.02)'}}>
          {['DESCRIÇÃO','CATEGORIA','CONTA','DATA','VALOR',''].map((h,i) => (
            <span key={i} style={{fontSize:10,fontWeight:700,color:C.textMuted,letterSpacing:'0.07em',textAlign:i>=4?'right':'left'}}>{h}</span>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{padding:'60px 20px',textAlign:'center'}}>
            <div style={{width:48,height:48,borderRadius:14,background:'rgba(255,255,255,0.04)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
              <Search size={20} style={{color:C.textMuted}} />
            </div>
            <p style={{color:C.text,fontWeight:600,marginBottom:6}}>Nenhuma transação encontrada</p>
            <p style={{color:C.textMuted,fontSize:13}}>Tente ajustar os filtros ou o período selecionado.</p>
            {hasFilters && (
              <button onClick={clearFilters} style={{marginTop:16,padding:'8px 20px',background:'rgba(0,229,160,0.1)',border:'1px solid rgba(0,229,160,0.2)',borderRadius:9,color:C.accent,fontSize:13,cursor:'pointer',fontWeight:600}}>
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          grouped.map(([date, txs]) => (
            <div key={date}>
              {/* Date group header */}
              <div style={{padding:'8px 20px',background:'rgba(255,255,255,0.01)',borderBottom:`1px solid rgba(255,255,255,0.03)`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:11,fontWeight:600,color:C.textSub,textTransform:'capitalize'}}>
                  {new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}
                </span>
                <span style={{fontSize:11,color:C.textMuted}}>
                  {txs.length} {txs.length===1?'transação':'transações'} ·{' '}
                  <span style={{
                    color: txs.reduce((s,t)=>s+(t.type==='debit'?-1:1)*Math.abs(Number(t.amount)),0)>=0?C.green:C.red,
                    fontWeight:600,
                  }}>
                    {showValues ? fmt(Math.abs(txs.reduce((s,t)=>s+(t.type==='debit'?-1:1)*Math.abs(Number(t.amount)),0))) : '••••'}
                  </span>
                </span>
              </div>

              {txs.map(t => {
                const catColor = getCatColor(t.category)
                return (
                  <div key={t.id} onClick={()=>setSelectedTx(t)}
                    style={{display:'grid',gridTemplateColumns:isMobile?'1fr auto':'2fr 1.2fr 1fr 0.7fr 1fr 36px',padding:isMobile?'12px 16px':'12px 20px',borderBottom:`1px solid rgba(255,255,255,0.02)`,cursor:'pointer',alignItems:'center',transition:'background 0.1s'}}
                    onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
                  >
                    <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0}}>
                      <div style={{width:32,height:32,borderRadius:9,background:t.type==='credit'?'rgba(0,229,160,0.1)':'rgba(242,84,91,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        {t.type==='credit'
                          ? <ArrowUpRight size={14} style={{color:C.green}} />
                          : <ArrowDownRight size={14} style={{color:C.red}} />
                        }
                      </div>
                      <div style={{minWidth:0}}>
                        <p style={{fontSize:13,fontWeight:500,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.description}</p>
                        {t.is_manual && <span style={{fontSize:10,color:C.textMuted,background:'rgba(255,255,255,0.06)',padding:'1px 6px',borderRadius:4}}>Manual</span>}
                      </div>
                    </div>

                    <div>
                      {t.category ? (
                        <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,fontWeight:500,padding:'3px 8px',borderRadius:20,background:`${catColor}15`,color:catColor,border:`1px solid ${catColor}30`}}>
                          <span style={{width:5,height:5,borderRadius:'50%',background:catColor,display:'inline-block'}} />
                          {t.category}
                        </span>
                      ) : <span style={{fontSize:12,color:C.textMuted}}>—</span>}
                    </div>

                    <div>
                      <span style={{fontSize:12,color:C.textSub,background:'rgba(255,255,255,0.04)',padding:'2px 8px',borderRadius:6,border:`1px solid ${C.border}`}}>
                        {accountsMap[t.account_id]??'—'}
                      </span>
                    </div>

                    <p style={{fontSize:12,color:C.textMuted,textAlign:'right'}}>
                      {new Date(`${t.date}T00:00:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}
                    </p>

                    <p style={{fontSize:13,fontWeight:700,textAlign:'right',color:t.type==='credit'?C.green:C.red}}>
                      {t.type==='credit'?'+':'-'}{showValues ? fmt(Number(t.amount)) : '•••••'}
                    </p>

                    <div style={{display:'flex',justifyContent:'flex-end'}}>
                      <MoreVertical size={14} style={{color:C.border}} />
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <p style={{fontSize:12,color:C.textMuted}}>
            Mostrando {page*LIMIT+1}–{Math.min((page+1)*LIMIT,filtered.length)} de {filtered.length}
          </p>
          <div style={{display:'flex',gap:4,alignItems:'center'}}>
            <button onClick={()=>setPage(0)} disabled={page===0}
              style={{padding:'6px 10px',background:C.card,border:`1px solid ${C.border}`,borderRadius:7,color:page===0?C.border:C.text,fontSize:12,cursor:page===0?'not-allowed':'pointer'}}>
              «
            </button>
            <button onClick={()=>setPage(p=>p-1)} disabled={page===0}
              style={{padding:'6px 8px',background:C.card,border:`1px solid ${C.border}`,borderRadius:7,color:page===0?C.border:C.text,cursor:page===0?'not-allowed':'pointer'}}>
              <ChevronLeft size={14}/>
            </button>
            {Array.from({length:Math.min(totalPages,5)},(_,i) => {
              const p = totalPages<=5 ? i : Math.min(Math.max(page-2+i,0),totalPages-1)
              return (
                <button key={p} onClick={()=>setPage(p)}
                  style={{padding:'6px 12px',background:page===p?C.accent:C.card,border:`1px solid ${page===p?C.accent:C.border}`,borderRadius:7,color:page===p?'#06080F':C.textSub,fontSize:12,cursor:'pointer',fontWeight:page===p?700:400}}>
                  {p+1}
                </button>
              )
            })}
            <button onClick={()=>setPage(p=>p+1)} disabled={page>=totalPages-1}
              style={{padding:'6px 8px',background:C.card,border:`1px solid ${C.border}`,borderRadius:7,color:page>=totalPages-1?C.border:C.text,cursor:page>=totalPages-1?'not-allowed':'pointer'}}>
              <ChevronRight size={14}/>
            </button>
            <button onClick={()=>setPage(totalPages-1)} disabled={page>=totalPages-1}
              style={{padding:'6px 10px',background:C.card,border:`1px solid ${C.border}`,borderRadius:7,color:page>=totalPages-1?C.border:C.text,fontSize:12,cursor:page>=totalPages-1?'not-allowed':'pointer'}}>
              »
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedTx && (
        <TxModal tx={selectedTx} accountsMap={accountsMap} showValues={showValues} onClose={()=>setSelectedTx(null)} onDelete={handleDelete} />
      )}

      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
      `}</style>
    </div>
  )
}
