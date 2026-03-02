import type { Handler } from '@netlify/functions';
import { createAdminClient } from '../../src/lib/supabase';
import type { PluggyTransaction } from '../../src/lib/types';
import { getAccountLimitByPlan } from '../../src/lib/plan';

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
  return (await res.json()).apiKey;
}

async function fetchAllTransactions(apiKey: string, accountId: string): Promise<PluggyTransaction[]> {
  const all: PluggyTransaction[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const url = new URL('https://api.pluggy.ai/transactions');
    url.searchParams.set('accountId', accountId);
    url.searchParams.set('pageSize', String(pageSize));
    url.searchParams.set('page', String(page));

    const res = await fetch(url.toString(), {
      headers: { 'X-API-KEY': apiKey },
    });
    if (!res.ok) break;

    const data = await res.json();
    all.push(...(data.results ?? []));
    if (all.length >= data.total || data.results.length < pageSize) break;
    page++;
  }
  return all;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const jwt = (event.headers.authorization ?? '').replace('Bearer ', '');
  if (!jwt) return { statusCode: 401, body: 'Unauthorized' };

  const supabase = createAdminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) return { statusCode: 401, body: 'Invalid session' };

  const body = JSON.parse(event.body ?? '{}');
  const { item_id: pluggyItemId } = body;
  if (!pluggyItemId) return { statusCode: 400, body: 'item_id is required' };

  try {
    const [{ data: profile }, { count: connectedCount }] = await Promise.all([
      supabase.from('profiles').select('plan_status').eq('id', user.id).single(),
      supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true),
    ]);

    const accountLimit = getAccountLimitByPlan(profile?.plan_status);
    const apiKey = await getPluggyApiKey();

    const itemRes = await fetch(`https://api.pluggy.ai/accounts?itemId=${pluggyItemId}`, {
      headers: { 'X-API-KEY': apiKey },
    });
    if (!itemRes.ok) throw new Error('Failed to fetch Pluggy accounts');
    const { results: pluggyAccounts } = await itemRes.json();

    const pluggyAccountIds = (pluggyAccounts ?? []).map((a: any) => a.id);
    const { data: existingAccounts } = await supabase
      .from('accounts')
      .select('pluggy_account_id')
      .eq('user_id', user.id)
      .in('pluggy_account_id', pluggyAccountIds);

    const existingSet = new Set((existingAccounts ?? []).map((a) => a.pluggy_account_id));
    const incomingNewAccounts = pluggyAccountIds.filter((id: string) => !existingSet.has(id));

    if ((connectedCount ?? 0) + incomingNewAccounts.length > accountLimit) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          error: `Seu plano permite até ${accountLimit} conta(s). Remova uma conta ou faça upgrade.`,
        }),
      };
    }

    let totalUpserted = 0;

    for (const pluggyAccount of pluggyAccounts) {
      const { data: dbAccount, error: accErr } = await supabase
        .from('accounts')
        .upsert({
          user_id: user.id,
          bank_name: pluggyAccount.institution?.name ?? 'Banco',
          type: mapAccountType(pluggyAccount.type),
          balance: pluggyAccount.balance,
          currency: pluggyAccount.currencyCode ?? 'BRL',
          pluggy_item_id: pluggyItemId,
          pluggy_account_id: pluggyAccount.id,
          last_synced_at: new Date().toISOString(),
          is_active: true,
        }, { onConflict: 'pluggy_account_id' })
        .select('id')
        .single();

      if (accErr || !dbAccount) {
        console.error('[sync] account upsert error:', accErr);
        continue;
      }

      const transactions = await fetchAllTransactions(apiKey, pluggyAccount.id);

      const rows = transactions.map((t) => ({
        account_id: dbAccount.id,
        user_id: user.id,
        description: t.description,
        amount: t.type === 'DEBIT' ? -Math.abs(t.amount) : Math.abs(t.amount),
        type: t.type === 'DEBIT' ? 'debit' : 'credit',
        category: t.category ?? null,
        category_id: t.categoryId ?? null,
        date: t.date.substring(0, 10),
        balance_after: t.balance ?? null,
        currency: t.currencyCode ?? 'BRL',
        payment_method: t.paymentMethod ?? null,
        pluggy_transaction_id: t.id,
        is_manual: false,
      }));

      const BATCH = 50;
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error: txErr } = await supabase
          .from('transactions')
          .upsert(rows.slice(i, i + BATCH), { onConflict: 'pluggy_transaction_id' });
        if (txErr) console.error('[sync] tx upsert error:', txErr);
        else totalUpserted += Math.min(BATCH, rows.length - i);
      }
    }

    await supabase
      .from('pluggy_connections')
      .upsert({ user_id: user.id, pluggy_item_id: pluggyItemId, last_synced_at: new Date().toISOString() },
        { onConflict: 'pluggy_item_id' });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, totalUpserted }),
    };
  } catch (err: any) {
    console.error('[sync-pluggy]', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

function mapAccountType(pluggyType: string): 'checking' | 'savings' | 'credit' | 'investment' {
  const map: Record<string, 'checking' | 'savings' | 'credit' | 'investment'> = {
    CHECKING: 'checking',
    SAVINGS: 'savings',
    CREDIT: 'credit',
    INVESTMENT: 'investment',
  };
  return map[pluggyType?.toUpperCase()] ?? 'checking';
}
