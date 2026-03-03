import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { createAdminClient } from '../../src/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' });

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const jwt = (event.headers.authorization ?? '').replace('Bearer ', '');
  if (!jwt) return { statusCode: 401, body: 'Unauthorized' };

  const supabase = createAdminClient();
  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) return { statusCode: 401, body: 'Invalid session' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Cliente Stripe ainda não vinculado.' }) };
  }

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.APP_URL}/app/configuracoes`,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: portal.url }),
    };
  } catch (err: any) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
