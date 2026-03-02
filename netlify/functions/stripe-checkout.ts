import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { createAdminClient } from '../../src/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
});

const PRO_PRICE_ID = 'price_1T6ef9EmHzv0i1aVwxx1QM9p';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const jwt = (event.headers.authorization ?? '').replace('Bearer ', '');
  if (!jwt) return { statusCode: 401, body: 'Unauthorized' };

  const supabase = createAdminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) return { statusCode: 401, body: 'Invalid session' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, stripe_customer_id')
    .eq('id', user.id)
    .single();

  if (!profile) return { statusCode: 404, body: JSON.stringify({ error: 'Perfil não encontrado.' }) };

  const body = JSON.parse(event.body ?? '{}');
  const incomingPriceId = body.priceId as string | undefined;
  const priceId = incomingPriceId === PRO_PRICE_ID ? incomingPriceId : PRO_PRICE_ID;

  try {
    let customerId = profile.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: { user_id: profile.id },
      });
      customerId = customer.id;

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', profile.id);
    }

    const appUrl = process.env.APP_URL;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/app/plano/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/app/plano?checkout=canceled`,
      metadata: { user_id: profile.id },
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err: any) {
    console.error('[stripe-checkout]', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
