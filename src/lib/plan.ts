import type { Profile } from './types'

export const PRO_STATUSES: Profile['plan_status'][] = ['pro', 'pro_annual']

export function isProPlan(status?: Profile['plan_status']): boolean {
  return Boolean(status && PRO_STATUSES.includes(status))
}

export function getAccountLimitByPlan(status?: Profile['plan_status']): number {
  return isProPlan(status) ? 2 : 1
}
