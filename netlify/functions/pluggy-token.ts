/**
 * netlify/functions/pluggy-token.ts
 *
 * Gera um Connect Token da Pluggy para o usuário autenticado,
 * validando o limite de contas do plano antes de emitir o token.
 */
import type { Handler } from '@netlify/functions'
import { createAdminClient } from '../../src/lib/supabase'
import { getAccountLimitByPlan } from '../../src/lib/plan'
import { PluggyClient } from './_lib/pluggy-client'

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const jwt = (event.headers.authorization ?? '').replace('Bearer ', '').trim()
  if (!jwt) return { statusCode: 401, body: 'Unauthorized' }

  const supabase = createAdminClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
  if (authError || !user) return { statusCode: 401, body: 'Invalid session' }

  try {
    const [{ data: profile }, { count: accountCount }] = await Promise.all([
      supabase
        .from('profiles')
        .select('plan_status')
        .eq('id', user.id)
        .single(),
      supabase
        .from('accounts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true),
    ])

    const accountLimit = getAccountLimitByPlan(profile?.plan_status)

    if ((accountCount ?? 0) >= accountLimit) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: `Limite de contas atingido para seu plano (${accountLimit} conta${accountLimit > 1 ? 's' : ''}).`,
        }),
      }
    }

    const pluggyClient = new PluggyClient(
      process.env.PLUGGY_CLIENT_ID!,
      process.env.PLUGGY_CLIENT_SECRET!,
    )

    const accessToken = await pluggyClient.createConnectToken(user.id)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    }
  } catch (err: any) {
    console.error('[pluggy-token] erro:', err.message)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
