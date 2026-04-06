// Stripe Payment Provider for Vercel Serverless Functions
import Stripe from 'stripe';
import { supabaseAdmin } from './supabase';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    if (!stripeSecretKey) throw new Error('STRIPE_SECRET_KEY is not configured');
    _stripe = new Stripe(stripeSecretKey);
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return !!stripeSecretKey;
}

interface CheckoutItem {
  skillId: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  imageUrl?: string;
}

interface CreateCheckoutParams {
  userId: string;
  items: CheckoutItem[];
  successUrl: string;
  cancelUrl: string;
}

export async function createStripeCheckout(params: CreateCheckoutParams) {
  const stripe = getStripe();
  const { userId, items, successUrl, cancelUrl } = params;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(item => ({
    price_data: {
      currency: item.currency,
      product_data: {
        name: item.name,
        description: item.description,
        ...(item.imageUrl ? { images: [item.imageUrl] } : {}),
      },
      unit_amount: item.amount,
    },
    quantity: 1,
  }));

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: lineItems,
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      skillIds: items.map(i => i.skillId).join(','),
    },
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  });

  const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);
  await supabaseAdmin.from('checkout_sessions').insert({
    user_id: userId,
    provider: 'stripe',
    status: 'open',
    skill_ids: items.map(i => i.skillId),
    total_amount: totalAmount,
    currency: items[0]?.currency || 'usd',
    stripe_session_id: session.id,
  });

  return { sessionId: session.id, checkoutUrl: session.url };
}

export async function verifyStripeSession(sessionId: string) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  return {
    paid: session.payment_status === 'paid',
    status: session.status,
    userId: session.metadata?.userId,
    skillIds: session.metadata?.skillIds?.split(',') || [],
    amountTotal: session.amount_total,
    currency: session.currency,
    paymentIntentId: typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id,
  };
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string) {
  const stripe = getStripe();
  if (!stripeWebhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured');

  const event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const skillIds = session.metadata?.skillIds?.split(',') || [];
    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;

    if (!userId || skillIds.length === 0) {
      return { processed: false };
    }

    for (const skillId of skillIds) {
      const { data: skill } = await supabaseAdmin
        .from('skills')
        .select('price_amount, price_currency, pricing_model')
        .eq('id', skillId)
        .single();

      const amount = skill?.price_amount || session.amount_total || 0;
      const currency = skill?.price_currency || session.currency || 'usd';

      const { data: purchase } = await supabaseAdmin.from('purchases').insert({
        user_id: userId,
        skill_id: skillId,
        provider: 'stripe',
        status: 'completed',
        amount,
        currency,
        external_id: paymentIntentId,
        metadata: { stripe_session_id: session.id },
      }).select('id').single();

      const entitlementType = skill?.pricing_model === 'per_call' ? 'per_call'
        : skill?.pricing_model === 'subscription' ? 'subscription'
        : 'permanent';

      await supabaseAdmin.from('entitlements').upsert({
        user_id: userId,
        skill_id: skillId,
        type: entitlementType,
        remaining_calls: entitlementType === 'per_call' ? 100 : null,
        expires_at: entitlementType === 'subscription'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : null,
        provider: 'stripe',
        purchase_id: purchase?.id,
      }, { onConflict: 'user_id,skill_id' });
    }

    await supabaseAdmin.from('checkout_sessions')
      .update({ status: 'completed' })
      .eq('stripe_session_id', session.id);

    return { processed: true, skillIds, userId };
  }

  return { processed: false, eventType: event.type };
}
