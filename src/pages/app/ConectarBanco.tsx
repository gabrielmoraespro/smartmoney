import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlanGuard } from '../../hooks/usePlanGuard'
import type { Account } from '../../lib/types'
import { PluggyConnect } from '../../components/pluggy/PluggyConnect'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Lock, Landmark, CheckCircle, AlertCircle, ShieldCheck, RefreshCw, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function ConectarBanco() {
  const { isLoading, isPro, accountLimit, connectedAccounts, canConnectAccount, refreshPlanContext } = usePlanGuard()
  const navigate = useNavigate()

  const [syncing, setSyncing] = useState(false)
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [connectToken, setConnectToken] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const fetchConnectedAccounts = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setAccounts([])
      setLoadingAccounts(false)
      return
    }

    setLoadingAccounts(true)
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    setAccounts((data ?? []) as Account[])
    setLoadingAccounts(false)
  }

  useEffect(() => {
    fetchConnectedAccounts()
  }, [])

  const getConnectToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Sessão expirada. Faça login novamente.')

    const tokenRes = await fetch('/.netlify/functions/pluggy-token', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok) throw new Error(tokenData.error ?? 'Falha ao gerar token de conexão.')
    return { token: tokenData.accessToken as string, sessionToken: session.access_token }
  }

  const openPluggy = async () => {
    setStatus('idle')
    setMessage('')
    try {
      const { token } = await getConnectToken()
      setConnectToken(token)
      setSyncing(true)
    } catch (error: any) {
      setStatus('error')
      setMessage(error.message)
    }
  }

  const handlePluggySuccess = async ({ item }: { item: { id: string } }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada. Faça login novamente.')

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

      await Promise.all([refreshPlanContext(), fetchConnectedAccounts()])
      setStatus('success')
      setMessage(`${syncData.totalUpserted} transações sincronizadas com sucesso!`)
    } catch (error: any) {
      setStatus('error')
      setMessage(error.message)
    } finally {
      setSyncing(false)
      setConnectToken('')
    }
  }

  const handleRemoveAccount = async (account: Account) => {
    const confirmed = window.confirm(`Remover a conta ${account.bank_name}? Essa ação apaga as transações relacionadas.`)
    if (!confirmed) return

    setRemovingId(account.id)
    setStatus('idle')

    const { error: delError } = await supabase
      .from('accounts')
      .delete()
      .eq('id', account.id)

    if (delError) {
      setStatus('error')
      setMessage('Não foi possível remover a conta. Tente novamente.')
      setRemovingId(null)
      return
    }

    if (account.pluggy_item_id) {
      const { count: remaining } = await supabase
        .from('accounts')
        .select('id', { count: 'exact', head: true })
        .eq('pluggy_item_id', account.pluggy_item_id)
        .eq('is_active', true)

      if ((remaining ?? 0) === 0) {
        await supabase
          .from('pluggy_connections')
          .delete()
          .eq('pluggy_item_id', account.pluggy_item_id)
      }
    }

    await Promise.all([fetchConnectedAccounts(), refreshPlanContext()])
    setStatus('success')
    setMessage('Conta removida com sucesso. Transações relacionadas foram limpas.')
    setRemovingId(null)
  }

  if (isLoading) return <div className="animate-pulse p-8 text-white">Carregando...</div>

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold">Conectar Banco</h2>
        <p className="text-muted-foreground">Conecte Nubank, Inter, Itaú e outras instituições pelo Open Finance (Pluggy).</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">Limite do seu plano</CardTitle>
            <CardDescription>
              {isPro ? 'Plano PRO: até 2 contas conectadas.' : 'Plano Free: 1 conta conectada. Upgrade libera 2 contas.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Contas conectadas: <strong className="text-foreground">{connectedAccounts}</strong> / {accountLimit}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Segurança</CardTitle>
            <CardDescription>Conexão segura e criptografada via Pluggy, sem armazenar sua senha bancária no app.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Open Finance regulamentado pelo Banco Central.</p>
          </CardContent>
        </Card>
      </div>

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

      {!canConnectAccount ? (
        <Card className="border-amber-500 bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-400"><Lock className="h-5 w-5" /> Limite de contas atingido</CardTitle>
            <CardDescription>
              {isPro ? 'Você já atingiu o limite de 2 contas do plano PRO.' : 'No plano Free você pode conectar 1 conta. Faça upgrade para conectar até 2.'}
            </CardDescription>
          </CardHeader>
          {!isPro && <CardContent><Button onClick={() => navigate('/app/plano')}>Ver planos e fazer upgrade</Button></CardContent>}
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" /> Vincular nova conta</CardTitle>
            <CardDescription>Após autorizar no Pluggy, suas transações entram no dashboard automaticamente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {syncing && connectToken ? (
              <PluggyConnect
                connectToken={connectToken}
                disabled={!canConnectAccount}
                onSuccess={handlePluggySuccess}
                onError={(error) => {
                  setStatus('error')
                  setMessage(error.message)
                  setSyncing(false)
                  setConnectToken('')
                }}
                onClose={() => {
                  setSyncing(false)
                  setConnectToken('')
                }}
              />
            ) : (
              <Button onClick={openPluggy} size="lg" className="w-full">
                🏦 Conectar minha conta bancária
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Contas já vinculadas</CardTitle>
            <CardDescription>Aqui você acompanha e remove instituições conectadas.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => { refreshPlanContext(); fetchConnectedAccounts() }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {loadingAccounts ? (
            <p className="text-sm text-muted-foreground">Carregando contas...</p>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta vinculada ainda. Clique em “Conectar minha conta bancária”.</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between rounded-md border px-3 py-2 gap-3">
                  <div>
                    <p className="text-sm font-medium">{account.bank_name}</p>
                    <p className="text-xs text-muted-foreground">{account.type} · {account.currency}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Conectada</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={removingId === account.id}
                      onClick={() => handleRemoveAccount(account)}
                      aria-label={`Remover conta ${account.bank_name}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
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
