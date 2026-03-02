import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlanGuard } from '../../hooks/usePlanGuard'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Lock, Landmark, CheckCircle, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// Declara o tipo global do widget Pluggy (carregado via CDN no index.html)
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
  const navigate = useNavigate()
  const [syncing, setSyncing] = useState(false)
  const [status, setStatus]   = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const loadPluggySDK = (): Promise<void> => new Promise((resolve, reject) => {
    if (window.PluggyConnect) return resolve()
    const script = document.createElement('script')
    script.src = 'https://cdn.pluggy.ai/pluggy-connect/v2/pluggy-connect.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Não foi possível carregar o SDK da Pluggy. Verifique sua conexão.'))
    document.head.appendChild(script)
  })

  const handleConnect = async () => {
    setSyncing(true)
    setStatus('idle')

    try {
      await loadPluggySDK()

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada. Faça login novamente.')

      // 1. Gera Connect Token via Netlify Function
      const tokenRes = await fetch('/.netlify/functions/pluggy-token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!tokenRes.ok) throw new Error('Falha ao gerar token de conexão.')
      const { accessToken } = await tokenRes.json()

      // 2. Abre o widget Pluggy (carregado via CDN)
      if (!window.PluggyConnect) {
        throw new Error('Widget Pluggy não carregado. Recarregue a página.')
      }

      new window.PluggyConnect({
        connectToken: accessToken,
        onSuccess: async ({ item }) => {
          // 3. Sincroniza transações
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
        onError: (error) => {
          setStatus('error')
          setMessage(`Erro na conexão: ${error.message}`)
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

  if (isLoading) return <div className="animate-pulse p-8 text-white">Carregando...</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Conectar Banco</h2>
        <p className="text-muted-foreground">Sincronize suas transações via Open Finance</p>
      </div>

      {!isPro ? (
        <Card className="border-amber-500 bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-400">
              <Lock className="h-5 w-5" /> Recurso exclusivo do plano PRO
            </CardTitle>
            <CardDescription>
              A sincronização automática está disponível apenas para assinantes PRO.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/app/plano')}>
              Ver planos e fazer upgrade
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" /> Conectar instituição financeira
            </CardTitle>
            <CardDescription>
              Conecte seu banco, corretora ou cartão de crédito de forma segura.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === 'success' && (
              <div className="flex items-center gap-2 text-green-400 bg-green-950/30 p-3 rounded-md text-sm">
                <CheckCircle className="h-4 w-4 shrink-0" /> {message}
              </div>
            )}
            {status === 'error' && (
              <div className="flex items-center gap-2 text-red-400 bg-red-950/30 p-3 rounded-md text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" /> {message}
              </div>
            )}
            <Button onClick={handleConnect} disabled={syncing} size="lg" className="w-full">
              {syncing ? 'Conectando...' : '🏦 Conectar meu banco'}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Conexão segura via Pluggy · Open Finance regulamentado pelo Banco Central
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
