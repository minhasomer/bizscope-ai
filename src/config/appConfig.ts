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
// The only place in the codebase that touches process.env directly.
// VITE_DEMO_MODE is injected into process.env by vite.config.ts define block,
// so it works in both the Vite browser bundle and the Express server context
// without needing import.meta.env (which would add TS errors here).

const _rawDemoMode: string | undefined =
  typeof process !== 'undefined' ? process.env?.VITE_DEMO_MODE : undefined;

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
} as const;

// ─── Convenience named exports ───────────────────────────────────────────────
// Use these for single-flag checks to avoid destructuring appConfig everywhere.

/** True when VITE_DEMO_MODE=true. @see appConfig.isDemoMode */
export const isDemoMode: boolean = appConfig.isDemoMode;

/** True when Supabase env vars are present. @see appConfig.useRealAuth */
export const useRealAuth: boolean = appConfig.useRealAuth;
