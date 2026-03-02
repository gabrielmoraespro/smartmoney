import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { getAccountLimitByPlan, isProPlan } from '../lib/plan'

export type PlanGuardResult = {
  profile: Profile | null
  isPro: boolean
  accountLimit: number
  connectedAccounts: number
  canConnectAccount: boolean
  isLoading: boolean
  refreshPlanContext: () => Promise<void>
}

export function usePlanGuard(): PlanGuardResult {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [connectedAccounts, setConnectedAccounts] = useState(0)
  const [isLoading, setLoading] = useState(true)

  const refreshPlanContext = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: profileData }, { count }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('accounts').select('id', { count: 'exact', head: true })
          .eq('user_id', user.id).eq('is_active', true),
      ])

      setProfile(profileData as Profile | null)
      setConnectedAccounts(count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refreshPlanContext() }, [refreshPlanContext])

  const isPro = isProPlan(profile?.plan_status)
  const accountLimit = getAccountLimitByPlan(profile?.plan_status)
  const canConnectAccount = connectedAccounts < accountLimit

  return { profile, isPro, accountLimit, connectedAccounts, canConnectAccount, isLoading, refreshPlanContext }
}
