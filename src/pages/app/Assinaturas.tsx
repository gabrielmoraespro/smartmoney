import { useEffect, useState, useMemo } from 'react'
import { getUserAuthHeaders, supabase } from '../../lib/supabase'
import type { Transaction } from '../../lib/types'
import { Skeleton } from '../../components/ui/skeleton'
import { RefreshCw, AlertCircle } from 'lucide-react'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Subscription {
  description: string
  amount: number
  lastDate: string
  nextDate: string
  occurrences: number
  transactions: Transaction[]
  category: string
  status: 'active' | 'late'
}

function detectSubscriptions(transactions: Transaction[]): Subscription[] {
  const debits = transactions.filter(t => t.type === 'debit')
  const grouped: Record<string, Transaction[]> = {}

  debits.forEach(t => {
    const key = t.description.toLowerCase().trim().replace(/\s+/g, ' ')
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(t)
  })

  const subs: Subscription[] = []
  const now = new Date()

  Object.entries(grouped).forEach(([, txs]) => {
    if (txs.length < 2) return
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date))
    const amounts = sorted.map(t => Math.abs(Number(t.amount)))
    const avgAmount = amounts.reduce((s, v) => s + v, 0) / amounts.length
    const variance = amounts.every(a => Math.abs(a - avgAmount) < avgAmount * 0.1)
    if (!variance) return

    const dates = sorted.map(t => new Date(t.date))
    const gaps: number[] = []
    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24))
    }
    const avgGap = gaps.reduce((s, v) => s + v, 0) / gaps.length
    if (avgGap < 25 || avgGap > 40) return

    const lastDate = new Date(sorted[sorted.length - 1].date)
    const nextDate = new Date(lastDate)
    nextDate.setDate(nextDate.getDate() + Math.round(avgGap))
    const daysUntilNext = (nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)

    subs.push({
      description: sorted[0].description,
      amount: avgAmount,
      lastDate: sorted[sorted.length - 1].date,
      nextDate: nextDate.toISOString().substring(0, 10),
      occurrences: sorted.length,
      transactions: sorted,
      category: sorted[0].category ?? 'Assinaturas',
      status: daysUntilNext < -5 ? 'late' : 'active',
    })
  })

  return subs.sort((a, b) => b.amount - a.amount)
}

export default function Assinaturas() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

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
      } catch (e) { console.error(e) } finally { setLoading(false) }
    }
    load()
  }, [])

  const subscriptions = useMemo(() => detectSubscriptions(transactions), [transactions])
  const totalMonthly = subscriptions.reduce((s, sub) => s + sub.amount, 0)
  const totalAnnual = totalMonthly * 12

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48 rounded-xl" />
      <div className="grid grid-cols-3 gap-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Assinaturas</h2>
        <p className="text-sm text-muted-foreground">Cobranças recorrentes detectadas automaticamente</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Mensal', value: fmt(totalMonthly), color: '#ef4444', sub: `${subscriptions.length} assinaturas ativas` },
          { label: 'Total Anual', value: fmt(totalAnnual), color: '#fbbf24', sub: 'Projeção baseada no histórico' },
          { label: 'Maior Assinatura', value: subscriptions.length > 0 ? fmt(subscriptions[0].amount) : 'N/A', color: '#a78bfa', sub: subscriptions.length > 0 ? subscriptions[0].description : '-' },
        ].map(k => (
          <div key={k.label} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: '20px 24px' }}>
            <p className="text-sm text-muted-foreground mb-1">{k.label}</p>
            <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
            <p className="text-xs mt-1 truncate" style={{ color: '#64748b' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {subscriptions.length === 0 ? (
        <div style={{ background: '#0f172a', border: '1px dashed #1e293b', borderRadius: 16, padding: 64, textAlign: 'center' as const }}>
          <RefreshCw className="h-12 w-12 mx-auto mb-4" style={{ color: '#334155' }} />
          <p className="text-white font-semibold">Nenhuma assinatura detectada</p>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>Precisamos de pelo menos 2 meses de histórico para detectar cobranças recorrentes.</p>
        </div>
      ) : (
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p className="font-semibold text-white">Cobranças Recorrentes</p>
              <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Detectadas com base no histórico de transações</p>
            </div>
            <div style={{ background: '#1e293b', borderRadius: 8, padding: '4px 10px', fontSize: 11, color: '#94a3b8' }}>
              {subscriptions.length} encontradas
            </div>
          </div>

          {subscriptions.map((sub, i) => {
            const nextDate = new Date(sub.nextDate)
            const daysLeft = Math.round((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            const isLate = sub.status === 'late'
            return (
              <div key={i}
                style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #0f172a', gap: 16, transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: isLate ? '#450a0a' : '#0f2027', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isLate
                    ? <AlertCircle className="h-5 w-5" style={{ color: '#ef4444' }} />
                    : <RefreshCw className="h-5 w-5" style={{ color: '#38bdf8' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="text-sm font-medium text-white truncate">{sub.description}</p>
                  <p className="text-xs" style={{ color: '#64748b' }}>{sub.category} · {sub.occurrences}x detectada</p>
                </div>
                <div className="text-center" style={{ minWidth: 90 }}>
                  <p className="text-xs" style={{ color: '#64748b' }}>Próxima cobrança</p>
                  <p className="text-xs font-medium" style={{ color: isLate ? '#ef4444' : daysLeft <= 5 ? '#fbbf24' : '#94a3b8' }}>
                    {isLate ? 'Atrasada' : daysLeft === 0 ? 'Hoje' : daysLeft < 0 ? `${Math.abs(daysLeft)}d atrás` : `em ${daysLeft}d`}
                  </p>
                </div>
                <div className="text-right" style={{ minWidth: 90 }}>
                  <p className="text-base font-bold text-white tabular-nums">{fmt(sub.amount)}</p>
                  <p className="text-xs" style={{ color: '#64748b' }}>/mês</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
