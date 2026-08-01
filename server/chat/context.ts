/**
 * BizScope Assistant — Safe User Context
 *
 * Defines the narrowly scoped context object that is assembled server-side
 * from verified Supabase data and passed to Gemini.
 *
 * SECURITY: Never trust plan, role, or usage values sent by the browser.
 * This type is built from server-resolved data only (api/chat.ts).
 */

import { createClient } from '@supabase/supabase-js';
import { normalizeTierToBudgetPlan } from '../../src/config/aiBudget.js';
import { PLAN_LIMITS } from '../../src/config/plans.js';
import type { SubscriptionPlan } from '../../src/utils/planUtils.js';

// ─── Type ─────────────────────────────────────────────────────────────────────

export interface SafeChatUserContext {
  isAuthenticated: boolean;
  userId?: string;  // verified Supabase user ID — never from request body
  plan?: string;
  role?: string;
  standardReportsUsed?: number;
  standardReportLimit?: number | null;
  regionalReportsUsed?: number;
  regionalReportLimit?: number | null;
  subscriptionStatus?: string;
}

// ─── Supabase admin singleton ─────────────────────────────────────────────────

const supabaseAdmin = (() => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
})();

const _serverBetaFullAccess: boolean = process.env.BETA_FULL_ACCESS === 'true';

// ─── Server-side plan resolution (mirrors api/analyze.ts) ────────────────────

function resolveServerPlan(role: string, subscription_tier: string): string {
  const r = (role ?? '').trim().toLowerCase();
  if (r === 'admin') return 'Enterprise';
  if (_serverBetaFullAccess) return 'Pro+';
  if (r === 'betatester' || r === 'beta_tester' || r === 'beta_vip') return 'Pro+';
  return normalizeTierToBudgetPlan(subscription_tier);
}

// ─── Anonymous context ────────────────────────────────────────────────────────

export const ANON_CONTEXT: SafeChatUserContext = { isAuthenticated: false };

// ─── Authenticated context builder ───────────────────────────────────────────

/**
 * Builds a SafeChatUserContext from a verified Supabase JWT.
 * Returns ANON_CONTEXT if the token is invalid or the DB is unavailable.
 */
export async function buildAuthenticatedContext(token: string): Promise<SafeChatUserContext> {
  if (!supabaseAdmin) return ANON_CONTEXT;

  try {
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !user) return ANON_CONTEXT;

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('role, subscription_tier')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) return ANON_CONTEXT;

    const plan = resolveServerPlan(profile.role ?? '', profile.subscription_tier ?? '');

    // Fetch current month's usage (best-effort — fails open with 0)
    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    const { data: usage } = await supabaseAdmin
      .from('usage_tracking')
      .select('report_type, count')
      .eq('user_id', user.id)
      .eq('month_key', monthKey);

    const standardUsed  = usage?.find((r: any) => r.report_type === 'standard')?.count  ?? 0;
    const regionalUsed  = usage?.find((r: any) => r.report_type === 'regional')?.count  ?? 0;

    const planKey = plan as SubscriptionPlan;
    const limits  = PLAN_LIMITS[planKey] ?? PLAN_LIMITS['Explorer'];

    // Fetch subscription status (best-effort)
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle();

    return {
      isAuthenticated: true,
      userId: user.id,
      plan,
      role: profile.role,
      standardReportsUsed:  Number(standardUsed),
      standardReportLimit:  limits.standardReportsPerCycle,
      regionalReportsUsed:  Number(regionalUsed),
      regionalReportLimit:  limits.regionalReportsPerCycle,
      subscriptionStatus:   sub?.status ?? undefined,
    };
  } catch {
    return ANON_CONTEXT;
  }
}
