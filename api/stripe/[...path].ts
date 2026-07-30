/**
 * Catch-all Vercel function for non-webhook Stripe endpoints.
 * Vercel routes /api/stripe/* here; webhook.ts takes precedence for
 * /api/stripe/webhook because it is more specific.
 *
 * Handled routes:
 *   GET  /api/stripe/subscription-status
 *   POST /api/stripe/create-checkout-session
 *   POST /api/stripe/create-portal-session
 */
import type { IncomingMessage, ServerResponse } from 'http';
import {
  json,
  verifyAuth,
  getStripe,
  getSupabaseAdmin,
  getSubscriptionRow,
} from './_shared.js';

// ─── Body reader ──────────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
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

// ─── Route: GET subscription-status ─────────────────────────────────────────

async function handleSubscriptionStatus(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const user = await verifyAuth(req.headers['authorization'] as string | undefined);
  if (!user) return json(res, 401, { error: 'Unauthorized.' });

  // Fetch has_used_trial from profiles (needed for trial eligibility on the
  // pricing page — must be server-authoritative, never client-supplied).
  const { data: profileData } = await getSupabaseAdmin()
    .from('profiles')
    .select('has_used_trial')
    .eq('id', user.userId)
    .single();
  const hasUsedTrial: boolean = profileData?.has_used_trial ?? false;

  const row = await getSubscriptionRow(user.userId);
  if (!row) {
    return json(res, 200, {
      plan:             'Explorer',
      status:           'inactive',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      customerId:       null,
      subscriptionId:   null,
      hasUsedTrial,
    });
  }

  // Derive cancellation-pending from both Stripe mechanisms:
  // cancel_at_period_end=true (older API) OR cancel_at set to a future timestamp
  // (Customer Portal / newer API versions). Belt-and-suspenders: either alone is enough.
  const cancelAt = row.cancel_at ?? null;
  const cancelAtPeriodEnd =
    row.cancel_at_period_end ||
    (cancelAt != null && new Date(cancelAt) > new Date());

  // Include trial report usage for trialing subscribers so the billing page
  // can show the 5-report cap progress without a separate API call.
  let trialReportCount: number | undefined;
  if (row.status === 'trialing') {
    const { data: usageData } = await getSupabaseAdmin()
      .from('usage_tracking')
      .select('count')
      .eq('user_id', user.userId)
      .eq('report_type', 'standard')
      .eq('month_key', 'trial')
      .maybeSingle();
    trialReportCount = usageData?.count ?? 0;
  }

  return json(res, 200, {
    plan:             row.plan,
    status:           row.status,
    cancelAtPeriodEnd,
    currentPeriodEnd: row.current_period_end ?? null,
    customerId:       row.stripe_customer_id ?? null,
    subscriptionId:   row.stripe_subscription_id ?? null,
    hasUsedTrial,
    ...(trialReportCount !== undefined && { trialReportCount }),
  });
}

// ─── Route: POST create-checkout-session ────────────────────────────────────

async function handleCreateCheckout(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const user = await verifyAuth(req.headers['authorization'] as string | undefined);
  if (!user) return json(res, 401, { error: 'Unauthorized.' });

  const body = await readBody(req);
  const plan = typeof body?.plan === 'string' ? body.plan : null;

  const PLAN_TO_PRICE: Record<string, string | undefined> = {
    'Pro':  process.env.STRIPE_PRICE_ID_PRO,
    'Pro+': process.env.STRIPE_PRICE_ID_PRO_PLUS,
  };
  const priceId = plan ? PLAN_TO_PRICE[plan] : undefined;
  if (!priceId) {
    return json(res, 400, { error: 'Invalid or missing plan. Must be "Pro" or "Pro+".' });
  }

  // Reject if the user already has an active or trialing subscription.
  const { data: existing } = await getSupabaseAdmin()
    .from('subscriptions')
    .select('status, stripe_customer_id')
    .eq('user_id', user.userId)
    .single();

  if (existing && (existing.status === 'active' || existing.status === 'trialing' || existing.status === 'past_due')) {
    return json(res, 409, {
      code:  'ACTIVE_SUBSCRIPTION_EXISTS',
      error: 'An active subscription already exists. Use the Billing Portal to change plans.',
    });
  }

  // Server-side trial eligibility check. Only Pro (not Pro+) gets a trial.
  // Never trust a client-supplied flag — eligibility is always derived server-side.
  let isTrialEligible = false;
  if (plan === 'Pro') {
    const { data: profileData } = await getSupabaseAdmin()
      .from('profiles')
      .select('has_used_trial')
      .eq('id', user.userId)
      .single();
    isTrialEligible = !(profileData?.has_used_trial ?? true);
  }

  const appUrl = process.env.APP_URL ?? process.env.VITE_APP_URL ?? '';
  const stripe = getStripe();

  const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
    mode:                'subscription',
    line_items:          [{ price: priceId, quantity: 1 }],
    client_reference_id: user.userId,
    payment_method_collection: 'always',
    subscription_data: {
      metadata: { userId: user.userId },
      ...(isTrialEligible && { trial_period_days: 7 }),
    },
    success_url: `${appUrl}/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${appUrl}/billing`,
  };

  if (existing?.stripe_customer_id) {
    sessionParams.customer = existing.stripe_customer_id;
  } else {
    sessionParams.customer_email = user.email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return json(res, 200, { url: session.url, trialEligible: isTrialEligible });
}

// ─── Route: POST create-portal-session ──────────────────────────────────────

async function handleCreatePortal(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const user = await verifyAuth(req.headers['authorization'] as string | undefined);
  if (!user) return json(res, 401, { error: 'Unauthorized.' });

  const { data: row } = await getSupabaseAdmin()
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.userId)
    .single();

  if (!row?.stripe_customer_id) {
    return json(res, 404, { error: 'No billing account found for this user.' });
  }

  const appUrl = process.env.APP_URL ?? process.env.VITE_APP_URL ?? '';
  const stripe = getStripe();

  const portalSession = await stripe.billingPortal.sessions.create({
    customer:   row.stripe_customer_id,
    return_url: `${appUrl}/billing`,
  });

  return json(res, 200, { url: portalSession.url });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = req.url ?? '';
  const method = req.method ?? 'GET';

  if (url.includes('subscription-status') && method === 'GET') {
    return handleSubscriptionStatus(req, res);
  }
  if (url.includes('create-checkout-session') && method === 'POST') {
    return handleCreateCheckout(req, res);
  }
  if (url.includes('create-portal-session') && method === 'POST') {
    return handleCreatePortal(req, res);
  }

  return json(res, 404, { error: 'Not found.' });
}
