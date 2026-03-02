import { usePlanGuard } from '../../hooks/usePlanGuard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Check, Zap } from 'lucide-react'

const proFeatures = [
  'Sincronização automática com bancos (Open Finance)',
  'Histórico ilimitado de transações',
  'Exportação CSV avançada para BI',
  'Suporte prioritário',
]

export default function Plano() {
  const { profile, isPro, isLoading } = usePlanGuard()

  const handleUpgrade = () => {
    // Redireciona para o Stripe Checkout — substitua pela sua URL de pagamento
    window.open('https://buy.stripe.com/SEU_LINK_AQUI', '_blank')
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
              {proFeatures.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0" />{f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Upgrade para PRO</CardTitle>
            <CardDescription>Desbloqueie a sincronização automática com seu banco</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {proFeatures.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-primary shrink-0" />{f}
                </li>
              ))}
            </ul>
            <Button onClick={handleUpgrade} size="lg" className="w-full">
              <Zap className="h-4 w-4 mr-2" /> Assinar PRO — R$19,90/mês
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
