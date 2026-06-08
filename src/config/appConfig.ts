/**
 * BizScope AI — Centralized Application Configuration
 * ═══════════════════════════════════════════════════
 *
 * Single source of truth for all environment-driven feature flags.
 * Import from this file instead of reading process.env / import.meta.env
 * inline, or calling isDemoModeActive() scattered across services.
 *
 * Quick usage:
 *   import { appConfig } from '../src/config/appConfig';
 *   if (appConfig.useMockGemini) { return mockReport; }
 *
 *   import { isDemoMode } from '../src/config/appConfig';
 *   {isDemoMode && <DemoBanner />}
 *
 * ┌─────────────────────────┬───────────────────┬──────────────────────────┐
 * │ Flag                    │ Demo Mode         │ Live Mode                │
 * ├─────────────────────────┼───────────────────┼──────────────────────────┤
 * │ isDemoMode              │ true              │ false                    │
 * │ useRealAuth             │ true*             │ true*                    │
 * │ useMockReports          │ true              │ false                    │
 * │ useMockGemini           │ true              │ false                    │
 * │ useMockStripe           │ true              │ false                    │
 * │ useMockUsageLimits      │ true              │ false                    │
 * │ useMockSavedReports     │ true              │ false                    │
 * │ enableDeveloperTools    │ true              │ false†                   │
 * └─────────────────────────┴───────────────────┴──────────────────────────┘
 *
 * *  useRealAuth depends only on Supabase env vars, not on isDemoMode.
 *    You can run Demo Mode with real Supabase auth — this is the intended
 *    local dev setup: real logins, mock AI + Stripe.
 *
 * †  enableDeveloperTools is also true at runtime for Admin-role users.
 *    Always combine with the runtime role check:
 *      isVisible={appConfig.enableDeveloperTools || isAdmin(user?.role ?? '')}
 */

// isSupabaseConfigured is parsed once from VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// by supabaseClient.ts. We import the derived boolean here rather than re-reading
// import.meta.env, keeping that environment read in one place.
import { isSupabaseConfigured } from '../../services/supabaseClient';

// ─── Raw environment reads ───────────────────────────────────────────────────
// VITE_DEMO_MODE is statically replaced at build time by vite.config.ts's
// define block (both in the Vite browser bundle and in the Express server).
//
// IMPORTANT: do NOT wrap this in `typeof process !== 'undefined'`.
// That guard defeats the static replacement: Vite replaces the token
// `process.env.VITE_DEMO_MODE` before runtime, but the ternary condition
// `typeof process !== 'undefined'` is evaluated at browser runtime where
// there is no `process` global — so the whole expression becomes `undefined`
// and demo mode silently turns off in production.
const _rawDemoMode: string | undefined = process.env.VITE_DEMO_MODE;

// ─── Derived booleans ────────────────────────────────────────────────────────

const _isDemoMode: boolean =
  _rawDemoMode === 'true' || (_rawDemoMode as unknown) === true || _rawDemoMode === '1';

// ─── App Config (frozen object — never mutate at runtime) ────────────────────

