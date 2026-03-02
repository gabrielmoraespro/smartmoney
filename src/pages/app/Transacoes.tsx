import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { ExportButton } from '../../components/export/ExportButton'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import type { Transaction } from '../../lib/types'

export default function Transacoes() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .limit(100)

      setTransactions((data ?? []) as Transaction[])
      setLoading(false)
    }
    load()
  }, [])

  const fmt = (v: number) => Math.abs(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Transações</h2>
          <p className="text-muted-foreground">{transactions.length} registros</p>
        </div>
        <ExportButton className="inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Últimas transações</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhuma transação encontrada. Conecte seu banco para sincronizar.
            </div>
          ) : (
            <div className="divide-y">
              {transactions.map(t => (
                <div key={t.id} className="flex items-center justify-between px-6 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.date).toLocaleDateString('pt-BR')}
                      {t.category && ` · ${t.category}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <Badge variant={t.type === 'credit' ? 'default' : 'secondary'}>
                      {t.type === 'credit' ? 'Receita' : 'Despesa'}
                    </Badge>
                    <span className={`text-sm font-semibold tabular-nums ${t.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                      {t.type === 'credit' ? '+' : '-'}{fmt(t.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
