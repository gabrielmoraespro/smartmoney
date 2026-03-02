import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const COLORS = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16']
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtShort = (v: number) => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v.toFixed(0)}`

export default function Dashboard() {
  const [stats, setStats] = useState({ income: 0, expenses: 0, balance: 0 })
  const [monthly, setMonthly] = useState<{ month: string; receitas: number; despesas: number }[]>([])
  const [categories, setCategories] = useState<{ name: string; value: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
      sixMonthsAgo.setDate(1)

      const { data: allData } = await supabase
        .from('transactions')
        .select('amount, type, date, category')
        .eq('user_id', user.id)
        .gte('date', sixMonthsAgo.toISOString().substring(0, 10))
        .order('date', { ascending: true })

      if (allData) {
        const startKey = startOfMonth.toISOString().substring(0, 10)
        const thisMonth = allData.filter(t => t.date >= startKey)

        const income   = thisMonth.filter(t => t.type === 'credit').reduce((s, t) => s + Number(t.amount), 0)
        const expenses = thisMonth.filter(t => t.type === 'debit').reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
        setStats({ income, expenses, balance: income - expenses })

        // Agrupar por mês
        const byMonth: Record<string, { receitas: number; despesas: number }> = {}
        allData.forEach(t => {
          const d = new Date(t.date + 'T00:00:00')
          const key = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
          if (!byMonth[key]) byMonth[key] = { receitas: 0, despesas: 0 }
          if (t.type === 'credit') byMonth[key].receitas += Number(t.amount)
          else byMonth[key].despesas += Math.abs(Number(t.amount))
        })
        setMonthly(Object.entries(byMonth).map(([month, v]) => ({ month, ...v })))

        // Categorias deste mês
        const catMap: Record<string, number> = {}
        thisMonth.filter(t => t.type === 'debit').forEach(t => {
          const cat = (t as any).category ?? 'Outros'
          catMap[cat] = (catMap[cat] ?? 0) + Math.abs(Number(t.amount))
        })
        setCategories(Object.entries(catMap).sort((a,b) => b[1]-a[1]).slice(0,8).map(([name,value]) => ({ name, value })))
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )

  const hasData = stats.income > 0 || stats.expenses > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground">
          Resumo de {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saldo do Mês</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${stats.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {fmt(stats.balance)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{stats.balance >= 0 ? '✅ No positivo' : '⚠️ No negativo'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receitas</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">{fmt(stats.income)}</p>
            <p className="text-xs text-muted-foreground mt-1">Entradas no mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Despesas</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">{fmt(stats.expenses)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.income > 0 ? `${((stats.expenses/stats.income)*100).toFixed(0)}% da receita` : 'Saídas no mês'}
            </p>
          </CardContent>
        </Card>
      </div>

      {!hasData ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Nenhuma transação ainda</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Conecte seu banco em "Conectar Banco" para sincronizar suas transações automaticamente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {monthly.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Evolução — últimos 6 meses</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} width={55} />
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[4,4,0,0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {categories.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Despesas por categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={categories} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                      {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12 }} />
                    <Legend formatter={(v, e: any) => `${v} (${fmt(e.payload.value)})`} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
