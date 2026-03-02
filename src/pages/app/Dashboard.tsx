import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp, Plus } from 'lucide-react'
import type { Transaction } from '../../lib/types'

interface Stats {
  income: number
  expenses: number
  balance: number
  recentTransactions: Transaction[]
}

export default function Dashboard() {
  const navigate  = useNavigate()
  const [stats, setStats]     = useState<Stats>({ income: 0, expenses: 0, balance: 0, recentTransactions: [] })
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserName(user.user_metadata?.full_name?.split(' ')[0] ?? 'você')

      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      const dateStr = startOfMonth.toISOString().substring(0, 10)

      const [{ data: txData }, { data: recentData }] = await Promise.all([
        supabase.from('transactions').select('amount, type').eq('user_id', user.id).gte('date', dateStr),
        supabase.from('transactions').select('*').eq('user_id', user.id)
          .order('date', { ascending: false }).limit(5),
      ])

      const income   = (txData ?? []).filter(t => t.type === 'credit').reduce((s, t) => s + Number(t.amount), 0)
      const expenses = (txData ?? []).filter(t => t.type === 'debit').reduce((s, t) => s + Math.abs(Number(t.amount)), 0)

      setStats({ income, expenses, balance: income - expenses, recentTransactions: (recentData ?? []) as Transaction[] })
      setLoading(false)
    }
    load()
  }, [])

  const fmt = (v: number) => Math.abs(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const month = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )

  const isEmpty = stats.income === 0 && stats.expenses === 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Olá, {userName}! 👋</h2>
          <p className="text-muted-foreground capitalize">{month}</p>
        </div>
        <Button onClick={() => navigate('/app/conectar-banco')} size="sm">
          <Plus className="h-4 w-4 mr-2" /> Conectar banco
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo do Mês</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${stats.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {fmt(stats.balance)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.balance >= 0 ? '▲ Saldo positivo' : '▼ Saldo negativo'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receitas</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">{fmt(stats.income)}</p>
            <p className="text-xs text-muted-foreground mt-1">Entradas no mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">{fmt(stats.expenses)}</p>
            <p className="text-xs text-muted-foreground mt-1">Saídas no mês</p>
          </CardContent>
        </Card>
      </div>

      {/* Transações recentes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Transações recentes</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/transacoes')}>
            Ver todas →
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <TrendingUp className="h-12 w-12 text-muted-foreground mb-4 opacity-30" />
              <h3 className="font-semibold mb-1">Nenhuma transação ainda</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Conecte seu banco para sincronizar automaticamente
              </p>
              <Button onClick={() => navigate('/app/conectar-banco')}>
                🏦 Conectar banco agora
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {stats.recentTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-6 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      {t.category && ` · ${t.category}`}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold ml-4 tabular-nums ${
                    t.type === 'credit' ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {t.type === 'credit' ? '+' : '-'}{fmt(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
