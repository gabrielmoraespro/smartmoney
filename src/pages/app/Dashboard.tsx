/**
 * src/pages/app/Dashboard.tsx
 *
 * Dashboard principal: KPIs do mês, gráfico de fluxo 30 dias,
 * pizza de categorias e lista de transações recentes.
 *
 * FIX aplicado: getUserAuthHeaders() agora inclui "Accept: application/json"
 * eliminando o erro 406 Not Acceptable nas chamadas à REST API do Supabase.
 */
import { useEffect, useMemo, useState } from 'react'
import { getUserAuthHeaders, supabase } from '../../lib/supabase'
import type { Account, Transaction } from '../../lib/types'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle,
} from '../../components/ui/dialog'
import { Skeleton } from '../../components/ui/skeleton'
import {
  ArrowDownCircle, ArrowUpCircle, Eye, EyeOff,
  LoaderCircle, Wallet, TrendingUp,
} from 'lucide-react'
import {
  Bar, BarChart, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

const COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
]
const QUICK_CATEGORIES = ['Todas', 'Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Outros']

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtShort = (v: number) =>
  v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v.toFixed(0)}`

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
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const thirtyDaysAgo = new Date(now)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)

        const startOfMonthStr = startOfMonth.toISOString().substring(0, 10)
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().substring(0, 10)

        // Usamos getUserAuthHeaders() — FIX: inclui Accept: application/json
        const headers = await getUserAuthHeaders()
        const baseUrl = import.meta.env.VITE_SUPABASE_URL as string

        const [txRes, accountsRes] = await Promise.all([
          fetch(
            `${baseUrl}/rest/v1/transactions` +
            `?user_id=eq.${user.id}&order=date.desc&limit=300`,
            { headers }
          ),
          fetch(
            `${baseUrl}/rest/v1/accounts` +
            `?user_id=eq.${user.id}&select=id,bank_name,is_active`,
            { headers }
          ),
        ])

        if (!txRes.ok) {
          throw new Error(`Erro ao carregar transações: ${txRes.status} ${txRes.statusText}`)
        }
        if (!accountsRes.ok) {
          throw new Error(`Erro ao carregar contas: ${accountsRes.status} ${accountsRes.statusText}`)
        }

        const txData: Transaction[] = await txRes.json()
        const accountsData: Pick<Account, 'id' | 'bank_name' | 'is_active'>[] = await accountsRes.json()

        // Monta mapa accountId → bankName para exibir nos detalhes
        const map = accountsData.reduce<Record<string, string>>((acc, a) => {
          acc[a.id] = a.bank_name; return acc
        }, {})
        setAccountsMap(map)
        setHasConnectedAccounts(accountsData.some(a => a.is_active))
        setRecentTransactions(txData)

        // ── KPIs do mês atual ─────────────────────────────────────────────────
        const monthTx = txData.filter(t => t.date >= startOfMonthStr)
        const income   = monthTx.filter(t => t.type === 'credit').reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
        const expenses = monthTx.filter(t => t.type === 'debit').reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
        setStats({ income, expenses, balance: income - expenses })

        // ── Categorias de despesas do mês ─────────────────────────────────────
        const catMap: Record<string, number> = {}
        monthTx
          .filter(t => t.type === 'debit')
          .forEach(t => {
            const cat = t.category ?? 'Outros'
            catMap[cat] = (catMap[cat] ?? 0) + Math.abs(Number(t.amount))
          })
        setCategories(
          Object.entries(catMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name, value]) => ({ name, value }))
        )

        // ── Fluxo de caixa — últimos 30 dias ─────────────────────────────────
        const dailyMap: Record<string, { entradas: number; saidas: number }> = {}
        for (let i = 0; i < 30; i++) {
          const d = new Date(thirtyDaysAgo)
          d.setDate(thirtyDaysAgo.getDate() + i)
          dailyMap[d.toISOString().substring(0, 10)] = { entradas: 0, saidas: 0 }
        }
        txData
          .filter(t => t.date >= thirtyDaysAgoStr)
          .forEach(t => {
            if (!dailyMap[t.date]) return
            if (t.type === 'credit') dailyMap[t.date].entradas += Math.abs(Number(t.amount))
            else dailyMap[t.date].saidas += Math.abs(Number(t.amount))
          })
        setCashflow30d(
          Object.entries(dailyMap).map(([date, v]) => ({
            day: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            entradas: v.entradas,
            saidas: v.saidas,
          }))
        )
      } catch (err: any) {
        console.error('[Dashboard] erro ao carregar:', err)
        setLoadError(err.message ?? 'Erro desconhecido ao carregar o dashboard.')
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
    const norm = selectedCategory.toLowerCase()
    return recentTransactions
      .filter(t =>
        selectedCategory === 'Todas' ||
        (t.category ?? 'Outros').toLowerCase().includes(norm)
      )
      .slice(0, 15)
  }, [recentTransactions, selectedCategory])

  // ── Estados de carregamento / erro ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" />
        </div>
        <Skeleton className="h-72" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <div className="flex items-center gap-2 text-red-400 bg-red-950/30 border border-red-500/20 p-4 rounded-md text-sm">
          ⚠️ Erro ao carregar dados: {loadError}
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  const hasTransactions = recentTransactions.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground">
            Resumo de {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowValues(s => !s)}>
          {showValues ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
          {showValues ? 'Ocultar saldos' : 'Mostrar saldos'}
        </Button>
      </div>

      {/* CTA quando não há conta conectada */}
      {!hasConnectedAccounts && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="py-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="font-medium">Ative seu SmartMoney em 1 minuto</p>
              <p className="text-sm text-muted-foreground">
                Conecte sua primeira conta via Pluggy para liberar o dashboard automático.
              </p>
            </div>
            <Button asChild>
              <a href="/app/conectar-banco">Conectar minha primeira conta</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saldo do Mês</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${stats.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {money(stats.balance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Entradas</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">{money(stats.income)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saídas</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">{money(stats.expenses)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Estado de sincronização */}
      {hasConnectedAccounts && !hasTransactions && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-8 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
              Sincronizando seus dados bancários...
            </div>
            <Skeleton className="h-3 w-10/12" />
            <Skeleton className="h-3 w-8/12" />
          </CardContent>
        </Card>
      )}

      {/* Gráficos + Lista */}
      {hasTransactions && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Fluxo de caixa */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Fluxo de caixa — Entradas vs Saídas (30 dias)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={cashflow30d} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis
                      tickFormatter={v => showValues ? fmtShort(v) : '••'}
                      tick={{ fontSize: 11 }} width={55}
                    />
                    <Tooltip
                      formatter={(v: number) => showValues ? fmt(v) : '••••'}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pizza de categorias */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Despesas por categoria (mês)</CardTitle>
              </CardHeader>
              <CardContent>
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem despesas categorizadas no mês.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={categories} cx="50%" cy="50%"
                        innerRadius={55} outerRadius={85}
                        paddingAngle={3} dataKey="value"
                      >
                        {categories.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number) => showValues ? fmt(v) : '••••'}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Legend
                        formatter={(v, e: any) =>
                          `${v} (${showValues ? fmt(e.payload.value) : '••••'})`
                        }
                        wrapperStyle={{ fontSize: 11 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Lista de transações */}
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Transações recentes</CardTitle>
                <span className="text-xs text-muted-foreground">
                  {filteredTransactions.length} exibidas
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {QUICK_CATEGORIES.map(cat => (
                  <Button
                    key={cat}
                    variant={selectedCategory === cat ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredTransactions.length === 0 ? (
                <p className="px-6 py-8 text-sm text-muted-foreground">
                  Nenhuma transação para o filtro selecionado.
                </p>
              ) : (
                <div className="divide-y">
                  {filteredTransactions.map(t => (
                    <button
                      key={t.id}
                      className="w-full text-left flex items-center justify-between px-6 py-3 hover:bg-muted/40 transition-colors"
                      onClick={() => setSelectedTransaction(t)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.date).toLocaleDateString('pt-BR')} · {t.category ?? 'Outros'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <Badge variant={t.type === 'credit' ? 'default' : 'secondary'}>
                          {t.type === 'credit' ? 'Receita' : 'Despesa'}
                        </Badge>
                        <span className={`text-sm font-semibold tabular-nums ${t.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                          {money(Number(t.amount), true, t.type)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Modal de detalhes */}
      <Dialog
        open={Boolean(selectedTransaction)}
        onOpenChange={open => !open && setSelectedTransaction(null)}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Detalhes da transação</DialogTitle>
            <DialogDescription>Informações completas da movimentação sincronizada.</DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-3 text-sm">
              {[
                ['Descrição', selectedTransaction.description],
                ['Data', new Date(selectedTransaction.date).toLocaleDateString('pt-BR')],
                ['Valor', money(Number(selectedTransaction.amount), true, selectedTransaction.type)],
                ['Tipo', selectedTransaction.type === 'credit' ? 'Receita' : 'Despesa'],
                ['Categoria', selectedTransaction.category ?? 'N/A'],
                ['Conta', accountsMap[selectedTransaction.account_id] ?? 'Conta não identificada'],
                ['ID Pluggy', selectedTransaction.pluggy_transaction_id ?? 'N/A'],
                ['Origem', selectedTransaction.is_manual ? 'Manual' : 'Pluggy (Open Finance)'],
              ].map(([label, value]) => (
                <div key={label}>
                  <span className="text-muted-foreground">{label}:</span>{' '}
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
