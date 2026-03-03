import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { ExportButton } from '../../components/export/ExportButton'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import type { Transaction } from '../../lib/types'

const LIMIT = 20

export default function Transacoes() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState<'all' | 'credit' | 'debit'>('all')
  const [page, setPage]       = useState(0)
  const [total, setTotal]     = useState(0)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .order('date', { ascending: false })
        .range(page * LIMIT, (page + 1) * LIMIT - 1)

      if (filter !== 'all') query = query.eq('type', filter)
      if (search) query = query.ilike('description', `%${search}%`)

      const { data, count } = await query
      setTransactions((data ?? []) as Transaction[])
      setTotal(count ?? 0)
      setLoading(false)
    }
    load()
  }, [page, filter, search])

  const fmt = (v: number) => Math.abs(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold">Transações</h2>
          <p className="text-muted-foreground">{total} registros encontrados</p>
        </div>
        <ExportButton className="inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm hover:bg-accent transition-colors" />
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Buscar por descrição..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          className="max-w-xs"
        />
        <div className="flex gap-2">
          {(['all', 'credit', 'debit'] as const).map(f => (
            <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm"
              onClick={() => { setFilter(f); setPage(0) }}>
              {f === 'all' ? 'Todas' : f === 'credit' ? 'Receitas' : 'Despesas'}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Lançamentos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Nenhuma transação encontrada.
            </div>
          ) : (
            <div className="divide-y">
              {transactions.map(t => (
                <div key={t.id} className="flex items-center justify-between px-6 py-3 hover:bg-accent/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">
                        {new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </p>
                      {t.category && (
                        <Badge variant="secondary" className="text-xs py-0">{t.category}</Badge>
                      )}
                      {t.is_manual && (
                        <Badge variant="outline" className="text-xs py-0">Manual</Badge>
                      )}
                    </div>
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

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              ← Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              Próxima →
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
