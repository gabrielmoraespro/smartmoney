import { useEffect, useMemo, useState } from 'react'
import { getUserAuthHeaders, supabase } from '../../lib/supabase'
import type { Account, Transaction } from '../../lib/types'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Skeleton } from '../../components/ui/skeleton'
import { Eye, EyeOff, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, ChevronRight } from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts'

const COLORS = ['#6ee7b7', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#f472b6', '#34d399', '#818cf8']
const QUICK_CATEGORIES = ['Todas', 'Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Outros']

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtShort = (v: number) => (v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v.toFixed(0)}`)

const CustomTooltip = ({ active, payload, label, showValues }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <p style={{ color: '#94a3b8', marginBottom: 6 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {showValues ? fmt(p.value) : '••••'}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState({ income: 0, expenses: 0, balance: 0 })
  const [cashflow30d, setCashflow30d] = useState<{ day: string; entradas: number; saidas: number }[]>([])
  const [categories, setCategories] = useState<{ name: string; value: number }[]>([])
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [accountsMap, setAccountsMap] = useState<Record<string, string>>({})
  const [selectedCategory, setSelectedCategory] = useState('Todas')
  const [hasConnectedAccounts, setHasConnectedAccounts] = useState(false)
  const [showValues, setShowValues] = useState(true)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const now = new Date()
        const startOfMonth = new Date(now); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
        const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); thirtyDaysAgo.setHours(0, 0, 0, 0)

        const headers = await getUserAuthHeaders()
        const baseUrl = import.meta.env.VITE_SUPABASE_URL as string

        const [txRes, accountsRes] = await Promise.all([
          fetch(`${baseUrl}/rest/v1/transactions?user_id=eq.${user.id}&order=date.desc&limit=200`, { headers }),
          fetch(`${baseUrl}/rest/v1/accounts?user_id=eq.${user.id}&select=id,bank_name,is_active`, { headers }),
        ])

        if (!txRes.ok || !accountsRes.ok) throw new Error('Falha ao carregar dados.')

        const txData = await txRes.json()
        const accountsData = await accountsRes.json()

        const allAccounts = (accountsData ?? []) as Pick<Account, 'id' | 'bank_name' | 'is_active'>[]
        const map = allAccounts.reduce((acc, item) => { acc[item.id] = item.bank_name; return acc }, {} as Record<string, string>)
        setAccountsMap(map)
        setHasConnectedAccounts(allAccounts.some((a) => a.is_active))

        const allTransactions = (txData ?? []) as Transaction[]
        setRecentTransactions(allTransactions)

        const thisMonthTx = allTransactions.filter((t) => t.date >= startOfMonth.toISOString().substring(0, 10))
        const income = thisMonthTx.filter((t) => t.type === 'credit').reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
        const expenses = thisMonthTx.filter((t) => t.type === 'debit').reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
        setStats({ income, expenses, balance: income - expenses })

        const monthCatMap: Record<string, number> = {}
        thisMonthTx.filter((t) => t.type === 'debit').forEach((t) => {
          const cat = t.category ?? 'Outros'
          monthCatMap[cat] = (monthCatMap[cat] ?? 0) + Math.abs(Number(t.amount))
        })
        setCategories(Object.entries(monthCatMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value })))

        const dailyMap: Record<string, { entradas: number; saidas: number }> = {}
        for (let i = 0; i < 30; i++) {
          const d = new Date(thirtyDaysAgo); d.setDate(thirtyDaysAgo.getDate() + i)
          dailyMap[d.toISOString().substring(0, 10)] = { entradas: 0, saidas: 0 }
        }
        allTransactions.filter((t) => t.date >= thirtyDaysAgo.toISOString().substring(0, 10)).forEach((t) => {
          if (!dailyMap[t.date]) return
          if (t.type === 'credit') dailyMap[t.date].entradas += Math.abs(Number(t.amount))
          else dailyMap[t.date].saidas += Math.abs(Number(t.amount))
        })
        setCashflow30d(Object.entries(dailyMap).map(([date, values]) => ({
          day: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          entradas: values.entradas,
          saidas: values.saidas,
        })))
      } catch (error) {
        console.error('[dashboard]', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const money = (value: number, withSign = false, type?: 'credit' | 'debit') => {
    if (!showValues) return withSign ? (type === 'credit' ? '+ •••••' : '- •••••') : '•••••'
    const base = fmt(Math.abs(value))
    if (!withSign) return base
    return `${type === 'credit' ? '+' : '-'}${base}`
  }

  const filteredTransactions = useMemo(() => {
    return recentTransactions
      .filter((t) => selectedCategory === 'Todas' || (t.category ?? 'Outros').toLowerCase().includes(selectedCategory.toLowerCase()))
      .slice(0, 15)
  }, [recentTransactions, selectedCategory])

  const totalExpenses = categories.reduce((s, c) => s + c.value, 0)

  if (loading) {
    return (
      <div className="space-y-6 p-1">
        <div className="flex justify-between items-center">
          <div className="space-y-2"><Skeleton className="h-7 w-40" /><Skeleton className="h-4 w-56" /></div>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  const hasTransactions = recentTransactions.length > 0
  const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const savingsRate = stats.income > 0 ? ((stats.balance / stats.income) * 100).toFixed(0) : '0'

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground text-sm capitalize">Resumo de {monthName}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowValues(s => !s)} className="gap-2 rounded-xl border-border/60">
          {showValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showValues ? 'Ocultar saldos' : 'Mostrar saldos'}
        </Button>
      </div>

      {!hasConnectedAccounts && (
        <div style={{ background: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)', border: '1px solid #1e3a4a', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' as const }}>
          <div>
            <p className="font-semibold text-white">Ative seu SmartMoney em 1 minuto</p>
            <p className="text-sm" style={{ color: '#94a3b8' }}>Conecte sua primeira conta via Pluggy para liberar o dashboard automático.</p>
          </div>
          <Button asChild size="sm" style={{ background: '#10b981', color: '#000', fontWeight: 600, borderRadius: 10 }}>
            <a href="/app/conectar-banco">Conectar conta →</a>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div style={{ background: stats.balance >= 0 ? 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)' : 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)', borderRadius: 16, padding: '20px 24px', border: `1px solid ${stats.balance >= 0 ? '#065f46' : '#991b1b'}` }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium" style={{ color: stats.balance >= 0 ? '#6ee7b7' : '#fca5a5' }}>Saldo do Mês</span>
            <Wallet className="h-4 w-4" style={{ color: stats.balance >= 0 ? '#6ee7b7' : '#fca5a5' }} />
          </div>
          <p className="text-3xl font-bold text-white">{money(stats.balance)}</p>
          <p className="text-xs mt-2" style={{ color: stats.balance >= 0 ? '#6ee7b7' : '#fca5a5' }}>
            {stats.income > 0 ? `Taxa de poupança: ${savingsRate}%` : 'Sem receitas no mês'}
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: '20px 24px' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium" style={{ color: '#94a3b8' }}>Entradas</span>
            <div style={{ background: '#064e3b', borderRadius: 8, padding: 6 }}>
              <TrendingUp className="h-4 w-4" style={{ color: '#10b981' }} />
            </div>
          </div>
          <p className="text-3xl font-bold" style={{ color: '#10b981' }}>{money(stats.income)}</p>
          <div className="flex items-center gap-1 mt-2">
            <ArrowUpRight className="h-3 w-3" style={{ color: '#10b981' }} />
            <span className="text-xs" style={{ color: '#64748b' }}>receitas no mês</span>
          </div>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: '20px 24px' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium" style={{ color: '#94a3b8' }}>Saídas</span>
            <div style={{ background: '#450a0a', borderRadius: 8, padding: 6 }}>
              <TrendingDown className="h-4 w-4" style={{ color: '#ef4444' }} />
            </div>
          </div>
          <p className="text-3xl font-bold" style={{ color: '#ef4444' }}>{money(stats.expenses)}</p>
          <div className="flex items-center gap-1 mt-2">
            <ArrowDownRight className="h-3 w-3" style={{ color: '#ef4444' }} />
            <span className="text-xs" style={{ color: '#64748b' }}>despesas no mês</span>
          </div>
        </div>
      </div>

      {!hasTransactions ? (
        <div style={{ background: '#0f172a', border: '1px dashed #1e293b', borderRadius: 16, padding: '64px 24px', textAlign: 'center' as const }}>
          <TrendingUp className="h-12 w-12 mx-auto mb-4" style={{ color: '#334155' }} />
          <h3 className="font-semibold text-white mb-2">Nenhuma transação ainda</h3>
          <p className="text-sm" style={{ color: '#64748b', maxWidth: 320, margin: '0 auto' }}>Conecte seu banco em "Conectar Banco" para sincronizar suas transações automaticamente.</p>
        </div>
      ) : (
        <>
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: '20px 24px' }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="font-semibold text-white">Fluxo de Caixa</p>
                <p className="text-xs" style={{ color: '#64748b' }}>Entradas vs Saídas — últimos 30 dias</p>
              </div>
              <div className="flex items-center gap-4 text-xs" style={{ color: '#64748b' }}>
                <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, borderRadius: 3, background: '#10b981', display: 'inline-block' }} />Entradas</span>
                <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, borderRadius: 3, background: '#ef4444', display: 'inline-block' }} />Saídas</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={cashflow30d} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => showValues ? fmtShort(v) : '••'} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={50} />
                <Tooltip content={<CustomTooltip showValues={showValues} />} />
                <Area type="monotone" dataKey="entradas" name="Entradas" stroke="#10b981" strokeWidth={2} fill="url(#gradIn)" />
                <Area type="monotone" dataKey="saidas" name="Saídas" stroke="#ef4444" strokeWidth={2} fill="url(#gradOut)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: '20px 24px' }} className="lg:col-span-2">
              <p className="font-semibold text-white mb-1">Despesas por Categoria</p>
              <p className="text-xs mb-4" style={{ color: '#64748b' }}>Mês atual</p>
              {categories.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: '#64748b' }}>Sem despesas categorizadas</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={categories} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value"
                        onMouseEnter={(_, i) => setActivePieIndex(i)} onMouseLeave={() => setActivePieIndex(null)}>
                        {categories.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={activePieIndex === null || activePieIndex === i ? 1 : 0.4} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => showValues ? fmt(v) : '••••'} contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {categories.slice(0, 5).map((cat, i) => (
                      <div key={cat.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block', flexShrink: 0 }} />
                          <span className="text-xs truncate max-w-28" style={{ color: '#94a3b8' }}>{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div style={{ width: 60, height: 4, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${(cat.value / totalExpenses) * 100}%`, height: '100%', background: COLORS[i % COLORS.length], borderRadius: 4 }} />
                          </div>
                          <span className="text-xs font-medium text-white tabular-nums">{showValues ? fmtShort(cat.value) : '••'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, overflow: 'hidden' }} className="lg:col-span-3">
              <div style={{ padding: '20px 24px 0' }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-semibold text-white">Transações Recentes</p>
                    <p className="text-xs" style={{ color: '#64748b' }}>{filteredTransactions.length} transações</p>
                  </div>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none' as const }}>
                  {QUICK_CATEGORIES.map((cat) => (
                    <button key={cat} onClick={() => setSelectedCategory(cat)} style={{ background: selectedCategory === cat ? '#10b981' : '#1e293b', color: selectedCategory === cat ? '#000' : '#94a3b8', border: 'none', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' as const, cursor: 'pointer' }}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ maxHeight: 340, overflowY: 'auto' as const }}>
                {filteredTransactions.length === 0 ? (
                  <p className="text-sm text-center py-10" style={{ color: '#64748b' }}>Nenhuma transação para este filtro.</p>
                ) : (
                  filteredTransactions.map((t) => (
                    <button key={t.id} onClick={() => setSelectedTransaction(t)} className="w-full text-left"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid #0f172a', background: 'transparent', cursor: 'pointer', gap: 12 }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: t.type === 'credit' ? '#064e3b' : '#450a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {t.type === 'credit' ? <ArrowUpRight className="h-4 w-4" style={{ color: '#10b981' }} /> : <ArrowDownRight className="h-4 w-4" style={{ color: '#ef4444' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="text-sm font-medium text-white truncate">{t.description}</p>
                        <p className="text-xs" style={{ color: '#64748b' }}>{new Date(t.date).toLocaleDateString('pt-BR')} · {t.category ?? 'Outros'}</p>
                      </div>
                      <div className="text-right" style={{ flexShrink: 0 }}>
                        <p className={`text-sm font-bold tabular-nums ${t.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                          {t.type === 'credit' ? '+' : '-'}{showValues ? fmt(Math.abs(Number(t.amount))) : '•••••'}
                        </p>
                      </div>
                      <ChevronRight className="h-3 w-3 flex-shrink-0" style={{ color: '#334155' }} />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {categories.length > 0 && (
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: '20px 24px' }}>
              <p className="font-semibold text-white mb-1">Top Gastos por Categoria</p>
              <p className="text-xs mb-5" style={{ color: '#64748b' }}>Comparativo do mês atual</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={categories} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip formatter={(v: number) => showValues ? fmt(v) : '••••'} contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" name="Gasto" radius={[0, 6, 6, 0]}>
                    {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      <Dialog open={Boolean(selectedTransaction)} onOpenChange={(open) => !open && setSelectedTransaction(null)}>
        <DialogContent className="sm:max-w-md" style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16 }}>
          <DialogHeader>
            <DialogTitle className="text-white">Detalhes da Transação</DialogTitle>
            <DialogDescription style={{ color: '#64748b' }}>Informações completas da movimentação.</DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-3">
              {[
                ['Descrição', selectedTransaction.description],
                ['Data', new Date(selectedTransaction.date).toLocaleDateString('pt-BR')],
                ['Categoria', selectedTransaction.category ?? 'Outros'],
                ['Conta', accountsMap[selectedTransaction.account_id] ?? 'Conta não identificada'],
                ['Valor', money(Number(selectedTransaction.amount), true, selectedTransaction.type)],
                ['ID Pluggy', selectedTransaction.pluggy_transaction_id ?? 'N/A'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1e293b' }}>
                  <span className="text-sm" style={{ color: '#64748b' }}>{label}</span>
                  <span className="text-sm font-medium text-white text-right max-w-xs truncate">{value}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
