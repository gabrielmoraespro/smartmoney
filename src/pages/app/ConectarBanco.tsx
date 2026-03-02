/**
 * src/pages/app/ConectarBanco.tsx
 *
 * Página de conexão com instituições bancárias via Pluggy (Open Finance).
 * Gerencia o ciclo: obter token → abrir widget → sincronizar transações.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePlanGuard } from '../../hooks/usePlanGuard'
import type { Account } from '../../lib/types'
import { PluggyConnect } from '../../components/pluggy/PluggyConnect'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '../../components/ui/card'
import {
  Lock, Landmark, CheckCircle, AlertCircle,
  ShieldCheck, RefreshCw, Trash2,
} from 'lucide-react'

export default function ConectarBanco() {
  const navigate = useNavigate()
  const {
    isLoading, isPro, accountLimit,
    connectedAccounts, canConnectAccount, refreshPlanContext,
  } = usePlanGuard()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [connectToken, setConnectToken] = useState('')
  const [widgetOpen, setWidgetOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  // ─── Busca contas conectadas ────────────────────────────────────────────────
  const fetchConnectedAccounts = async () => {
    setLoadingAccounts(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoadingAccounts(false); return }

    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    setAccounts((data ?? []) as Account[])
    setLoadingAccounts(false)
  }

  useEffect(() => { fetchConnectedAccounts() }, [])

  // ─── Obtém Connect Token do backend ────────────────────────────────────────
  const openPluggyWidget = async () => {
    setStatus('idle')
    setMessage('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada. Faça login novamente.')

      const res = await fetch('/.netlify/functions/pluggy-token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha ao gerar token de conexão.')

      setConnectToken(data.accessToken)
      setWidgetOpen(true)
    } catch (err: any) {
      setStatus('error')
      setMessage(err.message)
    }
  }

  // ─── Callback de sucesso do widget Pluggy ──────────────────────────────────
  const handlePluggySuccess = async ({ item }: { item: { id: string } }) => {
    setWidgetOpen(false)
    setSyncing(true)
    setStatus('idle')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada.')

      const res = await fetch('/.netlify/functions/sync-pluggy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ item_id: item.id }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha ao sincronizar.')

      await Promise.all([refreshPlanContext(), fetchConnectedAccounts()])
      setStatus('success')
      setMessage(`✅ ${data.totalUpserted} transações sincronizadas com sucesso!`)
    } catch (err: any) {
      setStatus('error')
      setMessage(err.message)
    } finally {
      setSyncing(false)
      setConnectToken('')
    }
  }

  // ─── Remove conta vinculada ─────────────────────────────────────────────────
  const handleRemoveAccount = async (account: Account) => {
    const confirmed = window.confirm(
      `Remover "${account.bank_name}"?\nIsso apagará as transações relacionadas.`
    )
    if (!confirmed) return

    setRemovingId(account.id)
    setStatus('idle')

    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', account.id)

    if (error) {
      setStatus('error')
      setMessage('Não foi possível remover a conta. Tente novamente.')
      setRemovingId(null)
      return
    }

    // Limpa pluggy_connections se não restar nenhuma conta do item
    if (account.pluggy_item_id) {
      const { count } = await supabase
        .from('accounts')
        .select('id', { count: 'exact', head: true })
        .eq('pluggy_item_id', account.pluggy_item_id)

      if ((count ?? 0) === 0) {
        await supabase
          .from('pluggy_connections')
          .delete()
          .eq('pluggy_item_id', account.pluggy_item_id)
      }
    }

    await Promise.all([fetchConnectedAccounts(), refreshPlanContext()])
    setStatus('success')
    setMessage('Conta removida com sucesso.')
    setRemovingId(null)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
        Carregando plano...
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold">Conectar Banco</h2>
        <p className="text-muted-foreground">
          Conecte Nubank, Inter, Itaú e outras instituições via Open Finance (Pluggy).
        </p>
      </div>

      {/* Cards de status do plano */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">Limite do seu plano</CardTitle>
            <CardDescription>
              {isPro
                ? 'Plano PRO: até 2 contas conectadas.'
                : 'Plano Free: 1 conta. Upgrade libera até 2 contas.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Conectadas: <strong className="text-foreground">{connectedAccounts}</strong> / {accountLimit}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Segurança
            </CardTitle>
            <CardDescription>
              Conexão criptografada via Pluggy. Sua senha bancária nunca é armazenada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Open Finance regulamentado pelo Banco Central do Brasil.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Feedback de status */}
      {status === 'success' && (
        <div className="flex items-center gap-2 text-green-400 bg-green-950/30 border border-green-500/20 p-3 rounded-md text-sm">
          <CheckCircle className="h-4 w-4 shrink-0" /> {message}
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 text-red-400 bg-red-950/30 border border-red-500/20 p-3 rounded-md text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" /> {message}
        </div>
      )}

      {/* Bloco de conexão ou alerta de limite */}
      {!canConnectAccount ? (
        <Card className="border-amber-500/50 bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-400">
              <Lock className="h-5 w-5" /> Limite de contas atingido
            </CardTitle>
            <CardDescription>
              {isPro
                ? 'Você já atingiu o limite de 2 contas do plano PRO.'
                : 'No plano Free você pode conectar 1 conta. Faça upgrade para 2.'}
            </CardDescription>
          </CardHeader>
          {!isPro && (
            <CardContent>
              <Button onClick={() => navigate('/app/plano')}>
                Ver planos e fazer upgrade
              </Button>
            </CardContent>
          )}
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" /> Vincular nova conta
            </CardTitle>
            <CardDescription>
              Suas transações entram no dashboard automaticamente após a conexão.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {syncing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                Sincronizando transações... isso pode levar alguns segundos.
              </div>
            ) : widgetOpen && connectToken ? (
              <PluggyConnect
                connectToken={connectToken}
                disabled={!canConnectAccount}
                onSuccess={handlePluggySuccess}
                onError={(err) => {
                  setStatus('error')
                  setMessage(err.message)
                  setWidgetOpen(false)
                  setConnectToken('')
                }}
                onClose={() => {
                  setWidgetOpen(false)
                  setConnectToken('')
                }}
              />
            ) : (
              <Button onClick={openPluggyWidget} size="lg" className="w-full">
                🏦 Conectar minha conta bancária
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lista de contas já vinculadas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Contas vinculadas</CardTitle>
            <CardDescription>Gerencie as instituições conectadas ao SmartMoney.</CardDescription>
          </div>
          <Button
            variant="outline" size="sm"
            onClick={() => { refreshPlanContext(); fetchConnectedAccounts() }}
          >
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {loadingAccounts ? (
            <p className="text-sm text-muted-foreground">Carregando contas...</p>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma conta vinculada. Clique em "Conectar minha conta bancária" acima.
            </p>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 gap-3"
                >
                  <div>
                    <p className="text-sm font-medium">{account.bank_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {account.type} · {account.currency}
                      {account.last_synced_at && (
                        <> · sincronizado em {new Date(account.last_synced_at).toLocaleDateString('pt-BR')}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Conectada</Badge>
                    <Button
                      variant="ghost" size="icon"
                      disabled={removingId === account.id}
                      onClick={() => handleRemoveAccount(account)}
                      aria-label={`Remover ${account.bank_name}`}
                    >
                      {removingId === account.id
                        ? <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                        : <Trash2 className="h-4 w-4 text-red-400" />
                      }
                    </Button>
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
