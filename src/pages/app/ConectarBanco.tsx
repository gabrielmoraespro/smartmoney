import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlanGuard } from '../../hooks/usePlanGuard'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Lock, Landmark, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// Carrega o script Pluggy dinamicamente (evita 404 no carregamento inicial)
function loadPluggyScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('pluggy-script')) { resolve(); return }
    const script = document.createElement('script')
    script.id  = 'pluggy-script'
    script.src = 'https://cdn.pluggy.ai/pluggy-connect/v2/pluggy-connect.js'
    script.onload  = () => resolve()
    script.onerror = () => reject(new Error('Falha ao carregar o widget Pluggy. Verifique sua conexão.'))
    document.head.appendChild(script)
  })
}

declare global {
  interface Window {
    PluggyConnect: new (config: {
      connectToken: string
      onSuccess: (data: { item: { id: string } }) => void
      onError: (error: { message: string }) => void
      onClose: () => void
    }) => { init: () => void }
  }
}

export default function ConectarBanco() {
  const { isPro, isLoading } = usePlanGuard()
  const navigate  = useNavigate()
  const [syncing, setSyncing]   = useState(false)
  const [status, setStatus]     = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage]   = useState('')
  const [accounts, setAccounts] = useState<any[]>([])

  // Carrega contas já conectadas
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      setAccounts(data ?? [])
    }
    load()
  }, [status])

  const handleConnect = async () => {
    setSyncing(true)
    setStatus('idle')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada. Faça login novamente.')

      // 1. Carrega widget dinamicamente
      await loadPluggyScript()

      // 2. Gera Connect Token
      const tokenRes = await fetch('/.netlify/functions/pluggy-token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!tokenRes.ok) throw new Error('Falha ao gerar token. Tente novamente.')
      const { accessToken } = await tokenRes.json()

      // 3. Abre widget
      if (!window.PluggyConnect) throw new Error('Widget não carregado. Recarregue a página.')

      new window.PluggyConnect({
        connectToken: accessToken,
        onSuccess: async ({ item }) => {
          setMessage('Conectado! Sincronizando transações...')
          const syncRes = await fetch('/.netlify/functions/sync-pluggy', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ item_id: item.id }),
          })
          const syncData = await syncRes.json()
          if (!syncRes.ok) throw new Error(syncData.error)
          setStatus('success')
          setMessage(`${syncData.totalUpserted} transações sincronizadas com sucesso!`)
          setSyncing(false)
        },
        onError: (err) => {
          setStatus('error')
          setMessage(`Erro: ${err.message}`)
          setSyncing(false)
        },
        onClose: () => setSyncing(false),
      }).init()
    } catch (err: any) {
      setStatus('error')
      setMessage(err.message)
      setSyncing(false)
    }
  }

  const typeLabel: Record<string, string> = {
    checking: 'Conta Corrente', savings: 'Poupança',
    credit: 'Cartão de Crédito', investment: 'Investimento',
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Conectar Banco</h2>
        <p className="text-muted-foreground">Sincronize transações automaticamente via Open Finance</p>
      </div>

      {!isPro ? (
        <Card className="border-amber-500/50 bg-amber-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-400">
              <Lock className="h-5 w-5" /> Recurso exclusivo PRO
            </CardTitle>
            <CardDescription>
              Sincronização automática disponível apenas no plano PRO.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/app/plano')}>
              Ver planos → fazer upgrade
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5" /> Adicionar instituição
              </CardTitle>
              <CardDescription>
                Banco, corretora ou cartão via Open Finance regulamentado pelo Banco Central.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {status === 'success' && (
                <div className="flex items-center gap-2 text-green-400 bg-green-950/20 p-3 rounded-md text-sm">
                  <CheckCircle className="h-4 w-4 shrink-0" /> {message}
                </div>
              )}
              {status === 'error' && (
                <div className="flex items-center gap-2 text-red-400 bg-red-950/20 p-3 rounded-md text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {message}
                </div>
              )}
              <Button onClick={handleConnect} disabled={syncing} size="lg" className="w-full">
                {syncing
                  ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Conectando...</>
                  : '🏦 Conectar meu banco'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Seus dados trafegam de forma criptografada · Nunca armazenamos sua senha
              </p>
            </CardContent>
          </Card>

          {accounts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Contas conectadas</CardTitle>
              </CardHeader>
              <CardContent className="divide-y p-0">
                {accounts.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <p className="text-sm font-medium">{acc.bank_name}</p>
                      <p className="text-xs text-muted-foreground">{typeLabel[acc.type] ?? acc.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {Number(acc.balance).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                      {acc.last_synced_at && (
                        <p className="text-xs text-muted-foreground">
                          Sync: {new Date(acc.last_synced_at).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
