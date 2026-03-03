import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePlanGuard } from '../../hooks/usePlanGuard'
import { supabase } from '../../lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Check, Zap, AlertCircle, CheckCircle2 } from 'lucide-react'

const PRO_PRICE_ID = 'price_1T6ef9EmHzv0i1aVwxx1QM9p'

const proFeatures = [
  'Sincronização automática com bancos (Open Finance)',
  'Até 2 contas conectadas',
  'Histórico ilimitado de transações',
  'Exportação CSV avançada para BI',
  'Suporte prioritário',
]

export default function Plano() {
  const { profile, isPro, isLoading } = usePlanGuard()
  const [startingCheckout, setStartingCheckout] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [searchParams] = useSearchParams()

  const checkoutStatus = useMemo(() => searchParams.get('checkout'), [searchParams])

  const handleUpgrade = async () => {
    setStartingCheckout(true)
    setCheckoutError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada. Faça login novamente.')

      const checkoutRes = await fetch('/.netlify/functions/stripe-checkout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId: PRO_PRICE_ID }),
      })
      const checkoutData = await checkoutRes.json()
      if (!checkoutRes.ok) throw new Error(checkoutData.error ?? 'Falha ao iniciar checkout.')

      window.location.href = checkoutData.url
    } catch (err: any) {
      setCheckoutError(err.message)
      setStartingCheckout(false)
    }
  }

  if (isLoading) return <div className="animate-pulse p-8">Carregando...</div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Meu Plano</h2>
        <p className="text-muted-foreground">
          Plano atual: <strong>{isPro ? '✨ PRO' : 'Gratuito'}</strong>
        </p>
      </div>

      {checkoutStatus === 'success' && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-400/40 bg-emerald-950/20 p-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Checkout concluído! Estamos processando sua assinatura.
        </div>
      )}

      {checkoutStatus === 'canceled' && (
        <div className="flex items-center gap-2 rounded-md border border-amber-400/40 bg-amber-950/20 p-3 text-sm text-amber-300">
          <AlertCircle className="h-4 w-4" /> Você cancelou o checkout. Quando quiser, pode tentar novamente.
        </div>
      )}

      {isPro ? (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> Você é PRO!
            </CardTitle>
            <CardDescription>
              {profile?.plan_expires_at
                ? `Renovação em ${new Date(profile.plan_expires_at).toLocaleDateString('pt-BR')}`
                : 'Assinatura ativa'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {proFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Upgrade para PRO</CardTitle>
            <CardDescription>Desbloqueie mais contas Pluggy e recursos premium</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {proFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            {checkoutError && (
              <div className="flex items-center gap-2 rounded-md border border-red-500/50 bg-red-950/30 p-3 text-sm text-red-300">
                <AlertCircle className="h-4 w-4" /> {checkoutError}
              </div>
            )}
            <Button onClick={handleUpgrade} disabled={startingCheckout} size="lg" className="w-full">
              <Zap className="h-4 w-4 mr-2" />
              {startingCheckout ? 'Redirecionando...' : 'Assinar PRO — R$19,90/mês'}
            </Button>
            {startingCheckout && (
              <p className="text-xs text-center text-muted-foreground">
                Redirecionando para o checkout seguro do Stripe...
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