export const appConfig = {
  /**
   * Demo Mode is active (VITE_DEMO_MODE=true).
   *
   * Master switch for mock data and disabled external service calls.
   * Does NOT affect Supabase authentication — see useRealAuth.
   *
   * Enable:  VITE_DEMO_MODE=true  in .env.local
   * Disable: VITE_DEMO_MODE=false (or omit the key in production)
   */
  isDemoMode: _isDemoMode,

  /**
   * Real Supabase authentication is available.
   *
   * True  → VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are both set.
   *         Google OAuth, email/password, and session management use Supabase.
   * False → env vars are missing. Auth falls back to sessionStorage demo
   *         sessions created by AuthService.signInAsDemo(). Shown in AuthScreen
   *         as the "Use Demo Login" panel.
   *
   * Independent of isDemoMode. Typical local dev: useRealAuth=true + isDemoMode=true.
   */
  useRealAuth: isSupabaseConfigured,

  /**
   * Use mock report data (pre-seeded from src/data/mockReport.js).
   *
   * True  (Demo)  → generateViabilityReport() returns mockReport/mockRegionalReport.
   *                 No Gemini API call is made; no server cost.
   * False (Live)  → calls the Express backend route /api/generate-report which
   *                 invokes the real Gemini API with the server-side GEMINI_API_KEY.
   */
  useMockReports: _isDemoMode,

  /**
   * Use mock Gemini AI for all analysis functions.
   *
   * True  (Demo)  → generateViabilityReport, generateRegionalAnalysis,
   *                 generateMockRegionalData all return pre-seeded mock data.
   * False (Live)  → real Gemini API calls are made via the Express backend.
   *                 GEMINI_API_KEY must be set in .env.local (server-side only).
   */
  useMockGemini: _isDemoMode,

  /**
   * Use mock Stripe behavior — checkout and portal are no-ops.
   *
   * True  (Demo)  → StripeService.startCheckout() and openPortal() log a message
   *                 and return early. No real Stripe session is created.
   * False (Live)  → calls /api/stripe/create-checkout-session, redirects to
   *                 real Stripe-hosted checkout. STRIPE_SECRET_KEY must be set
   *                 server-side in .env.local (NEVER expose to the frontend).
   */
  useMockStripe: _isDemoMode,

  /**
   * Use mock usage limit tracking with developer overrides.
   *
   * True  (Demo)  → Usage resets are instant; a "Reset Quota" button is shown
   *                 in the Dashboard; limits can be bypassed for testing.
   * False (Live)  → Limits are read from localStorage / Supabase and enforced
   *                 without bypass UI. Reset cycles are time-based.
   */
  useMockUsageLimits: _isDemoMode,

  /**
   * Use mock saved reports from src/data/mockSavedReports.js.
   *
   * True  (Demo)  → Dashboard shows pre-seeded mock report history from
   *                 mockSavedReports.js, not real Supabase data.
   * False (Live)  → SavedReportsService reads/writes the Supabase `reports`
   *                 table using the authenticated user's session.
   */
  useMockSavedReports: _isDemoMode,

  /**
   * Show the DevAdminPanel and other developer/admin tools.
   *
   * Static (compile-time): true when isDemoMode is active.
   * Runtime: also true when the signed-in user has role = 'Admin' in Supabase.
   *
   * Always combine with the runtime role check at render time:
   *   isVisible={appConfig.enableDeveloperTools || isAdmin(user?.role ?? '')}
   *
   * The DevAdminPanel lets developers preview plan-gated features without
   * changing real subscription data. Admin users see it in production.
   */
  enableDeveloperTools: _isDemoMode,
  /**
   * Private-beta full-access override (VITE_BETA_FULL_ACCESS=true).
   *
   * When true, getEffectivePlan() returns 'Pro+' for every authenticated
   * non-Admin user, regardless of their stored subscription_tier or role.
   * Unauthenticated visitors are never affected.
   *
   * Toggle:    VITE_BETA_FULL_ACCESS=true  in Vercel env vars → redeploy
   * Kill switch: set to false (or remove) → redeploy; all users revert to
   *             their real stored plan automatically. No DB changes needed.
   *
   * This is a BUILD-TIME flag. Changing it requires a new Vercel deployment.
   */
  betaFullAccess: _betaFullAccess,
} as const;

// ─── Convenience named exports ───────────────────────────────────────────────
// Use these for single-flag checks to avoid destructuring appConfig everywhere.

/** True when VITE_DEMO_MODE=true. @see appConfig.isDemoMode */
export const isDemoMode: boolean = appConfig.isDemoMode;

/** True when Supabase env vars are present. @see appConfig.useRealAuth */
export const useRealAuth: boolean = appConfig.useRealAuth;

/**
 * True when VITE_BETA_FULL_ACCESS=true.
 *
 * Authenticated non-Admin users receive effective Pro+ access while this is set.
 * Unauthenticated visitors are never elevated. Admin users stay at Enterprise.
 * Set to false (or omit) at any time to revert all users to their real plan.
 *
 * @see appConfig.betaFullAccess
 */
export const betaFullAccess: boolean = appConfig.betaFullAccess;

// ─── Beta real-reports gate ──────────────────────────────────────────────────

// ─── Private-beta full-access flag ──────────────────────────────────────────
//
// VITE_BETA_FULL_ACCESS=true → every authenticated non-Admin user is resolved
// to effective Pro+ by getEffectivePlan(). Set to false (or omit) to revert
// everyone to their real stored plan without any manual DB changes.
//
// Statically replaced at build time (like VITE_DEMO_MODE). Never set this via
// import.meta.env at runtime — the vite.config.ts define block handles it.
const _betaFullAccess: boolean =
  process.env.VITE_BETA_FULL_ACCESS === 'true' ||
  (process.env.VITE_BETA_FULL_ACCESS as unknown) === true;

const _realReportsEnabled: boolean =
  process.env.VITE_REAL_REPORTS_ENABLED === 'true' ||
  (process.env.VITE_REAL_REPORTS_ENABLED as unknown) === true;

const _betaRoles: string[] = (process.env.VITE_BETA_ROLES ?? '')
  .split(',').map(r => r.trim()).filter(Boolean);

/**
 * True when VITE_REAL_REPORTS_ENABLED=true AND the given role is in VITE_BETA_ROLES.
 *
 * Used in geminiService to route beta users to real Gemini even when
 * VITE_DEMO_MODE=true. The server independently enforces its own role gate —
 * this is a frontend routing decision only.
 *
 * Initial deploy:  VITE_BETA_ROLES=Admin
 * Expand to beta:  VITE_BETA_ROLES=Admin,BetaTester  (no code change needed)
 * Kill switch:     VITE_REAL_REPORTS_ENABLED=false and redeploy
 */
export const isBetaRoleEnabled = (role: string): boolean =>
  _realReportsEnabled && _betaRoles.includes(role);
