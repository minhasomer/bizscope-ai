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
  DECISION_PASS_PRICE_ID,
  DECISION_PASS_VIABILITY_QUANTITY,
  DECISION_PASS_MARKET_GAP_QUANTITY,
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

  // Server-authoritative trial feature flag.
  const proTrialEnabled = process.env.PRO_TRIAL_ENABLED?.trim() === 'true';

  // Fetch trial/plan/role from profiles — never trust a client-supplied value.
  const { data: profileData } = await getSupabaseAdmin()
    .from('profiles')
    .select('has_used_trial, subscription_tier, role')
    .eq('id', user.userId)
    .single();
  const hasUsedTrial: boolean = profileData?.has_used_trial ?? false;

  const row = await getSubscriptionRow(user.userId);

  // trialEligible: server-computed and returned so the client can rely on
  // this field rather than independently re-deriving eligibility.
  // Requires: trial feature enabled AND all of:
  //   - no prior trial used
  //   - no active/trialing/past_due subscription
  //   - no historical Pro/Pro+ subscription row (former paid users are ineligible)
  //   - profile tier not elevated to Pro/ProPlus without a Stripe sub
  //   - role is not Admin or BetaTester (already have elevated access)
  const activeStatuses = ['active', 'trialing', 'past_due'];
  const hasHistoricalPaidPlan = ['Pro', 'Pro+'].includes(row?.plan ?? '');
  const profileTierElevated   = ['Pro', 'ProPlus'].includes(profileData?.subscription_tier ?? '');
  const roleElevated          = ['Admin', 'BetaTester'].includes(profileData?.role ?? '');
  const trialEligible = proTrialEnabled &&
    !hasUsedTrial &&
    !activeStatuses.includes(row?.status ?? '') &&
    !hasHistoricalPaidPlan &&
    !profileTierElevated &&
    !roleElevated;

  // Remaining Decision Pass credits for this user (viability + market_gap separately).
  let decisionPassBalance = { viability: 0, marketGap: 0 };
  try {
    const { data: passData } = await getSupabaseAdmin()
      .from('decision_pass_entitlements')
      .select('viability_remaining, market_gap_remaining')
      .eq('user_id', user.userId);
    const rows: any[] = passData ?? [];
    decisionPassBalance = {
      viability: rows.reduce((s: number, r: any) => s + (r.viability_remaining  ?? 0), 0),
      marketGap: rows.reduce((s: number, r: any) => s + (r.market_gap_remaining ?? 0), 0),
    };
  } catch { /* non-fatal — return zero balance on error */ }

  if (!row) {
    return json(res, 200, {
      plan:             'Explorer',
      status:           'inactive',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      customerId:       null,
      subscriptionId:   null,
      hasUsedTrial,
      trialEligible,
      proTrialEnabled,
      decisionPassBalance,
    });
  }

  // Derive cancellation-pending from both Stripe mechanisms:
  // cancel_at_period_end=true (older API) OR cancel_at set to a future timestamp
  // (Customer Portal / newer API versions). Belt-and-suspenders: either alone is enough.
  const cancelAt = row.cancel_at ?? null;
  const cancelAtPeriodEnd =
    row.cancel_at_period_end ||
    (cancelAt != null && new Date(cancelAt) > new Date());

  const trialing = row.status === 'trialing';

  // Include trial report usage for trialing subscribers so the billing page
  // can show the 5-report cap progress without a separate API call.
  let trialReportCount: number | undefined;
  if (trialing) {
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
    trialEligible,
    proTrialEnabled,
    trialing,
    trialStartedAt:   row.trial_started_at ?? null,
    trialEndsAt:      row.trial_ends_at    ?? null,
    decisionPassBalance,
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
    .select('status, stripe_customer_id, plan')
    .eq('user_id', user.userId)
    .single();

  if (existing && (existing.status === 'active' || existing.status === 'trialing' || existing.status === 'past_due')) {
    return json(res, 409, {
      code:  'ACTIVE_SUBSCRIPTION_EXISTS',
      error: 'An active subscription already exists. Use the Billing Portal to change plans.',
    });
  }

  // Server-side trial eligibility — authoritative, never trusts client input.
  // Requires ALL of: PRO_TRIAL_ENABLED=true, plan=Pro (not Pro+),
  // no prior trial, no active subscription, Explorer-only (no paid history).
  const proTrialEnabled = process.env.PRO_TRIAL_ENABLED?.trim() === 'true';
  let isTrialEligible = false;
  if (proTrialEnabled && plan === 'Pro') {
    const { data: profileData } = await getSupabaseAdmin()
      .from('profiles')
      .select('has_used_trial, subscription_tier, role')
      .eq('id', user.userId)
      .single();
    // has_used_trial defaults to true on error so that a DB failure never
    // accidentally grants a second trial.
    const noPriorTrial        = !(profileData?.has_used_trial ?? true);
    const hasHistoricalPaidPlan = ['Pro', 'Pro+'].includes(existing?.plan ?? '');
    const profileTierElevated   = ['Pro', 'ProPlus'].includes(profileData?.subscription_tier ?? '');
    const roleElevated          = ['Admin', 'BetaTester'].includes(profileData?.role ?? '');
    isTrialEligible = noPriorTrial && !hasHistoricalPaidPlan && !profileTierElevated && !roleElevated;
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

// ─── Route: POST create-decision-pass-checkout ───────────────────────────────

async function handleCreateDecisionPassCheckout(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const user = await verifyAuth(req.headers['authorization'] as string | undefined);
  if (!user) return json(res, 401, { error: 'Unauthorized.' });

  if (!DECISION_PASS_PRICE_ID) {
    console.error('[DecisionPass] STRIPE_PRICE_ID_DECISION_PASS is not configured.');
    return json(res, 503, { error: 'Decision Pass checkout is not currently available.' });
  }

  const appUrl = process.env.APP_URL ?? process.env.VITE_APP_URL ?? '';
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode:                'payment',
    line_items:          [{ price: DECISION_PASS_PRICE_ID, quantity: 1 }],
    client_reference_id: user.userId,
    metadata: {
      purchase_type: 'decision_pass',
      // Quantities are NOT stored in metadata; webhook reads from server-side
      // constants (DECISION_PASS_VIABILITY_QUANTITY, DECISION_PASS_MARKET_GAP_QUANTITY).
    },
    success_url: `${appUrl}/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${appUrl}/pricing`,
  });

  return json(res, 200, { url: session.url });
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
  if (url.includes('create-decision-pass-checkout') && method === 'POST') {
    return handleCreateDecisionPassCheckout(req, res);
  }
  if (url.includes('create-portal-session') && method === 'POST') {
    return handleCreatePortal(req, res);
  }

  return json(res, 404, { error: 'Not found.' });
}
