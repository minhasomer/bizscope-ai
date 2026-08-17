/**
 * BizScope AI — Server-side usage tracking (quota source of truth)
 * ═════════════════════════════════════════════════════════════════
 *
 * Reads/writes the `usage_tracking` table. This is the authoritative
 * quota counter for standard reports (viability + market_gap), separate
 * from `report_activity_log` (analytics/cost history, not used for
 * enforcement).
 *
 * Requires this RPC + unique constraint in Supabase (see migration SQL
 * provided alongside this change):
 *   - UNIQUE (user_id, report_type, month_key) on public.usage_tracking
 *   - public.increment_usage_tracking(p_user_id uuid, p_report_type text, p_month_key text)
 */

import type { SubscriptionPlan } from '../utils/planUtils';
import { getPlanLimits } from './plans.js';

/** Month key format used to bucket usage_tracking rows, e.g. "2026-06". */
export function getCurrentMonthKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number | null;
}

/**
 * Shared quota lookup against usage_tracking for the current month.
 * Fails open (allows the request) if Supabase is unreachable or the query
 * errors, consistent with the rest of the app's logging/tracking paths —
 * a transient DB issue must not block report generation.
 */
async function checkQuota(
  supabaseAdmin: any,
  userId: string,
  reportType: 'standard' | 'regional',
  limit: number | null,
  betaFullAccess: boolean,
): Promise<QuotaCheckResult> {
  if (limit === null) {
    return { allowed: true, used: 0, limit: null };
  }
  if (!supabaseAdmin) {
    return { allowed: true, used: 0, limit };
  }

  const monthKey = getCurrentMonthKey();
  const { data, error } = await supabaseAdmin
    .from('usage_tracking')
    .select('count')
    .eq('user_id', userId)
    .eq('report_type', reportType)
    .eq('month_key', monthKey)
    .maybeSingle();

  if (error) {
    console.error(`[UsageTracking] quota check failed (${reportType}), failing open:`, error.message ?? error);
    return { allowed: true, used: 0, limit };
  }

  const used = data?.count ?? 0;
  if (betaFullAccess) {
    return { allowed: true, used, limit };
  }
  return { allowed: used < limit, used, limit };
}

/**
 * Checks the caller's standard-report quota for the current month.
 * report_type is 'standard' — viability reports (api/analyze.ts) only.
 */
export async function checkStandardQuota(
  supabaseAdmin: any,
  userId: string,
  plan: SubscriptionPlan,
  betaFullAccess: boolean,
): Promise<QuotaCheckResult> {
  const { standardReportsPerCycle } = getPlanLimits(plan);
  return checkQuota(supabaseAdmin, userId, 'standard', standardReportsPerCycle, betaFullAccess);
}

/**
 * Checks the caller's Market Gap / Regional-counter quota for the current
 * month. report_type is 'regional' — this is the dashboard's "Market Gap
 * Reports" counter (PLAN_LIMITS.regionalReportsPerCycle), used by
 * api/opportunities.ts.
 */
export async function checkRegionalQuota(
  supabaseAdmin: any,
  userId: string,
  plan: SubscriptionPlan,
  betaFullAccess: boolean,
): Promise<QuotaCheckResult> {
  const { regionalReportsPerCycle } = getPlanLimits(plan);
  return checkQuota(supabaseAdmin, userId, 'regional', regionalReportsPerCycle, betaFullAccess);
}

/**
 * Atomically increments usage_tracking for (userId, reportType, currentMonth)
 * via the increment_usage_tracking RPC. Call only after a successful,
 * non-cached AI generation. Never throws — errors are logged and swallowed
 * so a tracking failure never breaks the report response.
 */
export async function incrementUsageTracking(
  supabaseAdmin: any,
  userId: string,
  reportType: string,
): Promise<void> {
  if (!supabaseAdmin) return;
  const monthKey = getCurrentMonthKey();
  try {
    const { error } = await supabaseAdmin.rpc('increment_usage_tracking', {
      p_user_id: userId,
      p_report_type: reportType,
      p_month_key: monthKey,
    });
    if (error) throw error;
    console.log(`[UsageTracking] incremented user=${userId} report_type=${reportType} month=${monthKey}`);
  } catch (err: any) {
    console.error('[UsageTracking] increment failed:', err.message ?? err);
  }
}

// ─── Decision Pass entitlements ──────────────────────────────────────────────
// Separate from usage_tracking: one-time Decision Pass purchases via Stripe.
// Each pass grants viability_remaining=3 and market_gap_remaining=1.
// The two counters are independent — viability balance cannot be used for
// Market Gap reports and vice versa.
// RPCs use SELECT FOR UPDATE SKIP LOCKED for race-safe atomic decrements.

export interface DecisionPassBalance {
  viability: number;
  marketGap: number;
}

/**
 * Returns remaining Decision Pass credits for a user.
 * Returns { viability: 0, marketGap: 0 } on any DB error.
 */
