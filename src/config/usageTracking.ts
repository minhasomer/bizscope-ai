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
 * Checks the caller's standard-report quota for the current month.
 * report_type is always 'standard' here — analyze.ts and opportunities.ts
 * share the same monthly cap (PLAN_LIMITS.standardReportsPerCycle).
 *
 * Fails open (allows the request) if Supabase is unreachable or the query
 * errors, consistent with the rest of the app's logging/tracking paths —
 * a transient DB issue must not block report generation.
 */
export async function checkStandardQuota(
  supabaseAdmin: any,
  userId: string,
  plan: SubscriptionPlan,
  betaFullAccess: boolean,
): Promise<QuotaCheckResult> {
  const { standardReportsPerCycle } = getPlanLimits(plan);
  if (standardReportsPerCycle === null) {
    return { allowed: true, used: 0, limit: null };
  }
  if (!supabaseAdmin) {
    return { allowed: true, used: 0, limit: standardReportsPerCycle };
  }

  const monthKey = getCurrentMonthKey();
  const { data, error } = await supabaseAdmin
    .from('usage_tracking')
    .select('count')
    .eq('user_id', userId)
    .eq('report_type', 'standard')
    .eq('month_key', monthKey)
    .maybeSingle();

  if (error) {
    console.error('[UsageTracking] quota check failed, failing open:', error.message ?? error);
    return { allowed: true, used: 0, limit: standardReportsPerCycle };
  }

  const used = data?.count ?? 0;
  if (betaFullAccess) {
    return { allowed: true, used, limit: standardReportsPerCycle };
  }
  return { allowed: used < standardReportsPerCycle, used, limit: standardReportsPerCycle };
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
