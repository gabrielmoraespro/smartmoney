import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { fetchJson } from '../../lib/http'
import { usePlanGuard } from '../../hooks/usePlanGuard'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { LogOut, Settings2, ShieldCheck } from 'lucide-react'

export default function Configuracoes() {
  const navigate = useNavigate()
  const { profile, isPro, isLoading } = usePlanGuard()
  const [loadingPortal, setLoadingPortal] = useState(false)

  const handleManageSubscription = async () => {
    setLoadingPortal(true)
    const loadingId = toast.loading('Abrindo portal de assinatura...')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada. Faça login novamente.')

      const res = await fetchJson<{ url?: string; error?: string }>('/.netlify/functions/stripe-portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!res.ok || !res.data.url) throw new Error(res.data.error ?? 'Não foi possível abrir o portal agora.')

      toast.success('Redirecionando para o portal Stripe.', { id: loadingId })
      window.location.href = res.data.url
    } catch (error: any) {
      toast.error(error.message, { id: loadingId })
      setLoadingPortal(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success('Sessão encerrada com sucesso.')
    navigate('/')
  }

  if (isLoading) return <div className="animate-pulse p-8 text-white">Carregando...</div>

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold">Configurações</h2>
        <p className="text-muted-foreground">Gerencie sua conta e assinatura.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" /> Conta</CardTitle>
          <CardDescription>Dados principais da sua conta SmartMoney.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">Nome:</span> {profile?.full_name ?? 'Não informado'}</p>
          <p><span className="text-muted-foreground">Email:</span> {profile?.email}</p>
          <p><span className="text-muted-foreground">Plano:</span> {isPro ? 'PRO' : 'Gratuito'}</p>
          <p>
            <span className="text-muted-foreground">Expiração:</span>{' '}
            {profile?.plan_expires_at
              ? new Date(profile.plan_expires_at).toLocaleDateString('pt-BR')
              : 'Sem expiração'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Assinatura</CardTitle>
          <CardDescription>Gerencie cobranças e método de pagamento no Stripe.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleManageSubscription} disabled={loadingPortal}>
            {loadingPortal ? 'Abrindo portal...' : 'Gerenciar assinatura'}
          </Button>
          <Button variant="ghost" onClick={handleLogout} className="gap-2 text-muted-foreground">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
