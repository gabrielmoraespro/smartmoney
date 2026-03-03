import { useEffect, useState, useMemo } from 'react'
import { getUserAuthHeaders, supabase } from '../../lib/supabase'
import type { Transaction } from '../../lib/types'
import { Skeleton } from '../../components/ui/skeleton'
import { ChevronDown, ChevronUp, TrendingDown } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

const COLORS = ['#6ee7b7','#60a5fa','#fbbf24','#f87171','#a78bfa','#f472b6','#34d399','#818cf8','#fb923c','#38bdf8']
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function Categorias() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const [expandedCat, setExpandedCat] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const headers = await getUserAuthHeaders()
        const baseUrl = import.meta.env.VITE_SUPABASE_URL as string
        const res = await fetch(`${baseUrl}/rest/v1/transactions?user_id=eq.${user.id}&order=date.desc&limit=500`, { headers })
        const data = await res.json()
        setTransactions((data ?? []) as Transaction[])
      } catch(e) { console.error(e) } finally { setLoading(false) }
    }
    load()
  }, [])

  const availableMonths = useMemo(() => {
    const set = new Set<string>()
    transactions.forEach(t => set.add(t.date.substring(0,7)))
    return Array.from(set).sort().reverse().slice(0,12)
  }, [transactions])

  const monthTx = useMemo(() =>
    transactions.filter(t => t.date.startsWith(selectedMonth) && t.type === 'debit'),
    [transactions, selectedMonth]
  )

  const categoryMap = useMemo(() => {
    const map: Record<string, { total: number; transactions: Transaction[] }> = {}
    monthTx.forEach(t => {
      const cat = t.category ?? 'Outros'
      if (!map[cat]) map[cat] = { total: 0, transactions: [] }
      map[cat].total += Math.abs(Number(t.amount))
      map[cat].transactions.push(t)
    })
    return Object.entries(map).sort((a,b) => b[1].total - a[1].total)
  }, [monthTx])

  const totalExpenses = monthTx.reduce((s,t) => s + Math.abs(Number(t.amount)), 0)
  const totalIncome = transactions.filter(t => t.date.startsWith(selectedMonth) && t.type === 'credit').reduce((s,t) => s + Math.abs(Number(t.amount)), 0)

  // Trend last 6 months per category
  const trendData = useMemo(() => {
    const last6 = availableMonths.slice(0,6).reverse()
    return last6.map(m => {
      const obj: any = { month: MONTHS[parseInt(m.split('-')[1])-1] }
      categoryMap.slice(0,5).forEach(([cat]) => {
        obj[cat] = transactions.filter(t => t.date.startsWith(m) && t.type === 'debit' && (t.category ?? 'Outros') === cat)
          .reduce((s,t) => s + Math.abs(Number(t.amount)), 0)
      })
      return obj
    })
  }, [transactions, availableMonths, categoryMap])

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48 rounded-xl" />
      <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i=><Skeleton key={i} className="h-28 rounded-2xl"/>)}</div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  )

  const pieData = categoryMap.slice(0,8).map(([name,v]) => ({ name, value: v.total }))

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Categorias</h2>
          <p className="text-sm text-muted-foreground">Análise detalhada dos seus gastos</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {availableMonths.slice(0,6).map(m => {
            const [y,mo] = m.split('-')
            return (
              <button key={m} onClick={() => setSelectedMonth(m)} style={{
                background: selectedMonth===m ? '#10b981' : '#1e293b',
                color: selectedMonth===m ? '#000' : '#94a3b8',
                border: 'none', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer'
              }}>
                {MONTHS[parseInt(mo)-1]}/{y.slice(2)}
              </button>
            )
          })}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total de Gastos', value: fmt(totalExpenses), color: '#ef4444', sub: `${monthTx.length} transações` },
          { label: 'Total de Receitas', value: fmt(totalIncome), color: '#10b981', sub: `${transactions.filter(t=>t.date.startsWith(selectedMonth)&&t.type==='credit').length} entradas` },
          { label: 'Saldo do Período', value: fmt(totalIncome - totalExpenses), color: totalIncome-totalExpenses>=0?'#10b981':'#ef4444', sub: totalIncome>0?`${((totalIncome-totalExpenses)/totalIncome*100).toFixed(0)}% poupado`:'Sem receitas' },
        ].map(k => (
          <div key={k.label} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: '20px 24px' }}>
            <p className="text-sm text-muted-foreground mb-1">{k.label}</p>
            <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
            <p className="text-xs mt-1" style={{ color: '#64748b' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {categoryMap.length === 0 ? (
        <div style={{ background: '#0f172a', border: '1px dashed #1e293b', borderRadius: 16, padding: 64, textAlign: 'center' }}>
          <TrendingDown className="h-12 w-12 mx-auto mb-4" style={{ color: '#334155' }} />
          <p className="text-white font-semibold">Nenhuma transação neste mês</p>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>Conecte seu banco para ver suas categorias de gastos.</p>
        </div>
      ) : (
        <>
          {/* Pie + barras */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: '20px 24px' }}>
              <p className="font-semibold text-white mb-4">Distribuição por Categoria</p>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value">
                    {pieData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} stroke="transparent" />)}
                  </Pie>
                  <Tooltip formatter={(v:number) => fmt(v)} contentStyle={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:8, fontSize:12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: '20px 24px' }}>
              <p className="font-semibold text-white mb-4">Tendência (6 meses)</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={trendData} margin={{ top:4, right:4, left:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" tick={{ fontSize:10, fill:'#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:10, fill:'#64748b' }} axisLine={false} tickLine={false} width={50}
                    tickFormatter={v => v>=1000?`R$${(v/1000).toFixed(0)}k`:`R$${v}`} />
                  <Tooltip formatter={(v:number) => fmt(v)} contentStyle={{ background:'#0f172a', border:'1px solid #1e293b', borderRadius:8, fontSize:12 }} />
                  {categoryMap.slice(0,5).map(([cat],i) => (
                    <Bar key={cat} dataKey={cat} stackId="a" fill={COLORS[i%COLORS.length]} radius={i===categoryMap.slice(0,5).length-1?[4,4,0,0]:[0,0,0,0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Lista de categorias expandível */}
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e293b' }}>
              <p className="font-semibold text-white">Detalhe por Categoria</p>
              <p className="text-xs mt-1" style={{ color: '#64748b' }}>Clique para expandir as transações</p>
            </div>
            {categoryMap.map(([cat, data], i) => {
              const pct = totalExpenses > 0 ? (data.total/totalExpenses*100) : 0
              const isOpen = expandedCat === cat
              return (
                <div key={cat}>
                  <button className="w-full text-left"
                    onClick={() => setExpandedCat(isOpen ? null : cat)}
                    style={{ display:'flex', alignItems:'center', padding:'14px 24px', gap:12, background:'transparent', border:'none', borderBottom:`1px solid #0f172a`, cursor:'pointer', width:'100%' }}
                    onMouseEnter={e => (e.currentTarget.style.background='#1e293b')}
                    onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                    <span style={{ width:12, height:12, borderRadius:'50%', background:COLORS[i%COLORS.length], flexShrink:0 }} />
                    <span className="text-sm font-medium text-white flex-1 text-left">{cat}</span>
                    <span className="text-xs" style={{ color:'#64748b' }}>{data.transactions.length} transações</span>
                    <div style={{ width:80, height:4, background:'#1e293b', borderRadius:4, overflow:'hidden', margin:'0 12px' }}>
                      <div style={{ width:`${pct}%`, height:'100%', background:COLORS[i%COLORS.length], borderRadius:4 }} />
                    </div>
                    <span className="text-sm font-bold tabular-nums" style={{ color:'#f1f5f9', minWidth:90, textAlign:'right' }}>{fmt(data.total)}</span>
                    <span className="text-xs" style={{ color:'#64748b', minWidth:36, textAlign:'right' }}>{pct.toFixed(0)}%</span>
                    {isOpen ? <ChevronUp className="h-4 w-4 flex-shrink-0" style={{ color:'#64748b' }} /> : <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color:'#64748b' }} />}
                  </button>
                  {isOpen && (
                    <div style={{ background:'#0a0f1a', borderBottom:'1px solid #1e293b' }}>
                      {data.transactions.slice(0,20).map(t => (
                        <div key={t.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 24px 10px 48px', borderBottom:'1px solid #0f172a' }}>
                          <div>
                            <p className="text-sm text-white">{t.description}</p>
                            <p className="text-xs" style={{ color:'#64748b' }}>{new Date(t.date).toLocaleDateString('pt-BR')}</p>
                          </div>
                          <span className="text-sm font-semibold tabular-nums text-red-400">-{fmt(Math.abs(Number(t.amount)))}</span>
                        </div>
                      ))}
                      {data.transactions.length > 20 && (
                        <p className="text-xs text-center py-3" style={{ color:'#64748b' }}>+{data.transactions.length-20} transações</p>
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
