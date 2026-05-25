import { PLAN_CAPABILITIES } from '../config/plans';

// ─── Plan types ────────────────────────────────────────────────────────────

/** UI-facing plan names used throughout the React layer. */
export type SubscriptionPlan = 'Explorer' | 'Pro' | 'Pro+' | 'Enterprise';

/**
 * Roles stored in the Supabase `profiles` table.
 * 'ProPlus' is the DB-safe form of 'Pro+'.
 * 'BetaTester' and 'Admin' are internal roles that grant elevated access.
 */
export type UserRole =
  | 'Explorer'
  | 'Pro'
  | 'ProPlus'
  | 'Enterprise'
  | 'BetaTester'
  | 'Admin';

// ─── Role helpers ──────────────────────────────────────────────────────────

export function isAdmin(role: string): boolean {
  return role === 'Admin';
}

/** BetaTester and Admin both receive Pro+ feature access. */
export function isBetaTester(role: string): boolean {
  return role === 'BetaTester' || role === 'Admin';
}

export function isPaidUser(plan: SubscriptionPlan): boolean {
  return plan === 'Pro' || plan === 'Pro+' || plan === 'Enterprise';
}

// ─── DB ↔ UI plan mapping ──────────────────────────────────────────────────

/**
 * Maps a raw `subscription_tier` string from the Supabase profiles table
 * to the SubscriptionPlan type used in the UI.
 *
 * Role-based overrides must be applied BEFORE calling this — see getEffectivePlan().
 */
export function dbTierToSubscriptionPlan(tier: string): SubscriptionPlan {
  switch (tier) {
    case 'Pro':        return 'Pro';
    case 'ProPlus':    return 'Pro+';
    case 'Enterprise': return 'Enterprise';
    default:           return 'Explorer';
  }
}

// ─── Effective plan resolution ─────────────────────────────────────────────

/**
 * Single source of truth for which plan drives feature access.
 *
 * Priority order:
 *   1. demoPlanOverride — pass the demo-switcher value when VITE_DEMO_MODE=true,
 *      null in live mode. This lets the sandbox UI test any plan tier without
 *      touching the real DB.
 *   2. Role-based grants — Admin unlocks Enterprise, BetaTester unlocks Pro+.
 *   3. subscription_tier from the Supabase profile row.
 *   4. 'Explorer' as the safe default when no profile is available.
 */
export function getEffectivePlan(
  profile: { role: string; subscription_tier: string } | null,
  demoPlanOverride: SubscriptionPlan | null,
): SubscriptionPlan {
  // Demo mode: the switcher wins unconditionally — this is UI-testing only.
  if (demoPlanOverride !== null) return demoPlanOverride;

  if (!profile) return 'Explorer';

  // Internal role grants — cannot be set by the user from the frontend.
  if (isAdmin(profile.role))      return 'Enterprise';
  if (isBetaTester(profile.role)) return 'Pro+';

  return dbTierToSubscriptionPlan(profile.subscription_tier);
}

// ─── Feature access checks ─────────────────────────────────────────────────
// All functions accept the resolved SubscriptionPlan (from getEffectivePlan).
// They are intentionally kept as pure functions — no side effects.
//
// Each function delegates to PLAN_CAPABILITIES (src/config/plans.ts) so that
// changing a plan's access requires only an edit to that central config.

export const canViewFullFinancials = (plan: SubscriptionPlan): boolean =>
  PLAN_CAPABILITIES[plan].canViewFullFinancials;

/** Alias used in newer code paths — same logic as canViewFullFinancials. */
export const canAccessFullReports = canViewFullFinancials;

export const canViewRegionalIntelligence = (plan: SubscriptionPlan): boolean =>
  PLAN_CAPABILITIES[plan].canViewRegionalIntelligence;

/** Alias used in newer code paths — same logic as canViewRegionalIntelligence. */
export const canAccessRegionalIntelligence = canViewRegionalIntelligence;

export const canExportPdf = (plan: SubscriptionPlan): boolean =>
  PLAN_CAPABILITIES[plan].canExportPdf;

export const canSaveReports = (plan: SubscriptionPlan): boolean =>
  PLAN_CAPABILITIES[plan].canSaveReports;

export const canCompareReports = (plan: SubscriptionPlan): boolean =>
  PLAN_CAPABILITIES[plan].canCompareReports;

// ─── Preview role → effective plan ────────────────────────────────────────
//
// Used exclusively by DevAdminPanel. Maps a preview role name to the
// SubscriptionPlan it grants for UI gating. This never touches the DB —
// it's an in-memory override for testing only.

export function previewRoleToEffectivePlan(role: string): SubscriptionPlan {
  switch (role) {
    case 'Admin':
    case 'Enterprise': return 'Enterprise';
    case 'BetaTester':
    case 'ProPlus':    return 'Pro+';
    case 'Pro':        return 'Pro';
    default:           return 'Explorer';
  }
}

// ─── Plan feature catalogue ────────────────────────────────────────────────
//
// DEPRECATED — PLAN_FEATURES and PlanFeature are superseded by
// getPlanFeatures() and PlanCardFeature in src/config/plans.ts.
// They were defined here but never imported anywhere in the codebase.
// Use getPlanFeatures(plan) from plans.ts for all new code.
