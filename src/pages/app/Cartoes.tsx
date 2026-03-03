import { useEffect, useState, useMemo } from 'react'
import { getUserAuthHeaders, supabase } from '../../lib/supabase'
import type { Account, Transaction } from '../../lib/types'
import { Skeleton } from '../../components/ui/skeleton'
import { CreditCard, TrendingDown } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'

const COLORS = ['#6ee7b7','#60a5fa','#fbbf24','#f87171','#a78bfa','#f472b6','#34d399','#818cf8']
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function Cartoes() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAccount, setSelectedAccount] = useState<string>('all')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const headers = await getUserAuthHeaders()
        const baseUrl = import.meta.env.VITE_SUPABASE_URL as string
        const [txRes, accRes] = await Promise.all([
          fetch(`${baseUrl}/rest/v1/transactions?user_id=eq.${user.id}&order=date.desc&limit=500`, { headers }),
          fetch(`${baseUrl}/rest/v1/accounts?user_id=eq.${user.id}&is_active=eq.true`, { headers }),
        ])
        const [txData, accData] = await Promise.all([txRes.json(), accRes.json()])
        setTransactions((txData ?? []) as Transaction[])
        setAccounts((accData ?? []) as Account[])
      } catch (e) { console.error(e) } finally { setLoading(false) }
    }
    load()
  }, [])

  const availableMonths = useMemo(() => {
    const set = new Set<string>()
    transactions.forEach(t => set.add(t.date.substring(0, 7)))
    return Array.from(set).sort().reverse().slice(0, 12)
  }, [transactions])

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      const monthMatch = t.date.startsWith(selectedMonth)
      const accountMatch = selectedAccount === 'all' || t.account_id === selectedAccount
      return monthMatch && accountMatch
    })
  }, [transactions, selectedMonth, selectedAccount])

  const debits = filtered.filter(t => t.type === 'debit')
  const credits = filtered.filter(t => t.type === 'credit')
  const totalSpent = debits.reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
  const totalReceived = credits.reduce((s, t) => s + Math.abs(Number(t.amount)), 0)

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {}
    debits.forEach(t => {
      const cat = t.category ?? 'Outros'
      map[cat] = (map[cat] ?? 0) + Math.abs(Number(t.amount))
    })
    return Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0,8).map(([name,value]) => ({ name, value }))
  }, [debits])

  const dailySpend = useMemo(() => {
    const map: Record<string, number> = {}
    debits.forEach(t => {
      map[t.date] = (map[t.date] ?? 0) + Math.abs(Number(t.amount))
    })
    return Object.entries(map).sort((a,b) => a[0].localeCompare(b[0])).map(([date, value]) => ({
      day: new Date(date+'T00:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }),
      gasto: value,
    }))
  }, [debits])

  const accountStats = useMemo(() => {
    return accounts.map(acc => {
      const accTx = transactions.filter(t => t.account_id === acc.id && t.date.startsWith(selectedMonth))
      const spent = accTx.filter(t => t.type==='debit').reduce((s,t) => s+Math.abs(Number(t.amount)), 0)
      const received = accTx.filter(t => t.type==='credit').reduce((s,t) => s+Math.abs(Number(t.amount)), 0)
      return { ...acc, spent, received, txCount: accTx.length }
    }).filter(a => a.txCount > 0)
  }, [accounts, transactions, selectedMonth])

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48 rounded-xl" />
      <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i=><Skeleton key={i} className="h-28 rounded-2xl"/>)}</div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cartões & Contas</h2>
          <p className="text-sm text-muted-foreground">Visão consolidada por conta bancária</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {availableMonths.slice(0,6).map(m => {
            const [y,mo] = m.split('-')
            return (
              <button key={m} onClick={() => setSelectedMonth(m)} style={{
                background: selectedMonth===m ? '#10b981':'#1e293b',
                color: selectedMonth===m ? '#000':'#94a3b8',
                border:'none', borderRadius:20, padding:'5px 14px', fontSize:12, fontWeight:600, cursor:'pointer'
              }}>
                {MONTHS[parseInt(mo)-1]}/{y.slice(2)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Filtro por conta */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setSelectedAccount('all')} style={{
          background: selectedAccount==='all'?'#3b82f6':'#1e293b',
          color: selectedAccount==='all'?'#fff':'#94a3b8',
          border:'none', borderRadius:20, padding:'5px 14px', fontSize:12, fontWeight:600, cursor:'pointer'
        }}>
          Todas as contas
        </button>
        {accounts.map(acc => (
          <button key={acc.id} onClick={() => setSelectedAccount(acc.id)} style={{
            background: selectedAccount===acc.id?'#3b82f6':'#1e293b',
            color: selectedAccount===acc.id?'#fff':'#94a3b8',
            border:'none', borderRadius:20, padding:'5px 14px', fontSize:12, fontWeight:600, cursor:'pointer'
          }}>
            {acc.bank_name}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label:'Total Gasto', value: fmt(totalSpent), color:'#ef4444', sub:`${debits.length} débitos` },
          { label:'Total Recebido', value: fmt(totalReceived), color:'#10b981', sub:`${credits.length} créditos` },
          { label:'Maior Gasto', value: debits.length>0?fmt(Math.max(...debits.map(t=>Math.abs(Number(t.amount))))):'N/A', color:'#fbbf24', sub: debits.length>0?debits.reduce((a,b)=>Math.abs(Number(a.amount))>Math.abs(Number(b.amount))?a:b).description:'Sem transações' },
        ].map(k => (
          <div key={k.label} style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:16, padding:'20px 24px' }}>
            <p className="text-sm text-muted-foreground mb-1">{k.label}</p>
            <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
            <p className="text-xs mt-1 truncate" style={{ color:'#64748b' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Cards por conta */}
      {accountStats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accountStats.map((acc, i) => (
            <div key={acc.id} style={{ background:'#0f172a', border:`1px solid ${selectedAccount===acc.id?COLORS[i%COLORS.length]:'#1e293b'}`, borderRadius:16, padding:'20px 24px', cursor:'pointer', transition:'border-color 0.15s' }}
              onClick={() => setSelectedAccount(selectedAccount===acc.id?'all':acc.id)}>
              <div className="flex items-center gap-3 mb-4">
                <div style={{ width:40, height:40, borderRadius:12, background:'#1e293b', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <CreditCard className="h-5 w-5" style={{ color: COLORS[i%COLORS.length] }} />
                </div>
                <div style={{ flex:1 }}>
                  <p className="text-sm font-semibold text-white truncate">{acc.bank_name}</p>
                  <p className="text-xs" style={{ color:'#64748b' }}>{acc.type} · {acc.currency}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs" style={{ color:'#64748b' }}>Gasto</p>
                  <p className="text-sm font-bold text-red-400 tabular-nums">{fmt(acc.spent)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color:'#64748b' }}>Recebido</p>
                  <p className="text-sm font-bold text-green-400 tabular-nums">{fmt(acc.received)}</p>
                </div>
              </div>
              <p className="text-xs mt-3" style={{ color:'#475569' }}>{acc.txCount} transações no mês</p>
            </div>
          ))}
        </div>
      )}

      {debits.length === 0 ? (
        <div style={{ background:'#0f172a', border:'1px dashed #1e293b', borderRadius:16, padding:64, textAlign:'center' as const }}>
          <TrendingDown className="h-12 w-12 mx-auto mb-4" style={{ color:'#334155' }} />
          <p className="text-white font-semibold">Nenhuma transação neste período</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:16, padding:'20px 24px' }}>
            <p className="font-semibold text-white mb-1">Gastos por Categoria</p>
            <p className="text-xs mb-4" style={{ color:'#64748b' }}>Distribuição do mês selecionado</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i%COLORS.length]} stroke="transparent" />)}
                </Pie>
                <Tooltip formatter={(v:number) => fmt(v)} contentStyle={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:8, fontSize:12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {categoryData.slice(0,5).map((cat, i) => (
                <div key={cat.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span style={{ width:8, height:8, borderRadius:'50%', background:COLORS[i%COLORS.length], display:'inline-block' }} />
                    <span className="text-xs truncate max-w-28" style={{ color:'#94a3b8' }}>{cat.name}</span>
                  </div>
                  <span className="text-xs font-medium text-white tabular-nums">{fmt(cat.value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:16, padding:'20px 24px' }}>
            <p className="font-semibold text-white mb-1">Gastos Diários</p>
            <p className="text-xs mb-4" style={{ color:'#64748b' }}>Evolução ao longo do mês</p>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={dailySpend} margin={{ top:4, right:4, left:0, bottom:0 }}>
                <defs>
                  <linearGradient id="gradSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" tick={{ fontSize:10, fill:'#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10, fill:'#64748b' }} axisLine={false} tickLine={false} width={50}
                  tickFormatter={v => v>=1000?`R$${(v/1000).toFixed(0)}k`:`R$${v}`} />
                <Tooltip formatter={(v:number) => fmt(v)} contentStyle={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:8, fontSize:12 }} />
                <Area type="monotone" dataKey="gasto" name="Gasto" stroke="#f87171" strokeWidth={2} fill="url(#gradSpend)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabela transações */}
      {debits.length > 0 && (
        <div style={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:16, overflow:'hidden' }}>
          <div style={{ padding:'20px 24px', borderBottom:'1px solid #1e293b', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <p className="font-semibold text-white">Transações do Período</p>
            <span style={{ background:'#1e293b', borderRadius:8, padding:'4px 10px', fontSize:11, color:'#94a3b8' }}>{debits.length} débitos</span>
          </div>
          <div style={{ maxHeight:400, overflowY:'auto' as const }}>
            {debits.slice(0,30).map(t => (
              <div key={t.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 24px', borderBottom:'1px solid #0f172a', gap:12 }}
                onMouseEnter={e => (e.currentTarget.style.background='#1e293b')}
                onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                <div style={{ flex:1, minWidth:0 }}>
                  <p className="text-sm font-medium text-white truncate">{t.description}</p>
                  <p className="text-xs" style={{ color:'#64748b' }}>{new Date(t.date).toLocaleDateString('pt-BR')} · {t.category ?? 'Outros'}</p>
                </div>
                <p className="text-sm font-bold text-red-400 tabular-nums">-{fmt(Math.abs(Number(t.amount)))}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
