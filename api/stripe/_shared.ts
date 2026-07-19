import type { ServerResponse } from 'http';
import Stripe from 'stripe';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ─── Response helper ──────────────────────────────────────────────────────────

export function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

// ─── Stripe client (lazy singleton) ──────────────────────────────────────────

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' as any });
  }
  return _stripe;
}

// ─── Supabase admin client (lazy singleton) ───────────────────────────────────

let _supabase: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.');
    _supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return _supabase;
}

// ─── Auth verification ────────────────────────────────────────────────────────
// Verifies the Supabase Bearer token from the Authorization header.
// Returns { userId, email } on success, null on any failure.
// Callers must return 401 when null is returned — never trust client-supplied IDs.

export async function verifyAuth(
  authHeader: string | undefined,
): Promise<{ userId: string; email: string } | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return null;
  try {
    const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token);
    if (error || !user) return null;
    return { userId: user.id, email: user.email ?? '' };
  } catch {
    return null;
  }
}

// ─── Price → plan mapping ─────────────────────────────────────────────────────
// Built once at module init from env vars. Keyed by Stripe price ID.
// Returns the canonical display plan name stored in subscriptions.plan.

export const PRICE_TO_PLAN: Record<string, 'Pro' | 'Pro+'> = (() => {
  const map: Record<string, 'Pro' | 'Pro+'> = {};
  const pro = process.env.STRIPE_PRICE_ID_PRO;
  const proPlus = process.env.STRIPE_PRICE_ID_PRO_PLUS;
  if (pro) map[pro] = 'Pro';
  if (proPlus) map[proPlus] = 'Pro+';
  return map;
})();

// ─── Plan → DB tier mapping ───────────────────────────────────────────────────
// profiles.subscription_tier has a check constraint that does not accept 'Pro+'.
// Every write to profiles.subscription_tier must go through this map.

export const PLAN_TO_DB_TIER: Record<string, string> = {
  'Pro':  'Pro',
  'Pro+': 'ProPlus',
};

// ─── Subscription row lookup ──────────────────────────────────────────────────

export interface SubscriptionRow {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  plan: string;
  cancel_at_period_end: boolean;
  cancel_at: string | null;
  current_period_end: string | null;
}

export async function getSubscriptionRow(userId: string): Promise<SubscriptionRow | null> {
  try {
    const { data } = await getSupabaseAdmin()
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id, status, plan, cancel_at_period_end, cancel_at, current_period_end')
      .eq('user_id', userId)
      .single();
    return data ?? null;
  } catch {
    return null;
  }
}

// ─── Event log RPCs ───────────────────────────────────────────────────────────
// Thin wrappers around the three Postgres RPCs defined in Migration B.

export async function beginStripeEvent(eventId: string, eventType: string): Promise<string> {
  const { data, error } = await getSupabaseAdmin().rpc('begin_stripe_event', {
    p_event_id:   eventId,
    p_event_type: eventType,
  });
  if (error) throw new Error(`begin_stripe_event RPC failed: ${error.message}`);
  return data as string;
}

export async function completeStripeEvent(eventId: string): Promise<void> {
  await getSupabaseAdmin().rpc('complete_stripe_event', { p_event_id: eventId });
}

export async function failStripeEvent(eventId: string, errorMsg: string): Promise<void> {
  await getSupabaseAdmin().rpc('fail_stripe_event', {
    p_event_id:  eventId,
    p_error_msg: errorMsg,
  });
}
