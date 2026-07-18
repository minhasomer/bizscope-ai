import type { IncomingMessage, ServerResponse } from 'http';
import { json, verifyAuth, getStripe, getSupabaseAdmin, PRICE_TO_PLAN } from './_shared.js';

async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const user = await verifyAuth(req.headers['authorization'] as string | undefined);
  if (!user) {
    return json(res, 401, { error: 'Unauthorized.' });
  }

  const body = (await readBody(req)) as Record<string, unknown>;
  const priceId = typeof body?.priceId === 'string' ? body.priceId : null;

  if (!priceId || !PRICE_TO_PLAN[priceId]) {
    return json(res, 400, { error: 'Invalid or missing priceId.' });
  }

  // Reject if user already has an active or trialing subscription.
  // Plan changes must go through the Billing Portal, not a new Checkout.
  const { data: existing } = await getSupabaseAdmin()
    .from('subscriptions')
    .select('status, stripe_customer_id')
    .eq('user_id', user.userId)
    .single();

  if (existing && (existing.status === 'active' || existing.status === 'trialing')) {
    return json(res, 409, {
      code:  'ACTIVE_SUBSCRIPTION_EXISTS',
      error: 'An active subscription already exists. Use the Billing Portal to change plans.',
    });
  }

  const appUrl = process.env.APP_URL ?? process.env.VITE_APP_URL ?? '';
  const stripe = getStripe();

  const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
    mode:               'subscription',
    line_items:         [{ price: priceId, quantity: 1 }],
    client_reference_id: user.userId,
    // Attach userId to the Stripe Subscription object so subscription.updated
    // events can resolve the user without a DB lookup (handles out-of-order delivery).
    subscription_data: {
      metadata: { userId: user.userId },
    },
    success_url: `${appUrl}/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${appUrl}/billing`,
  };

  // Reuse existing Stripe customer if one is on record.
  if (existing?.stripe_customer_id) {
    sessionParams.customer = existing.stripe_customer_id;
  } else {
    sessionParams.customer_email = user.email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return json(res, 200, { url: session.url });
}
