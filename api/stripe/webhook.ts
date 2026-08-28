import type { IncomingMessage, ServerResponse } from 'http';
import Stripe from 'stripe';
import {
  json,
  getStripe,
  getSupabaseAdmin,
  PRICE_TO_PLAN,
  PLAN_TO_DB_TIER,
  beginStripeEvent,
  completeStripeEvent,
  failStripeEvent,
} from './_shared.js';

// Disable Vercel's automatic body parsing — Stripe signature verification
// requires the raw request bytes, not a parsed JSON object.
export const config = { api: { bodyParser: false } };

export const maxDuration = 30;

// ─── Raw body reader ──────────────────────────────────────────────────────────

function getRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ─── User ID resolution ───────────────────────────────────────────────────────
// Two-step: prefer sub.metadata.userId (set at checkout creation via
// subscription_data.metadata), fall back to subscriptions table lookup
// via stripe_customer_id. Returns null when neither path resolves.

async function resolveUserId(
  subMetaUserId: string | null | undefined,
  stripeCustomerId: string,
): Promise<string | null> {
  if (subMetaUserId) return subMetaUserId;
  try {
    const { data } = await getSupabaseAdmin()
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .single();
    return data?.user_id ?? null;
  } catch {
    return null;
  }
}

// ─── Subscription period helpers ─────────────────────────────────────────────

function getPeriodTimestamps(sub: Stripe.Subscription): {
  periodStart: string;
  periodEnd: string;
} {
  const item = sub.items.data[0];
  // current_period_start/end moved to SubscriptionItem in Stripe API 2026+
  const start = (item as any).current_period_start ?? (sub as any).current_period_start;
  const end   = (item as any).current_period_end   ?? (sub as any).current_period_end;
  return {
    periodStart: start ? new Date(start * 1000).toISOString() : new Date().toISOString(),
    periodEnd:   end   ? new Date(end   * 1000).toISOString() : new Date().toISOString(),
  };
}

// Newer Stripe API versions (and the Customer Portal) schedule end-of-period
// cancellations by setting cancel_at (absolute Unix timestamp) rather than
// cancel_at_period_end=true.  Extract it as an ISO string for DB storage.
function getCancelAt(sub: Stripe.Subscription): string | null {
  const raw = (sub as any).cancel_at as number | null | undefined;
  return raw ? new Date(raw * 1000).toISOString() : null;
}

// ─── DB writers ───────────────────────────────────────────────────────────────

async function upsertSubscription(params: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  plan: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
}): Promise<void> {
  const row: Record<string, unknown> = {
    user_id:                params.userId,
    stripe_customer_id:     params.stripeCustomerId,
    stripe_subscription_id: params.stripeSubscriptionId,
    plan:                   params.plan,
    status:                 params.status,
    current_period_start:   params.periodStart,
    current_period_end:     params.periodEnd,
    cancel_at_period_end:   params.cancelAtPeriodEnd,
    cancel_at:              params.cancelAt,
    updated_at:             new Date().toISOString(),
  };
  if (params.trialStartedAt !== undefined) row.trial_started_at = params.trialStartedAt;
  if (params.trialEndsAt    !== undefined) row.trial_ends_at    = params.trialEndsAt;

  const { error } = await getSupabaseAdmin()
    .from('subscriptions')
    .upsert(row, { onConflict: 'user_id' });
  if (error) throw new Error(`subscriptions upsert failed: ${error.message}`);
}

