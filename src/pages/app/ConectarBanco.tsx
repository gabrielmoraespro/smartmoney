import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { fetchJson } from '../../lib/http'
import { syncPluggyItems } from '../../lib/pluggy-sync'
import { usePlanGuard } from '../../hooks/usePlanGuard'
import type { Account } from '../../lib/types'
import { PluggyConnect } from '../../components/pluggy/PluggyConnect'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Lock, Landmark, ShieldCheck, RefreshCw, Trash2 } from 'lucide-react'

export default function ConectarBanco() {
  const { isLoading, isPro, accountLimit, connectedAccounts, canConnectAccount, refreshPlanContext } = usePlanGuard()
  const navigate = useNavigate()

  const [syncing, setSyncing] = useState(false)
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [connectToken, setConnectToken] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])

  const functionsBaseUrl = import.meta.env.VITE_FUNCTIONS_BASE_URL ?? '/.netlify/functions'

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

    const tokenRes = await fetchJson<{ accessToken?: string; error?: string }>(`${functionsBaseUrl}/pluggy-token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })

    if (!tokenRes.ok) throw new Error(tokenRes.data.error ?? 'Falha ao gerar token de conexão.')
    return tokenRes.data.accessToken as string
  }

  const handleManualSync = async () => {
    const itemIds = accounts.map((a) => a.pluggy_item_id).filter(Boolean) as string[]
    if (itemIds.length === 0) {
      toast.error('Nenhuma conta Pluggy para sincronizar.')
      return
    }

    const loadingId = toast.loading('Sincronização iniciada...')
    try {
      const total = await syncPluggyItems(itemIds, functionsBaseUrl)
      await Promise.all([refreshPlanContext(), fetchConnectedAccounts()])
      toast.success(`${total} transações atualizadas com sucesso!`, { id: loadingId })
    } catch (error: any) {
      toast.error(error.message ?? 'Falha ao sincronizar.', { id: loadingId })
    }
  }

  const openPluggy = async () => {
    const loadingId = toast.loading('Gerando token de conexão...')
    try {
      const token = await getConnectToken()
      setConnectToken(token)
      setSyncing(true)
      toast.success('Conexão Pluggy iniciada.', { id: loadingId })
    } catch (error: any) {
      const msg = String(error.message || '')
      if (msg.includes('404')) toast.error('Funções Netlify não encontradas. Use netlify dev.', { id: loadingId })
      else toast.error(msg, { id: loadingId })
    }
  }

  const handlePluggySuccess = async ({ item }: { item: { id: string } }) => {
    const loadingId = toast.loading('Sincronização iniciada...')
    try {
      const total = await syncPluggyItems([item.id], functionsBaseUrl)
      await Promise.all([refreshPlanContext(), fetchConnectedAccounts()])
      toast.success(`Conta conectada com sucesso! ${total} transações importadas.`, { id: loadingId })
    } catch (error: any) {
      toast.error(String(error.message || 'Falha ao sincronizar após conectar conta.'), { id: loadingId })
    } finally {
      setSyncing(false)
      setConnectToken('')
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

  const handleRemoveAccount = async (account: Account) => {
    const confirmed = window.confirm(`Remover a conta ${account.bank_name}? Essa ação apaga as transações relacionadas.`)
    if (!confirmed) return

    setRemovingId(account.id)

    const { error: delError } = await supabase
      .from('accounts')
      .delete()
      .eq('id', account.id)

    if (delError) {
      toast.error('Não foi possível remover a conta. Tente novamente.')
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
        await supabase.from('pluggy_connections').delete().eq('pluggy_item_id', account.pluggy_item_id)
      }
    }

    await Promise.all([fetchConnectedAccounts(), refreshPlanContext()])
    toast.success('Conta removida com sucesso.')
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
            <CardDescription>{isPro ? 'Plano PRO: até 2 contas conectadas.' : 'Plano Free: 1 conta conectada. Upgrade libera 2 contas.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Contas conectadas: <strong className="text-foreground">{connectedAccounts}</strong> / {accountLimit}</div>
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

      {!canConnectAccount ? (
        <Card className="border-amber-500 bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-400"><Lock className="h-5 w-5" /> Limite de contas atingido</CardTitle>
            <CardDescription>{isPro ? 'Você já atingiu o limite de 2 contas do plano PRO.' : 'No plano Free você pode conectar 1 conta. Faça upgrade para conectar até 2.'}</CardDescription>
          </CardHeader>
          {!isPro && <CardContent><Button onClick={() => navigate('/app/plano')}>Ver planos e fazer upgrade</Button></CardContent>}
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" /> Vincular nova conta</CardTitle>
            <CardDescription>Após autorizar no Pluggy, suas transações entram no dashboard automaticamente.</CardDescription>
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
                autoOpen
                disabled={!canConnectAccount}
                onSuccess={handlePluggySuccess}
                onError={(error) => {
                  toast.error(error.message)
                  setSyncing(false)
                  setConnectToken('')
                }}
                onClose={() => {
                  setSyncing(false)
                  setConnectToken('')
                }}
              />
            ) : (
              <Button onClick={openPluggy} size="lg" className="w-full">🏦 Conectar minha conta bancária</Button>
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
          <div className="flex gap-2">
            <Button variant="default" size="sm" onClick={handleManualSync}>🔄 Sincronizar agora</Button>
            <Button variant="outline" size="sm" onClick={() => { refreshPlanContext(); fetchConnectedAccounts(); toast.success('Dados atualizados.') }}>
              <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
            </Button>
          </div>
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
                    <Button variant="ghost" size="icon" disabled={removingId === account.id} onClick={() => handleRemoveAccount(account)} aria-label={`Remover conta ${account.bank_name}`}>
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
