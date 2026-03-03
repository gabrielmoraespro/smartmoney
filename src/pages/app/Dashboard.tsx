import { useEffect, useMemo, useState, useCallback } from 'react'
import { getUserAuthHeaders, supabase } from '../../lib/supabase'
import type { Account, Transaction } from '../../lib/types'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Skeleton } from '../../components/ui/skeleton'
import {
  Eye, EyeOff, TrendingUp, TrendingDown, Wallet,
  ArrowUpRight, ArrowDownRight, ChevronRight,
  Flame, CreditCard, Calendar, BarChart2,
  RefreshCw, AlertCircle
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts'

// ─── Constants ──────────────────────────────────────────────────────────────
const COLORS = ['#6ee7b7', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#f472b6', '#34d399', '#818cf8']
const QUICK_CATEGORIES = ['Todas', 'Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Outros']

type Period = '7d' | '30d' | 'month' | 'last_month' | '3m' | '12m'
const PERIODS: { key: Period; label: string }[] = [
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: 'month', label: 'Este mês' },
  { key: 'last_month', label: 'Mês anterior' },
  { key: '3m', label: '3 meses' },
  { key: '12m', label: '12 meses' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtShort = (v: number) => v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v.toFixed(0)}`
const pct = (a: number, b: number) => b === 0 ? 0 : ((a - b) / b) * 100

function getPeriodRange(period: Period): { start: Date; end: Date } {
  const now = new Date()
  const end = new Date(now); end.setHours(23, 59, 59, 999)

  switch (period) {
    case '7d': {
      const start = new Date(now); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0)
      return { start, end }
    }
    case '30d': {
      const start = new Date(now); start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0)
      return { start, end }
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start, end }
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const e = new Date(now.getFullYear(), now.getMonth(), 0); e.setHours(23, 59, 59, 999)
      return { start, end: e }
    }
    case '3m': {
      const start = new Date(now); start.setMonth(start.getMonth() - 3); start.setHours(0, 0, 0, 0)
      return { start, end }
    }
    case '12m': {
      const start = new Date(now); start.setFullYear(start.getFullYear() - 1); start.setHours(0, 0, 0, 0)
      return { start, end }
    }
  }
}

function getComparisonRange(period: Period): { start: Date; end: Date } | null {
  const now = new Date()
  switch (period) {
    case '7d': {
      const end = new Date(now); end.setDate(end.getDate() - 7); end.setHours(23, 59, 59, 999)
      const start = new Date(end); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0)
      return { start, end }
    }
    case '30d': {
      const end = new Date(now); end.setDate(end.getDate() - 30); end.setHours(23, 59, 59, 999)
      const start = new Date(end); start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0)
      return { start, end }
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0); end.setHours(23, 59, 59, 999)
      return { start, end }
    }
    default: return null
  }
}

// ─── Components ──────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, showValues }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <p style={{ color: '#8b949e', marginBottom: 6 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {showValues ? fmt(p.value) : '••••'}
        </p>
      ))}
    </div>
  )
}

function HeatmapCalendar({ transactions, showValues }: { transactions: Transaction[]; showValues: boolean }) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()

  const dailySpend = useMemo(() => {
    const map: Record<string, number> = {}
    transactions
      .filter(t => t.type === 'debit')
      .forEach(t => {
        const d = t.date.substring(0, 10)
        const txMonth = new Date(`${d}T00:00:00`).getMonth()
        if (txMonth === month) map[d] = (map[d] ?? 0) + Math.abs(Number(t.amount))
      })
    return map
  }, [transactions, month])

  const maxSpend = Math.max(...Object.values(dailySpend), 1)
  const weekLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const getColor = (spend: number) => {
    const ratio = spend / maxSpend
    if (ratio === 0) return '#161b22'
    if (ratio < 0.25) return '#0e4429'
    if (ratio < 0.5) return '#006d32'
    if (ratio < 0.75) return '#26a641'
    return '#39d353'
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
        {weekLabels.map((l, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 9, color: '#484f58', fontWeight: 600 }}>{l}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const spend = dailySpend[dateStr] ?? 0
          const isToday = day === today.getDate()
          return (
            <div
              key={i}
              title={showValues ? `${day}: ${fmt(spend)}` : `${day}: ••••`}
              style={{
                aspectRatio: '1',
                borderRadius: 3,
                background: getColor(spend),
                border: isToday ? '1px solid #58a6ff' : '1px solid transparent',
                cursor: spend > 0 ? 'pointer' : 'default',
                transition: 'transform 0.1s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.3)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)' }}
            />
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 9, color: '#484f58' }}>Menos</span>
        {['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'].map((c, i) => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
        ))}
        <span style={{ fontSize: 9, color: '#484f58' }}>Mais</span>
      </div>
    </div>
  )
}

function RhythmCard({ transactions, showValues }: { transactions: Transaction[]; showValues: boolean }) {
  const now = new Date()
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

  const currentMonthTx = transactions.filter(t => {
    const d = new Date(`${t.date}T00:00:00`)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.type === 'debit'
  })

  const totalSpent = currentMonthTx.reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
  const dailyAvg = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0
  const projected = dailyAvg * daysInMonth
  const progressPct = (dayOfMonth / daysInMonth) * 100
  const budgetPct = Math.min((totalSpent / Math.max(projected, 1)) * 100, 100)

  const tempo = dailyAvg > 200 ? 'Alto' : dailyAvg > 80 ? 'Moderado' : 'Baixo'
  const tempoColor = dailyAvg > 200 ? '#ef4444' : dailyAvg > 80 ? '#f59e0b' : '#10b981'

  return (
    <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 16, padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1c2128', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Flame style={{ width: 14, height: 14, color: '#f59e0b' }} />
        </div>
        <div>
          <p style={{ color: '#e6edf3', fontWeight: 600, fontSize: 14 }}>Ritmo de Gastos</p>
          <p style={{ color: '#484f58', fontSize: 11 }}>Mês atual · dia {dayOfMonth}/{daysInMonth}</p>
        </div>
        <div style={{ marginLeft: 'auto', background: `${tempoColor}20`, color: tempoColor, fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>
          {tempo}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#161b22', borderRadius: 10, padding: '12px 14px' }}>
          <p style={{ color: '#484f58', fontSize: 10, marginBottom: 4 }}>Média diária</p>
          <p style={{ color: '#e6edf3', fontWeight: 700, fontSize: 16 }}>{showValues ? fmtShort(dailyAvg) : '••••'}</p>
        </div>
        <div style={{ background: '#161b22', borderRadius: 10, padding: '12px 14px' }}>
          <p style={{ color: '#484f58', fontSize: 10, marginBottom: 4 }}>Projeção mensal</p>
          <p style={{ color: projected > totalSpent * 1.2 ? '#f59e0b' : '#e6edf3', fontWeight: 700, fontSize: 16 }}>{showValues ? fmtShort(projected) : '••••'}</p>
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ color: '#484f58', fontSize: 11 }}>Progresso do mês</span>
          <span style={{ color: '#8b949e', fontSize: 11 }}>{progressPct.toFixed(0)}%</span>
        </div>
        <div style={{ height: 6, background: '#21262d', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: '#21262d', borderRadius: 4 }} />
          <div style={{ position: 'absolute', top: 0, left: 0, width: `${budgetPct * progressPct / 100}%`, height: '100%', background: tempoColor, borderRadius: 4, transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ color: tempoColor, fontSize: 11, fontWeight: 600 }}>{showValues ? fmt(totalSpent) : '•••••'} gastos</span>
          <span style={{ color: '#484f58', fontSize: 11 }}>{daysInMonth - dayOfMonth} dias restantes</span>
        </div>
      </div>
    </div>
  )
}

function MonthComparison({ current, previous, showValues }: { current: number; previous: number; showValues: boolean }) {
  const diff = current - previous
  const diffPct = pct(current, previous)
  const isUp = diff > 0

  return (
    <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 16, padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1c2128', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BarChart2 style={{ width: 14, height: 14, color: '#60a5fa' }} />
        </div>
        <div>
          <p style={{ color: '#e6edf3', fontWeight: 600, fontSize: 14 }}>Mês Atual vs Anterior</p>
          <p style={{ color: '#484f58', fontSize: 11 }}>Comparativo de gastos</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={{ background: '#161b22', borderRadius: 10, padding: '12px 14px' }}>
          <p style={{ color: '#484f58', fontSize: 10, marginBottom: 4 }}>Este mês</p>
          <p style={{ color: '#e6edf3', fontWeight: 700, fontSize: 16 }}>{showValues ? fmtShort(current) : '••••'}</p>
        </div>
        <div style={{ background: '#161b22', borderRadius: 10, padding: '12px 14px' }}>
          <p style={{ color: '#484f58', fontSize: 10, marginBottom: 4 }}>Mês anterior</p>
          <p style={{ color: '#8b949e', fontWeight: 700, fontSize: 16 }}>{showValues ? fmtShort(previous) : '••••'}</p>
        </div>
      </div>

      {previous > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: isUp ? '#2d1b1b' : '#0d2818', borderRadius: 10, border: `1px solid ${isUp ? '#7f1d1d' : '#14532d'}` }}>
          {isUp
            ? <TrendingUp style={{ width: 16, height: 16, color: '#ef4444', flexShrink: 0 }} />
            : <TrendingDown style={{ width: 16, height: 16, color: '#10b981', flexShrink: 0 }} />
          }
          <p style={{ color: isUp ? '#ef4444' : '#10b981', fontSize: 13, fontWeight: 600 }}>
            {isUp ? '+' : ''}{diffPct.toFixed(1)}% {isUp ? 'mais gastos' : 'de economia'}
            {showValues && <span style={{ color: '#8b949e', fontWeight: 400 }}> ({isUp ? '+' : ''}{fmt(diff)})</span>}
          </p>
        </div>
      )}

      {previous === 0 && (
        <p style={{ color: '#484f58', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>Sem dados do mês anterior</p>
      )}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [period, setPeriod] = useState<Period>('month')
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsMap, setAccountsMap] = useState<Record<string, string>>({})
  const [selectedCategory, setSelectedCategory] = useState('Todas')
  const [showValues, setShowValues] = useState(true)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null)

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true)
      setError('')

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const headers = await getUserAuthHeaders()
      const baseUrl = import.meta.env.VITE_SUPABASE_URL as string

      const [txRes, accountsRes] = await Promise.all([
        fetch(`${baseUrl}/rest/v1/transactions?user_id=eq.${user.id}&order=date.desc&limit=500`, { headers }),
        fetch(`${baseUrl}/rest/v1/accounts?user_id=eq.${user.id}&select=*`, { headers }),
      ])

      if (!txRes.ok || !accountsRes.ok) throw new Error('Falha ao carregar dados.')

      const txData = await txRes.json()
      const accountsData = await accountsRes.json()

      const accs = (accountsData ?? []) as Account[]
      setAccounts(accs)
      const map = accs.reduce((acc, item) => { acc[item.id] = item.bank_name; return acc }, {} as Record<string, string>)
      setAccountsMap(map)
      setAllTransactions((txData ?? []) as Transaction[])
    } catch (e: any) {
      setError(e.message ?? 'Erro ao carregar dados.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Derived data ────────────────────────────────────────────────────────────
  const { start, end } = useMemo(() => getPeriodRange(period), [period])
  const compRange = useMemo(() => getComparisonRange(period), [period])

  const periodTransactions = useMemo(() =>
    allTransactions.filter(t => {
      const d = t.date.substring(0, 10)
      return d >= start.toISOString().substring(0, 10) && d <= end.toISOString().substring(0, 10)
    }), [allTransactions, start, end])

  const prevTransactions = useMemo(() =>
    compRange
      ? allTransactions.filter(t => {
          const d = t.date.substring(0, 10)
          return d >= compRange.start.toISOString().substring(0, 10) && d <= compRange.end.toISOString().substring(0, 10)
        })
      : [], [allTransactions, compRange])

  const stats = useMemo(() => {
    const income = periodTransactions.filter(t => t.type === 'credit').reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
    const expenses = periodTransactions.filter(t => t.type === 'debit').reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
    return { income, expenses, balance: income - expenses }
  }, [periodTransactions])

  const prevExpenses = useMemo(() =>
    prevTransactions.filter(t => t.type === 'debit').reduce((s, t) => s + Math.abs(Number(t.amount)), 0),
    [prevTransactions])

  const categories = useMemo(() => {
    const catMap: Record<string, number> = {}
    periodTransactions.filter(t => t.type === 'debit').forEach(t => {
      const cat = t.category ?? 'Outros'
      catMap[cat] = (catMap[cat] ?? 0) + Math.abs(Number(t.amount))
    })
    return Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }))
  }, [periodTransactions])

  const cashflowData = useMemo(() => {
    const days = Math.min(Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1, 90)
    const dailyMap: Record<string, { entradas: number; saidas: number }> = {}
    for (let i = 0; i < days; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i)
      dailyMap[d.toISOString().substring(0, 10)] = { entradas: 0, saidas: 0 }
    }
    periodTransactions.forEach(t => {
      if (!dailyMap[t.date]) return
      if (t.type === 'credit') dailyMap[t.date].entradas += Math.abs(Number(t.amount))
      else dailyMap[t.date].saidas += Math.abs(Number(t.amount))
    })

    // For 12m, group by month
    if (period === '12m') {
      const monthlyMap: Record<string, { entradas: number; saidas: number }> = {}
      Object.entries(dailyMap).forEach(([date, vals]) => {
        const key = date.substring(0, 7)
        if (!monthlyMap[key]) monthlyMap[key] = { entradas: 0, saidas: 0 }
        monthlyMap[key].entradas += vals.entradas
        monthlyMap[key].saidas += vals.saidas
      })
      return Object.entries(monthlyMap).map(([month, v]) => ({
        day: new Date(`${month}-01T00:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        entradas: v.entradas,
        saidas: v.saidas,
      }))
    }

    return Object.entries(dailyMap).map(([date, values]) => ({
      day: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      entradas: values.entradas,
      saidas: values.saidas,
    }))
  }, [periodTransactions, start, end, period])

  const filteredTransactions = useMemo(() =>
    periodTransactions
      .filter(t => selectedCategory === 'Todas' || (t.category ?? 'Outros').toLowerCase().includes(selectedCategory.toLowerCase()))
      .slice(0, 20),
    [periodTransactions, selectedCategory])

  const totalExpenses = categories.reduce((s, c) => s + c.value, 0)

  // Account cards: checking balance + credit limit
  const checkingBalance = useMemo(() =>
    accounts.filter(a => a.is_active && a.type !== 'credit').reduce((s, a) => s + (Number(a.balance) || 0), 0),
    [accounts])

  const creditAccounts = useMemo(() => accounts.filter(a => a.is_active && a.type === 'credit'), [accounts])

  const money = (value: number, withSign = false, type?: 'credit' | 'debit') => {
    if (!showValues) return withSign ? (type === 'credit' ? '+ •••••' : '- •••••') : '•••••'
    const base = fmt(Math.abs(value))
    if (!withSign) return base
    return `${type === 'credit' ? '+' : '-'}${base}`
  }

  const now = new Date()
  const monthLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 p-1">
        <div className="flex justify-between items-center">
          <div className="space-y-2"><Skeleton className="h-7 w-40" /><Skeleton className="h-4 w-56" /></div>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  const hasData = allTransactions.length > 0

  return (
    <div style={{ minHeight: '100vh', color: '#e6edf3', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e6edf3', margin: 0 }}>Dashboard</h1>
          <p style={{ color: '#484f58', fontSize: 13, marginTop: 4, textTransform: 'capitalize' }}>
            Resumo de {monthLabel}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#161b22', border: '1px solid #30363d', borderRadius: 8, color: '#8b949e', fontSize: 12, cursor: 'pointer' }}
          >
            <RefreshCw style={{ width: 13, height: 13, animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
          <button
            onClick={() => setShowValues(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#161b22', border: '1px solid #30363d', borderRadius: 8, color: '#8b949e', fontSize: 12, cursor: 'pointer' }}
          >
            {showValues ? <EyeOff style={{ width: 13, height: 13 }} /> : <Eye style={{ width: 13, height: 13 }} />}
            {showValues ? 'Ocultar saldos' : 'Mostrar saldos'}
          </button>
        </div>
      </div>

      {/* ── Period Selector ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, background: '#161b22', padding: 4, borderRadius: 12, width: 'fit-content', flexWrap: 'wrap' }}>
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            style={{
              padding: '6px 16px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: period === p.key ? '#238636' : 'transparent',
              color: period === p.key ? '#fff' : '#8b949e',
              transition: 'all 0.15s',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#2d1b1b', border: '1px solid #7f1d1d', borderRadius: 12, marginBottom: 20 }}>
          <AlertCircle style={{ width: 16, height: 16, color: '#ef4444' }} />
          <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {/* Saldo */}
        <div style={{ borderRadius: 16, padding: '20px 24px', background: stats.balance >= 0 ? 'linear-gradient(135deg, #0d2818 0%, #052e16 100%)' : 'linear-gradient(135deg, #2d1b1b 0%, #1a0a0a 100%)', border: `1px solid ${stats.balance >= 0 ? '#166534' : '#7f1d1d'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <p style={{ color: '#6b7280', fontSize: 12, fontWeight: 500 }}>Saldo do Período</p>
            <Wallet style={{ width: 16, height: 16, color: stats.balance >= 0 ? '#4ade80' : '#f87171' }} />
          </div>
          <p style={{ fontSize: 26, fontWeight: 700, color: stats.balance >= 0 ? '#4ade80' : '#f87171', marginBottom: 6 }}>
            {showValues ? fmt(stats.balance) : '•••••'}
          </p>
          <p style={{ color: '#4b5563', fontSize: 12 }}>{stats.balance >= 0 ? 'Resultado positivo' : 'Resultado negativo'}</p>
        </div>

        {/* Entradas */}
        <div style={{ borderRadius: 16, padding: '20px 24px', background: '#0d1117', border: '1px solid #21262d' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <p style={{ color: '#6b7280', fontSize: 12, fontWeight: 500 }}>Entradas</p>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#064e3b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp style={{ width: 14, height: 14, color: '#10b981' }} />
            </div>
          </div>
          <p style={{ fontSize: 26, fontWeight: 700, color: '#e6edf3', marginBottom: 6 }}>
            {showValues ? fmt(stats.income) : '•••••'}
          </p>
          <p style={{ color: '#10b981', fontSize: 12 }}>↑ receitas no período</p>
        </div>

        {/* Saídas */}
        <div style={{ borderRadius: 16, padding: '20px 24px', background: '#0d1117', border: '1px solid #21262d' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <p style={{ color: '#6b7280', fontSize: 12, fontWeight: 500 }}>Saídas</p>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#450a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingDown style={{ width: 14, height: 14, color: '#ef4444' }} />
            </div>
          </div>
          <p style={{ fontSize: 26, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>
            {showValues ? fmt(stats.expenses) : '•••••'}
          </p>
          <p style={{ color: '#6b7280', fontSize: 12 }}>↓ despesas no período</p>
        </div>
      </div>

      {!hasData ? (
        <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
          <Wallet style={{ width: 48, height: 48, color: '#30363d', margin: '0 auto 16px' }} />
          <p style={{ color: '#e6edf3', fontWeight: 600, marginBottom: 8 }}>Nenhuma transação encontrada</p>
          <p style={{ color: '#484f58', fontSize: 13 }}>Conecte sua conta bancária para visualizar seus dados financeiros.</p>
        </div>
      ) : (
        <>
          {/* ── Account + Credit Cards Row ── */}
          {accounts.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: creditAccounts.length > 0 ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 20 }}>
              {/* Saldo em conta */}
              <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 16, padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1c2128', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Wallet style={{ width: 14, height: 14, color: '#60a5fa' }} />
                  </div>
                  <div>
                    <p style={{ color: '#e6edf3', fontWeight: 600, fontSize: 14 }}>Contas Correntes</p>
                    <p style={{ color: '#484f58', fontSize: 11 }}>{accounts.filter(a => a.is_active && a.type !== 'credit').length} conta(s) ativa(s)</p>
                  </div>
                </div>
                <p style={{ fontSize: 28, fontWeight: 700, color: checkingBalance >= 0 ? '#4ade80' : '#f87171', marginBottom: 8 }}>
                  {showValues ? fmt(checkingBalance) : '•••••'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {accounts.filter(a => a.is_active && a.type !== 'credit').map(a => (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#161b22', borderRadius: 8 }}>
                      <span style={{ color: '#8b949e', fontSize: 12 }}>{a.bank_name}</span>
                      <span style={{ color: '#e6edf3', fontSize: 12, fontWeight: 600 }}>{showValues ? fmt(Number(a.balance) || 0) : '••••'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Limite de crédito */}
              {creditAccounts.length > 0 && (
                <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 16, padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1c2128', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CreditCard style={{ width: 14, height: 14, color: '#a78bfa' }} />
                    </div>
                    <div>
                      <p style={{ color: '#e6edf3', fontWeight: 600, fontSize: 14 }}>Limite Disponível</p>
                      <p style={{ color: '#484f58', fontSize: 11 }}>{creditAccounts.length} cartão(ões)</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 28, fontWeight: 700, color: '#a78bfa', marginBottom: 8 }}>
                    {showValues ? fmt(creditAccounts.reduce((s, a) => s + (Number(a.balance) || 0), 0)) : '•••••'}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {creditAccounts.map(a => (
                      <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#161b22', borderRadius: 8 }}>
                        <span style={{ color: '#8b949e', fontSize: 12 }}>{a.bank_name}</span>
                        <span style={{ color: '#a78bfa', fontSize: 12, fontWeight: 600 }}>{showValues ? fmt(Number(a.balance) || 0) : '••••'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Cashflow Chart ── */}
          <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <p style={{ fontWeight: 600, color: '#e6edf3', marginBottom: 4 }}>Fluxo de Caixa</p>
                <p style={{ fontSize: 11, color: '#484f58' }}>
                  Entradas vs Saídas — {PERIODS.find(p => p.key === period)?.label}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                  <span style={{ fontSize: 11, color: '#8b949e' }}>Entradas</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                  <span style={{ fontSize: 11, color: '#8b949e' }}>Saídas</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={cashflowData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradSaidas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#484f58' }} axisLine={false} tickLine={false}
                  interval={period === '12m' ? 0 : period === '30d' ? 4 : 'preserveStartEnd'} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: '#484f58' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip showValues={showValues} />} />
                <Area type="monotone" dataKey="entradas" name="Entradas" stroke="#10b981" strokeWidth={2} fill="url(#gradEntradas)" dot={false} />
                <Area type="monotone" dataKey="saidas" name="Saídas" stroke="#ef4444" strokeWidth={2} fill="url(#gradSaidas)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── Ritmo + Comparação Row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <RhythmCard transactions={allTransactions} showValues={showValues} />
            <MonthComparison
              current={stats.expenses}
              previous={prevExpenses}
              showValues={showValues}
            />
          </div>

          {/* ── Heatmap ── */}
          <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1c2128', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar style={{ width: 14, height: 14, color: '#39d353' }} />
              </div>
              <div>
                <p style={{ color: '#e6edf3', fontWeight: 600, fontSize: 14 }}>Mapa de Calor — Gastos do Mês</p>
                <p style={{ color: '#484f58', fontSize: 11 }}>Intensidade de gastos por dia</p>
              </div>
            </div>
            <HeatmapCalendar transactions={allTransactions} showValues={showValues} />
          </div>

          {/* ── Categories + Transactions Row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 16, marginBottom: 20 }}>
            {/* Categories donut */}
            <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 16, padding: '20px 24px' }}>
              <p style={{ fontWeight: 600, color: '#e6edf3', marginBottom: 4 }}>Despesas por Categoria</p>
              <p style={{ fontSize: 11, color: '#484f58', marginBottom: 16 }}>{PERIODS.find(p => p.key === period)?.label}</p>
              {categories.length === 0 ? (
                <p style={{ color: '#484f58', textAlign: 'center', padding: '32px 0', fontSize: 13 }}>Sem despesas categorizadas</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={categories} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value"
                        onMouseEnter={(_, i) => setActivePieIndex(i)} onMouseLeave={() => setActivePieIndex(null)}>
                        {categories.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={activePieIndex === null || activePieIndex === i ? 1 : 0.35} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => showValues ? fmt(v) : '••••'} contentStyle={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {categories.slice(0, 6).map((cat, i) => (
                      <div key={cat.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: '#8b949e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
                          <div style={{ width: 50, height: 4, background: '#21262d', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${(cat.value / totalExpenses) * 100}%`, height: '100%', background: COLORS[i % COLORS.length], borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#e6edf3', minWidth: 48, textAlign: 'right' }}>{showValues ? fmtShort(cat.value) : '••'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Transactions */}
            <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <p style={{ fontWeight: 600, color: '#e6edf3' }}>Transações Recentes</p>
                    <p style={{ fontSize: 11, color: '#484f58' }}>{filteredTransactions.length} transações</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12, scrollbarWidth: 'none' }}>
                  {QUICK_CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => setSelectedCategory(cat)} style={{
                      background: selectedCategory === cat ? '#238636' : '#21262d',
                      color: selectedCategory === cat ? '#fff' : '#8b949e',
                      border: 'none', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 600,
                      whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {filteredTransactions.length === 0 ? (
                  <p style={{ color: '#484f58', textAlign: 'center', padding: '40px 0', fontSize: 13 }}>Nenhuma transação para este filtro.</p>
                ) : (
                  filteredTransactions.map(t => (
                    <button key={t.id} onClick={() => setSelectedTransaction(t)}
                      style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '11px 24px', background: 'transparent', cursor: 'pointer', gap: 12, border: 'none', borderBottom: '1px solid #161b22' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#161b22')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: t.type === 'credit' ? '#064e3b' : '#2d1b1b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {t.type === 'credit'
                          ? <ArrowUpRight style={{ width: 14, height: 14, color: '#10b981' }} />
                          : <ArrowDownRight style={{ width: 14, height: 14, color: '#ef4444' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</p>
                        <p style={{ fontSize: 11, color: '#484f58' }}>{new Date(t.date).toLocaleDateString('pt-BR')} · {t.category ?? 'Outros'}</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: t.type === 'credit' ? '#10b981' : '#f87171' }}>
                          {t.type === 'credit' ? '+' : '-'}{showValues ? fmt(Math.abs(Number(t.amount))) : '•••••'}
                        </p>
                      </div>
                      <ChevronRight style={{ width: 12, height: 12, color: '#30363d', flexShrink: 0 }} />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── Top Categories Bar Chart ── */}
          {categories.length > 0 && (
            <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
              <p style={{ fontWeight: 600, color: '#e6edf3', marginBottom: 4 }}>Top Gastos por Categoria</p>
              <p style={{ fontSize: 11, color: '#484f58', marginBottom: 20 }}>Comparativo — {PERIODS.find(p => p.key === period)?.label}</p>
              <ResponsiveContainer width="100%" height={Math.max(categories.length * 32, 120)}>
                <BarChart data={categories} layout="vertical" margin={{ top: 0, right: 80, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#8b949e' }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip formatter={(v: number) => showValues ? fmt(v) : '••••'} contentStyle={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" name="Gasto" radius={[0, 6, 6, 0]} label={{ position: 'right', formatter: (v: number) => showValues ? fmtShort(v) : '••', fontSize: 11, fill: '#8b949e' }}>
                    {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* ── Transaction Detail Dialog ── */}
      <Dialog open={Boolean(selectedTransaction)} onOpenChange={open => !open && setSelectedTransaction(null)}>
        <DialogContent className="sm:max-w-md" style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 16 }}>
          <DialogHeader>
            <DialogTitle style={{ color: '#e6edf3' }}>Detalhes da Transação</DialogTitle>
            <DialogDescription style={{ color: '#484f58' }}>Informações completas da movimentação.</DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                ['Descrição', selectedTransaction.description],
                ['Data', new Date(selectedTransaction.date).toLocaleDateString('pt-BR')],
                ['Categoria', selectedTransaction.category ?? 'Outros'],
                ['Conta', accountsMap[selectedTransaction.account_id] ?? 'Conta não identificada'],
                ['Valor', money(Number(selectedTransaction.amount), true, selectedTransaction.type)],
                ['Método', selectedTransaction.payment_method ?? 'N/A'],
                ['ID Pluggy', selectedTransaction.pluggy_transaction_id ?? 'N/A'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #21262d' }}>
                  <span style={{ fontSize: 13, color: '#484f58' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#e6edf3', textAlign: 'right', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