async function setProfileTier(userId: string, plan: string): Promise<void> {
  const tier = PLAN_TO_DB_TIER[plan];
  if (!tier) throw new Error(`No DB tier mapping for plan: ${plan}`);
  const { error } = await getSupabaseAdmin()
    .from('profiles')
    .update({ subscription_tier: tier, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw new Error(`profiles update failed: ${error.message}`);
}

async function setSubscriptionStatus(userId: string, status: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('subscriptions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw new Error(`subscriptions status update failed: ${error.message}`);
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  // Payment-mode checkouts (e.g. one-time purchases) are not handled in this
  // deployment. Acknowledge without processing so Stripe stops retrying.
  if (session.mode === 'payment') {
    console.log(`[Stripe] checkout.session.completed mode=payment — acknowledged without action (sessionId=${session.id})`);
    return;
  }

  const userId = session.client_reference_id;
  if (!userId) throw new Error('checkout.session.completed missing client_reference_id');

  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(session.subscription as string);
  const priceId = sub.items.data[0]?.price.id;
  const plan = priceId ? PRICE_TO_PLAN[priceId] : undefined;
  if (!plan) throw new Error(`Unknown price ID in checkout: ${priceId}`);

  const { periodStart, periodEnd } = getPeriodTimestamps(sub);

  // Preserve the actual Stripe subscription status. When a trial period is
  // active, Stripe reports sub.status='trialing'; hardcoding 'active' here
  // would misrepresent the subscription state and skip trial quota enforcement.
  const isTrialing = sub.status === 'trialing';
  const localStatus = isTrialing ? 'trialing' : 'active';

  const trialStartedAt = (sub as any).trial_start
    ? new Date((sub as any).trial_start * 1000).toISOString()
    : null;
  const trialEndsAt = (sub as any).trial_end
    ? new Date((sub as any).trial_end * 1000).toISOString()
    : null;

  await upsertSubscription({
    userId,
    stripeCustomerId:     session.customer as string,
    stripeSubscriptionId: session.subscription as string,
    plan,
    status:              localStatus,
    periodStart,
    periodEnd,
    cancelAtPeriodEnd:   false,
    cancelAt:            null,
    trialStartedAt,
    trialEndsAt,
  });
  await setProfileTier(userId, plan);

  // Mark the trial as used so the user cannot start a second one.
  // Set unconditionally when trialing; idempotent on retry.
  if (isTrialing) {
    const { error: trialErr } = await getSupabaseAdmin()
      .from('profiles')
      .update({ has_used_trial: true, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (trialErr) {
      console.error(`[Stripe] failed to set has_used_trial for userId=${userId}:`, trialErr.message);
    }
  }

  console.log(
    `[Stripe] checkout.session.completed — userId=${userId} plan=${plan} ` +
    `status=${localStatus} trialing=${isTrialing}`,
  );
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
  const userId = await resolveUserId(
    sub.metadata?.userId as string | undefined,
    sub.customer as string,
  );
  if (!userId) {
    throw new Error(
      `userId not resolvable: not in sub.metadata and not in subscriptions table. ` +
      `customerId=${sub.customer} subId=${sub.id}`,
    );
  }

  const priceId = sub.items.data[0]?.price.id;
  const plan = priceId ? PRICE_TO_PLAN[priceId] : undefined;
  if (!plan) throw new Error(`Unknown price ID in subscription.updated: ${priceId}`);

  const { periodStart, periodEnd } = getPeriodTimestamps(sub);

  // Map Stripe status to local status. 'canceled' via this event is treated
  // identically to subscription.deleted.
  let localStatus: string;
  if (sub.status === 'canceled') {
    localStatus = 'cancelled';
  } else if (sub.status === 'past_due') {
    localStatus = 'past_due';
  } else if (sub.status === 'trialing') {
    localStatus = 'trialing';
  } else {
    localStatus = 'active';
  }

  const cancelAt = getCancelAt(sub);
  // Treat either Stripe cancellation mechanism as "cancellation scheduled":
  // - cancel_at_period_end=true (older API / manual API calls)
  // - cancel_at set to a future timestamp (Customer Portal, newer API versions)
  const cancelAtPeriodEnd = sub.cancel_at_period_end || cancelAt != null;

  await upsertSubscription({
    userId,
    stripeCustomerId:     sub.customer as string,
    stripeSubscriptionId: sub.id,
    plan,
    status:              localStatus,
    periodStart,
    periodEnd,
    cancelAtPeriodEnd,
    cancelAt,
  });

  // Sync profile tier for active/trialing states, including when cancellation
  // is scheduled (cancel_at_period_end=true). The subscription is still live
  // and the current plan price may have changed. Downgrade to Explorer only
  // when the subscription actually ends (subscription.deleted).
  if (localStatus === 'active' || localStatus === 'trialing') {
    await setProfileTier(userId, plan);
  }
  if (localStatus === 'cancelled') {
    await setProfileTier(userId, 'Explorer');
  }
  // past_due: do not downgrade — Stripe retries payment; keep access until deleted.

  console.log(
    `[Stripe] subscription.updated — userId=${userId} plan=${plan} ` +
    `status=${localStatus} cancelAtPeriodEnd=${cancelAtPeriodEnd}`,
  );
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const userId = await resolveUserId(
    sub.metadata?.userId as string | undefined,
    sub.customer as string,
  );
  if (!userId) {
    throw new Error(
      `userId not resolvable for subscription.deleted. ` +
      `customerId=${sub.customer} subId=${sub.id}`,
    );
  }

  // Guard: only downgrade if the deleted subscription is the one on record.
  // Prevents a stale deletion event from overwriting a newer active subscription.
  const { data: row } = await getSupabaseAdmin()
    .from('subscriptions')
    .select('stripe_subscription_id')
    .eq('user_id', userId)
    .single();

  if (row?.stripe_subscription_id && row.stripe_subscription_id !== sub.id) {
    console.warn(
      `[Stripe] subscription.deleted — subId=${sub.id} does not match current ` +
      `subId=${row.stripe_subscription_id} for userId=${userId}; skipping downgrade`,
    );
    return;
  }

  const { error } = await getSupabaseAdmin()
    .from('subscriptions')
    .update({
      status:              'cancelled',
      plan:                'Explorer',
      cancel_at_period_end: false,
      cancel_at:           null,
      updated_at:          new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) throw new Error(`subscriptions update failed: ${error.message}`);

  await setProfileTier(userId, 'Explorer');
  console.log(`[Stripe] subscription.deleted — userId=${userId} downgraded to Explorer`);
}

async function handleInvoicePaymentFailed(inv: Stripe.Invoice): Promise<void> {
  const customerId = inv.customer as string;
  const { data: row } = await getSupabaseAdmin()
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!row?.user_id) {
    throw new Error(`userId not resolvable for invoice.payment_failed. customerId=${customerId}`);
  }

  await setSubscriptionStatus(row.user_id, 'past_due');
  // Do not change profiles.subscription_tier — Stripe retries; keep access until deleted.
  console.log(`[Stripe] invoice.payment_failed — userId=${row.user_id} status=past_due`);
}

async function handleInvoicePaymentSucceeded(inv: Stripe.Invoice): Promise<void> {
  const customerId = inv.customer as string;
  const { data: row } = await getSupabaseAdmin()
    .from('subscriptions')
    .select('user_id, stripe_subscription_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!row?.user_id) {
    throw new Error(
      `userId not resolvable for invoice.payment_succeeded. customerId=${customerId}`,
    );
  }

  // Retrieve the current subscription to restore authoritative state.
  // This is the canonical recovery path from past_due after a successful retry.
  // inv.subscription was removed from Invoice types in Stripe API 2026+; access via any.
  const subscriptionId = (inv as any).subscription as string | null ?? row.stripe_subscription_id;
  if (!subscriptionId) {
    console.warn(`[Stripe] invoice.payment_succeeded — no subscriptionId to reconcile for userId=${row.user_id}`);
    return;
  }

  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);

  // Guard: if this invoice belongs to an already-cancelled subscription, skip.
  // This prevents a stale invoice for an old sub from overwriting a newer active sub.
  if (sub.status === 'canceled') {
    console.warn(
      `[Stripe] invoice.payment_succeeded — subscriptionId=${subscriptionId} is canceled; ` +
      `skipping overwrite for userId=${row.user_id}`,
    );
    return;
  }

  const priceId = sub.items.data[0]?.price.id;
  const plan = priceId ? PRICE_TO_PLAN[priceId] : undefined;
  if (!plan) throw new Error(`Unknown price ID in invoice.payment_succeeded: ${priceId}`);

  const { periodStart, periodEnd } = getPeriodTimestamps(sub);

  const cancelAt = getCancelAt(sub);
  // Preserve 'trialing' — this event also fires for the $0 trial invoice paid
  // at checkout. Hardcoding 'active' here would overwrite the correct trialing
  // status and bypass trial quota enforcement for the full trial period.
  const invoiceStatus = sub.status === 'trialing' ? 'trialing' : 'active';
  await upsertSubscription({
    userId:              row.user_id,
    stripeCustomerId:    customerId,
    stripeSubscriptionId: subscriptionId,
    plan,
    status:              invoiceStatus,
    periodStart,
    periodEnd,
    cancelAtPeriodEnd:   sub.cancel_at_period_end || cancelAt != null,
    cancelAt,
  });
  await setProfileTier(row.user_id, plan);

  console.log(
    `[Stripe] invoice.payment_succeeded — userId=${row.user_id} plan=${plan} ` +
    `status=${invoiceStatus} (trialing preserved; active=past_due recovery)`,
  );
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  // Read raw body before any other operation — required for signature verification.
  let rawBody: Buffer;
  try {
    rawBody = await getRawBody(req);
  } catch (err: any) {
    console.error('[Stripe webhook] Failed to read request body:', err.message);
    return json(res, 400, { error: 'Could not read request body.' });
  }

  // Validate Stripe signature. Return 400 for invalid signatures or malformed
  // requests — these are client errors, not server errors, and should not be retried.
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Stripe webhook] STRIPE_WEBHOOK_SECRET is not configured.');
    return json(res, 500, { error: 'Webhook secret not configured.' });
  }
  if (!sig) {
    return json(res, 400, { error: 'Missing stripe-signature header.' });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig as string, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe webhook] Signature verification failed:', err.message);
    return json(res, 400, { error: `Webhook signature error: ${err.message}` });
  }

  // Idempotency gate — claims this event or returns early.
  let signal: string;
  try {
    signal = await beginStripeEvent(event.id, event.type);
  } catch (err: any) {
    console.error('[Stripe webhook] begin_stripe_event failed:', err.message);
    return json(res, 500, { error: 'Event log unavailable.' });
  }

  if (signal === 'already_done') {
    console.log(`[Stripe webhook] ${event.id} already processed — returning 200`);
    return json(res, 200, { received: true });
  }
  if (signal === 'in_progress') {
    console.log(`[Stripe webhook] ${event.id} already in progress — returning 200`);
    return json(res, 200, { received: true });
  }

  // signal === 'proceed' — this execution owns the event.
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      default:
        // Unhandled event types are not errors — complete immediately.
        console.log(`[Stripe webhook] Unhandled event type: ${event.type}`);
        await completeStripeEvent(event.id);
        return json(res, 200, { received: true });
    }

    await completeStripeEvent(event.id);
    return json(res, 200, { received: true });

  } catch (err: any) {
    // Valid event, but DB or Stripe API processing failed. Return 500 so
    // Stripe classifies this as a server error and retries. Mark as failed
    // so begin_stripe_event re-claims it on the next delivery.
    console.error(`[Stripe webhook] Processing failed for ${event.type} (${event.id}):`, err.message);
    try {
      await failStripeEvent(event.id, err.message ?? 'unknown error');
    } catch (logErr: any) {
      console.error('[Stripe webhook] failStripeEvent also failed:', logErr.message);
    }
    return json(res, 500, { error: 'Event processing failed.' });
  }
}
