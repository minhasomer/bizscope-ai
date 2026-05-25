/**
 * BizScope AI — Runtime Safety Guardrails
 * ════════════════════════════════════════
 *
 * Two responsibilities:
 *
 * 1. bootstrapGuardrails()
 *    Call once on app mount. Prints a structured console summary of every
 *    service mode (Auth / AI / Stripe / Usage) so the active configuration
 *    is immediately visible in DevTools without opening the source files.
 *    Also validates that the config flags are internally consistent and logs
 *    a clear error if a dangerous combination is detected (e.g. Live Mode
 *    active but no Supabase credentials).
 *
 * 2. assertLiveService(name) / assertDemoService(name)
 *    Hard runtime assertions used inside each service's critical code paths.
 *    These throw immediately if the call reaches a path that contradicts the
 *    current mode — catching bugs where a live API call somehow bypasses the
 *    appConfig.isDemoMode check. They are belt-and-suspenders: they should
 *    never fire in correct code, but they will loudly surface any regression.
 *
 * Import pattern (from a service file):
 *   import { assertLiveService } from '../src/lib/guardrails';
 *
 * Import pattern (from App.tsx):
 *   import { bootstrapGuardrails } from './src/lib/guardrails';
 */

import { appConfig } from '../config/appConfig';

// ─── Startup boot log ────────────────────────────────────────────────────────

/**
 * Log the active mode for every service to the browser console.
 * Call this exactly once, inside the App component's initialisation effect.
 *
 * Output is in a collapsed console group so it doesn't flood DevTools on
 * every page load — expand it when you need to inspect the configuration.
 */
export function bootstrapGuardrails(): void {
  const modeLabel = appConfig.isDemoMode ? '🟡 DEMO' : '🟢 LIVE';

  console.groupCollapsed(`[BizScope] ${modeLabel} Mode — service configuration`);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authMode = appConfig.useRealAuth
    ? 'Supabase (real auth — email/password + Google OAuth)'
    : 'Demo session  (no Supabase — sessionStorage only)';
  console.log(`  Auth         : ${authMode}`);

  // ── AI / Reports ──────────────────────────────────────────────────────────
  const reportMode = appConfig.useMockGemini
    ? 'Mock data     (pre-seeded demo reports — no Gemini API calls)'
    : 'Live Gemini   (via Express backend — GEMINI_API_KEY required server-side)';
  console.log(`  AI/Reports   : ${reportMode}`);

  // ── Stripe ────────────────────────────────────────────────────────────────
  const stripeMode = appConfig.useMockStripe
    ? 'Mock          (checkout is a no-op — no charges possible)'
    : 'Live Stripe   (real checkout sessions — STRIPE_SECRET_KEY required server-side)';
  console.log(`  Stripe       : ${stripeMode}`);

  // ── Usage limits ──────────────────────────────────────────────────────────
  const usageMode = appConfig.useMockUsageLimits
    ? 'Mock          (localStorage counters — reset button available)'
    : 'Real          (enforced per-plan limits — no bypass UI)';
  console.log(`  Usage limits : ${usageMode}`);

  // ── Saved reports ─────────────────────────────────────────────────────────
  const savedMode = appConfig.useMockSavedReports
    ? 'Mock seed     (mockSavedReports.js — no Supabase reads)'
    : 'Live Supabase (reports table — real user data)';
  console.log(`  Saved reports: ${savedMode}`);

  // ── Dev tools ─────────────────────────────────────────────────────────────
  const devToolsMode = appConfig.enableDeveloperTools
    ? 'Enabled for all users (Demo Mode is on)'
    : 'Admin-only    (hidden for regular users in production)';
  console.log(`  Dev tools    : ${devToolsMode}`);

  console.groupEnd();

  // ── Integrity checks ──────────────────────────────────────────────────────
  // These combinations are technically valid but dangerous — surface them loudly.

  if (!appConfig.isDemoMode && !appConfig.useRealAuth) {
    console.error(
      '[Guardrail] CRITICAL CONFIG: Live Mode is active but Supabase env vars ' +
      '(VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) are missing. ' +
      'Authentication will fail for all users. Set the vars or enable Demo Mode.',
    );
  }

  if (appConfig.isDemoMode && !appConfig.useMockGemini) {
    console.warn(
      '[Guardrail] CONFIG MISMATCH: isDemoMode=true but useMockGemini=false. ' +
      'These flags are derived from the same env var — this state should not occur.',
    );
  }

  if (!appConfig.isDemoMode && appConfig.useMockStripe) {
    console.warn(
      '[Guardrail] CONFIG MISMATCH: isDemoMode=false but useMockStripe=true. ' +
      'Stripe checkout is disabled in what appears to be a Live Mode environment.',
    );
  }
}

// ─── Hard assertions ─────────────────────────────────────────────────────────

/**
 * Assert that the current mode is LIVE (Demo Mode is OFF).
 *
 * Place this at the top of any code path that makes a real external API call
 * (Gemini via backend, Stripe checkout, etc.). If somehow this path is reached
 * while Demo Mode is active it means the appConfig.isDemoMode check above was
 * bypassed — throw immediately so the problem is caught in development.
 *
 * @param caller  Human-readable identifier for the calling code path, used in
 *                the error message. E.g. 'Gemini /api/analyze'.
 */
export function assertLiveService(caller: string): void {
  if (appConfig.isDemoMode) {
    const msg =
      `[Guardrail] BLOCKED — ${caller} must not be called in Demo Mode. ` +
      `This is a bug: the appConfig.isDemoMode guard above this call was bypassed. ` +
      `Set VITE_DEMO_MODE=false to enable live services, or ensure the guard is intact.`;
    console.error(msg);
    throw new Error(msg);
  }
}

/**
 * Assert that the current mode is DEMO (Demo Mode is ON).
 *
 * Place this at the top of operations that are only valid in Demo Mode
 * (e.g. the usage-reset dev button). Throws if called in Live Mode so the
 * operation is never accidentally applied against real data.
 *
 * @param caller  Human-readable identifier for the calling code path.
 */
export function assertDemoService(caller: string): void {
  if (!appConfig.isDemoMode) {
    const msg =
      `[Guardrail] BLOCKED — ${caller} is a Demo Mode only operation and must not ` +
      `run in Live Mode. This is a bug: set VITE_DEMO_MODE=true or remove this call.`;
    console.error(msg);
    throw new Error(msg);
  }
}
