import type { Handler } from '@netlify/functions';
import { createAdminClient } from '../../src/lib/supabase';
import { getAccountLimitByPlan } from '../../src/lib/plan';

/** Obtém API Key da Pluggy via Client Credentials */
async function getPluggyApiKey(): Promise<string> {
  const res = await fetch('https://api.pluggy.ai/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: process.env.PLUGGY_CLIENT_ID,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Pluggy auth failed: ${res.status}`);
  const data = await res.json();
  return data.apiKey as string;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const authHeader = event.headers.authorization ?? '';
  const jwt = authHeader.replace('Bearer ', '');
  if (!jwt) return { statusCode: 401, body: 'Unauthorized' };

  const supabase = createAdminClient();
  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) return { statusCode: 401, body: 'Invalid session' };

  try {
    const [{ data: profile }, { count: accountCount }] = await Promise.all([
      supabase.from('profiles').select('plan_status').eq('id', user.id).single(),
      supabase
        .from('accounts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true),
    ]);

    const accountLimit = getAccountLimitByPlan(profile?.plan_status);
    if ((accountCount ?? 0) >= accountLimit) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          error: `Limite de contas atingido para seu plano (${accountLimit}).`,
        }),
      };
    }

    const apiKey = await getPluggyApiKey();

    const tokenRes = await fetch('https://api.pluggy.ai/connect_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        clientUserId: user.id,
      }),
    });

    if (!tokenRes.ok) throw new Error(`Token generation failed: ${tokenRes.status}`);
    const { accessToken } = await tokenRes.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    };
  } catch (err: any) {
    console.error('[pluggy-token]', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
