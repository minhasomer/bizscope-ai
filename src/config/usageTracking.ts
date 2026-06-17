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
