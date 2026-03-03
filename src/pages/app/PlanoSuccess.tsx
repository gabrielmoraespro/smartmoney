import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { usePlanGuard } from '../../hooks/usePlanGuard'

export default function PlanoSuccess() {
  const navigate = useNavigate()
  const { refreshPlanContext } = usePlanGuard()

  useEffect(() => {
    const syncPlan = async () => {
      await refreshPlanContext()
      setTimeout(() => {
        navigate('/app/plano?checkout=success', { replace: true })
      }, 900)
    }

    syncPlan()
  }, [navigate, refreshPlanContext])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-3">
        <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-400 animate-pulse" />
        <h2 className="text-xl font-semibold">Pagamento confirmado!</h2>
        <p className="text-sm text-muted-foreground">Atualizando seu plano e liberando recursos PRO...</p>
      </div>
    </div>
  )
}