export async function getDecisionPassBalance(
  supabaseAdmin: any,
  userId: string,
): Promise<DecisionPassBalance> {
  if (!supabaseAdmin) return { viability: 0, marketGap: 0 };
  try {
    const { data, error } = await supabaseAdmin
      .from('decision_pass_entitlements')
      .select('viability_remaining, market_gap_remaining')
      .eq('user_id', userId);
    if (error) throw error;
    const rows: any[] = data ?? [];
    return {
      viability: rows.reduce((s: number, r: any) => s + (r.viability_remaining  ?? 0), 0),
      marketGap: rows.reduce((s: number, r: any) => s + (r.market_gap_remaining ?? 0), 0),
    };
  } catch (err: any) {
    console.error('[UsageTracking] decision pass balance check failed:', err.message ?? err);
    return { viability: 0, marketGap: 0 };
  }
}

/**
 * Atomically decrements viability_remaining on the oldest pass with balance.
 * Returns the UUID of the decremented row, or null if no balance.
 */
export async function decrementDecisionPassViability(
  supabaseAdmin: any,
  userId: string,
): Promise<string | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin.rpc('decrement_decision_pass_viability', {
      p_user_id: userId,
    });
    if (error) throw error;
    return (data as string | null) ?? null;
  } catch (err: any) {
    console.error('[UsageTracking] decision pass viability decrement failed:', err.message ?? err);
    return null;
  }
}

/**
 * Restores one viability credit on a specific pass row.
 * Called when viability report generation fails after a pre-decrement.
 */
export async function restoreDecisionPassViability(
  supabaseAdmin: any,
  passId: string,
): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    const { error } = await supabaseAdmin.rpc('restore_decision_pass_viability', {
      p_pass_id: passId,
    });
    if (error) throw error;
  } catch (err: any) {
    console.error('[UsageTracking] decision pass viability restore failed:', err.message ?? err);
  }
}

/**
 * Atomically decrements market_gap_remaining on the oldest pass with balance.
 * Returns the UUID of the decremented row, or null if no balance.
 */
export async function decrementDecisionPassMarketGap(
  supabaseAdmin: any,
  userId: string,
): Promise<string | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin.rpc('decrement_decision_pass_market_gap', {
      p_user_id: userId,
    });
    if (error) throw error;
    return (data as string | null) ?? null;
  } catch (err: any) {
    console.error('[UsageTracking] decision pass market_gap decrement failed:', err.message ?? err);
    return null;
  }
}

/**
 * Restores one market_gap credit on a specific pass row.
 * Called when Market Gap generation fails after a pre-decrement.
 */
export async function restoreDecisionPassMarketGap(
  supabaseAdmin: any,
  passId: string,
): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    const { error } = await supabaseAdmin.rpc('restore_decision_pass_market_gap', {
      p_pass_id: passId,
    });
    if (error) throw error;
  } catch (err: any) {
    console.error('[UsageTracking] decision pass market_gap restore failed:', err.message ?? err);
  }
}

// ─── Trial quota (5 reports total, never resets) ─────────────────────────────
// Trial usage is stored in usage_tracking with month_key = 'trial' so it
// reuses the existing table + RPC without any calendar-month reset logic.

const TRIAL_REPORT_LIMIT = 5;

/**
 * Checks how many of the 5 trial reports have been used.
 * Fails open — a transient DB error must not block report generation.
 */
export async function checkTrialQuota(
  supabaseAdmin: any,
  userId: string,
): Promise<QuotaCheckResult> {
  if (!supabaseAdmin) return { allowed: true, used: 0, limit: TRIAL_REPORT_LIMIT };
  try {
    const { data, error } = await supabaseAdmin
      .from('usage_tracking')
      .select('count')
      .eq('user_id', userId)
      .eq('report_type', 'standard')
      .eq('month_key', 'trial')
      .maybeSingle();
    if (error) throw error;
    const used = data?.count ?? 0;
    return { allowed: used < TRIAL_REPORT_LIMIT, used, limit: TRIAL_REPORT_LIMIT };
  } catch (err: any) {
    console.error('[UsageTracking] trial quota check failed, failing open:', err.message ?? err);
    return { allowed: true, used: 0, limit: TRIAL_REPORT_LIMIT };
  }
}

/**
 * Increments the trial usage counter (month_key='trial'). Never throws.
 */
export async function incrementTrialUsage(
  supabaseAdmin: any,
  userId: string,
): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    const { error } = await supabaseAdmin.rpc('increment_usage_tracking', {
      p_user_id:     userId,
      p_report_type: 'standard',
      p_month_key:   'trial',
    });
    if (error) throw error;
    console.log(`[UsageTracking] trial incremented user=${userId}`);
  } catch (err: any) {
    console.error('[UsageTracking] trial increment failed:', err.message ?? err);
  }
}
