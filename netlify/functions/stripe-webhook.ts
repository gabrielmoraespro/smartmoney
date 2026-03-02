import type { Handler } from '@netlify/functions';
import Stripe from 'stripe';
import { createAdminClient } from '../../src/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
});

export const handler: Handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let stripeEvent: Stripe.Event;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body!, sig!, webhookSecret);
  } catch (err: any) {
    console.error('[stripe-webhook] Signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const supabase = createAdminClient();

  switch (stripeEvent.type) {
    // Assinatura criada ou renovada com sucesso
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = stripeEvent.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const status    = sub.status === 'active' ? 'pro' : 'canceled';
      const expiresAt = new Date(sub.current_period_end * 1000).toISOString();

      await supabase
        .from('profiles')
        .update({ plan_status: status, plan_expires_at: expiresAt })
        .eq('stripe_customer_id', customerId);
      break;
    }

    // Assinatura cancelada
    case 'customer.subscription.deleted': {
      const sub = stripeEvent.data.object as Stripe.Subscription;
      await supabase
        .from('profiles')
        .update({ plan_status: 'canceled', plan_expires_at: null })
        .eq('stripe_customer_id', sub.customer as string);
      break;
    }

    // Pagamento falhou
    case 'invoice.payment_failed': {
      const invoice = stripeEvent.data.object as Stripe.Invoice;
      await supabase
        .from('profiles')
        .update({ plan_status: 'canceled' })
        .eq('stripe_customer_id', invoice.customer as string);
      break;
    }

    default:
      console.log(`[stripe-webhook] Unhandled event: ${stripeEvent.type}`);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
