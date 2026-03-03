import { useEffect, useMemo, useState } from 'react'
import { getUserAuthHeaders, supabase } from '../../lib/supabase'
import type { Account, Transaction } from '../../lib/types'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Skeleton } from '../../components/ui/skeleton'
import { ArrowDownCircle, ArrowUpCircle, Eye, EyeOff, LoaderCircle, Wallet, TrendingUp } from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
const QUICK_CATEGORIES = ['Todas', 'Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Outros']

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtShort = (v: number) => (v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v.toFixed(0)}`)

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
        if (!user) {
          setLoading(false)
          return
        }

        const now = new Date()
      const startOfMonth = new Date(now)
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
      thirtyDaysAgo.setHours(0, 0, 0, 0)

      const headers = await getUserAuthHeaders()
      const baseUrl = import.meta.env.VITE_SUPABASE_URL as string

      const [txRes, accountsRes] = await Promise.all([
        fetch(`${baseUrl}/rest/v1/transactions?user_id=eq.${user.id}&order=date.desc&limit=200`, { headers }),
        fetch(`${baseUrl}/rest/v1/accounts?user_id=eq.${user.id}&select=id,bank_name,is_active`, { headers }),
      ])

      if (!txRes.ok || !accountsRes.ok) {
        throw new Error('Falha ao carregar dados do dashboard com autorização do usuário.')
      }

      const txData = await txRes.json()
      const accountsData = await accountsRes.json()

      const allAccounts = (accountsData ?? []) as Pick<Account, 'id' | 'bank_name' | 'is_active'>[]
      const map = allAccounts.reduce((acc, item) => {
        acc[item.id] = item.bank_name
        return acc
      }, {} as Record<string, string>)
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
        const d = new Date(thirtyDaysAgo)
        d.setDate(thirtyDaysAgo.getDate() + i)
        dailyMap[d.toISOString().substring(0, 10)] = { entradas: 0, saidas: 0 }
      }

      allTransactions
        .filter((t) => t.date >= thirtyDaysAgo.toISOString().substring(0, 10))
        .forEach((t) => {
          if (!dailyMap[t.date]) return
          if (t.type === 'credit') dailyMap[t.date].entradas += Math.abs(Number(t.amount))
          else dailyMap[t.date].saidas += Math.abs(Number(t.amount))
        })

        setCashflow30d(
          Object.entries(dailyMap).map(([date, values]) => ({
            day: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            entradas: values.entradas,
            saidas: values.saidas,
          }))
        )
      } catch (error) {
        console.error('[dashboard] erro ao carregar dados', error)
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

  const filteredRecentTransactions = useMemo(() => {
    const normalizedCategory = selectedCategory.toLowerCase()
    return recentTransactions
      .filter((t) => {
        if (selectedCategory === 'Todas') return true
        return (t.category ?? 'Outros').toLowerCase().includes(normalizedCategory)
      })
      .slice(0, 12)
  }, [recentTransactions, selectedCategory])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
  

      {!hasConnectedAccounts && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="py-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="font-medium">Ative seu SmartMoney em 1 minuto</p>
              <p className="text-sm text-muted-foreground">Conecte sua primeira conta via Pluggy para liberar dashboard automático.</p>
            </div>
            <Button asChild>
              <a href="/app/conectar-banco">Conectar minha primeira conta</a>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  const hasTransactions = recentTransactions.length > 0
  const showSyncingState = hasConnectedAccounts && !hasTransactions

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground">Resumo de {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowValues((s) => !s)}>
          {showValues ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />} {showValues ? 'Ocultar saldos' : 'Mostrar saldos'}
        </Button>
      </div>



      {!hasConnectedAccounts && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="py-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="font-medium">Ative seu SmartMoney em 1 minuto</p>
              <p className="text-sm text-muted-foreground">Conecte sua primeira conta via Pluggy para liberar dashboard automático.</p>
            </div>
            <Button asChild>
              <a href="/app/conectar-banco">Conectar minha primeira conta</a>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Saldo do Mês</CardTitle><Wallet className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${stats.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>{money(stats.balance)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Entradas</CardTitle><ArrowUpCircle className="h-4 w-4 text-green-500" /></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-500">{money(stats.income)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Saídas</CardTitle><ArrowDownCircle className="h-4 w-4 text-red-500" /></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-500">{money(stats.expenses)}</p></CardContent>
        </Card>
      </div>

      {showSyncingState && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-8 space-y-4">
            <div className="flex items-center gap-2 text-sm"><LoaderCircle className="h-4 w-4 animate-spin text-primary" /> Sincronizando seus dados bancários...</div>
            <Skeleton className="h-3 w-10/12" />
            <Skeleton className="h-3 w-8/12" />
            <Skeleton className="h-3 w-6/12" />
          </CardContent>
        </Card>
      )}

      {!hasTransactions && !showSyncingState ? (
        <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center py-16 text-center"><TrendingUp className="h-12 w-12 text-muted-foreground mb-4" /><h3 className="font-semibold mb-2">Nenhuma transação ainda</h3><p className="text-sm text-muted-foreground max-w-xs">Conecte seu banco em "Conectar Banco" para sincronizar suas transações automaticamente.</p></CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-sm font-medium">Fluxo de caixa — Entradas vs Saídas (30 dias)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={cashflow30d} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => (showValues ? fmtShort(v) : '••')} tick={{ fontSize: 11 }} width={55} />
                    <Tooltip formatter={(v: number) => (showValues ? fmt(v) : '••••')} contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Despesas por categoria (mês)</CardTitle></CardHeader>
              <CardContent>
                {categories.length === 0 ? <p className="text-sm text-muted-foreground">Sem despesas categorizadas no mês.</p> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={categories} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">{categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie>
                      <Tooltip formatter={(v: number) => (showValues ? fmt(v) : '••••')} contentStyle={{ fontSize: 12 }} />
                      <Legend formatter={(v, e: any) => `${v} (${showValues ? fmt(e.payload.value) : '••••'})`} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between"><CardTitle className="text-base">Transações recentes (dados Pluggy)</CardTitle><span className="text-xs text-muted-foreground">{filteredRecentTransactions.length} exibidas</span></div>
              <div className="flex flex-wrap gap-2">
                {QUICK_CATEGORIES.map((category) => (
                  <Button key={category} variant={selectedCategory === category ? 'default' : 'outline'} size="sm" onClick={() => setSelectedCategory(category)}>{category}</Button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {filteredRecentTransactions.length === 0 ? <p className="px-6 py-8 text-sm text-muted-foreground">Nenhuma transação encontrada para o filtro selecionado.</p> : (
                <div className="divide-y">
                  {filteredRecentTransactions.map((t) => (
                    <button key={t.id} className="w-full text-left flex items-center justify-between px-6 py-3 hover:bg-muted/40 transition-colors" onClick={() => setSelectedTransaction(t)}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.description}</p>
                        <p className="text-xs text-muted-foreground">{new Date(t.date).toLocaleDateString('pt-BR')} · {t.category ?? 'Outros'}</p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <Badge variant={t.type === 'credit' ? 'default' : 'secondary'}>{t.type === 'credit' ? 'Receita' : 'Despesa'}</Badge>
                        <span className={`text-sm font-semibold tabular-nums ${t.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>{money(Number(t.amount), true, t.type)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={Boolean(selectedTransaction)} onOpenChange={(open) => !open && setSelectedTransaction(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Detalhes da transação</DialogTitle>
            <DialogDescription>Informações completas da movimentação sincronizada.</DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Descrição:</span> {selectedTransaction.description}</div>
              <div><span className="text-muted-foreground">ID da transação:</span> {selectedTransaction.id}</div>
              <div><span className="text-muted-foreground">ID Pluggy:</span> {selectedTransaction.pluggy_transaction_id ?? 'N/A'}</div>
              <div><span className="text-muted-foreground">Categoria original Pluggy:</span> {selectedTransaction.category_id ?? selectedTransaction.category ?? 'N/A'}</div>
              <div><span className="text-muted-foreground">Data:</span> {new Date(selectedTransaction.date).toLocaleDateString('pt-BR')}</div>
              <div><span className="text-muted-foreground">Conta de origem:</span> {accountsMap[selectedTransaction.account_id] ?? 'Conta não identificada'}</div>
              <div><span className="text-muted-foreground">Valor:</span> {money(Number(selectedTransaction.amount), true, selectedTransaction.type)}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
