import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

interface PlanGuardResult {
  profile: Profile | null
  isPro: boolean
  isLoading: boolean
  refetch: () => void
}

export function usePlanGuard(): PlanGuardResult {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setLoading] = useState(true)

  const fetchProfile = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    setProfile(data)
    setLoading(false)
  }

  useEffect(() => { fetchProfile() }, [])

  const isPro = profile?.plan_status === 'pro' || profile?.plan_status === 'pro_annual'
  return { profile, isPro, isLoading, refetch: fetchProfile }
}
