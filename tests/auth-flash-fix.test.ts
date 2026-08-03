/**
 * Regression guard for the auth-resolving content flash fix.
 * Source-level assertions — no DOM/browser needed.
 *   npx tsx tests/auth-flash-fix.test.ts
 *
 * Prevents the homepage from briefly showing guest-mode content
 * ("1 free preview · no account needed", trial/create-account CTAs)
 * while Supabase is restoring a signed-in session on page refresh.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const heroSrc    = fs.readFileSync(path.join(repoRoot, 'components', 'Hero.tsx'), 'utf8');
const appSrc     = fs.readFileSync(path.join(repoRoot, 'App.tsx'), 'utf8');
const authSvcSrc = fs.readFileSync(path.join(repoRoot, 'services', 'authService.ts'), 'utf8');

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok   ${name}`);
}

// ── 1. Hero: authResolving prop is declared and defaulted safely ─────────────

check('Hero HeroProps declares authResolving as optional boolean', () => {
  assert.ok(
    heroSrc.includes('authResolving?: boolean'),
    'authResolving prop missing from HeroProps interface in Hero.tsx',
  );
});

check('Hero destructuring defaults authResolving to false', () => {
  assert.ok(
    heroSrc.includes('authResolving = false'),
    'authResolving default value missing — components without the prop would treat auth as always-resolving',
  );
});

// ── 2. During auth resolution, guest availability label is suppressed ────────

check('getPlanAccessLabel returns empty string when authResolving', () => {
  // The guard must appear before the guest-text line, not after.
  const guardIdx    = heroSrc.indexOf('if (authResolving) return \'\';');
  const guestIdx    = heroSrc.indexOf('1 free preview');
  assert.ok(guardIdx !== -1, 'authResolving early-return guard missing from getPlanAccessLabel');
  assert.ok(guestIdx !== -1, '"1 free preview" text must still exist for signed-out users');
  assert.ok(
    guardIdx < guestIdx,
    'authResolving guard must appear before the "1 free preview" branch so it fires first',
  );
});

check('"1 free preview · no account needed" text is still present for genuine signed-out state', () => {
  assert.ok(
    heroSrc.includes('1 free preview · no account needed'),
    'Guest availability label removed — signed-out users would lose their copy',
  );
});

// ── 3. App.tsx: subscriptionStatusLoaded is gated by !authLoading ────────────

check('App.tsx subscriptionStatusLoaded includes !authLoading guard', () => {
  assert.ok(
    appSrc.includes('!authLoading && (!currentUser || subscriptionStatus !== null)'),
    'subscriptionStatusLoaded must be false during auth loading to suppress guest CTA flash',
  );
});

check('App.tsx does not compute subscriptionStatusLoaded without authLoading check', () => {
  // The old formula (without the authLoading gate) must not coexist.
  const oldFormula = /subscriptionStatusLoaded\s*=\s*!currentUser\s*\|\|\s*subscriptionStatus\s*!==\s*null/;
  assert.ok(
    !oldFormula.test(appSrc),
    'Found the old subscriptionStatusLoaded formula without authLoading guard — the CTA flash fix is incomplete',
  );
});

// ── 4. App.tsx: authResolving is forwarded to Hero ────────────────────────────

check('App.tsx passes authResolving={authLoading} to Hero', () => {
  assert.ok(
    appSrc.includes('authResolving={authLoading}'),
    'authResolving prop not wired from App.tsx to Hero — guest flash suppression will not fire',
  );
});

// ── 5. No new full-page spinner on the home view ──────────────────────────────

check('App.tsx authLoading guard still exempts the home view from the full spinner', () => {
  // The spinner guard must still have the `activeView !== 'home'` exclusion.
  const spinnerGuard = /authLoading\s*&&\s*activeView\s*!==\s*['"]home['"]/;
  assert.ok(
    spinnerGuard.test(appSrc),
    'authLoading spinner guard no longer exempts home — homepage would be blocked behind a full spinner',
  );
});

// ── 6. No layout branching added to the home Hero render ─────────────────────

check('App.tsx home Hero render remains a single unified branch', () => {
  const authHeroBranch = /currentUser\s*\?\s*<Hero|currentUser\s*\?\s*\(\s*<Hero/;
  assert.ok(
    !authHeroBranch.test(appSrc),
    'Found auth-branched Hero render — home layout must stay unified',
  );
});

check('authResolving is not used to add a second Hero render', () => {
  const authResolvingBranch = /authResolving\s*\?\s*<Hero|authResolving\s*&&\s*<Hero/;
  assert.ok(
    !authResolvingBranch.test(heroSrc) && !authResolvingBranch.test(appSrc),
    'authResolving must not gate a second Hero render — it is a data prop only',
  );
});

// ── 7. Residual token-refresh flash: guard in subscription callback ──────────
//
// When Supabase fires SIGNED_OUT (or any transient null event) before a
// persisted session token has been removed from localStorage, the subscription
// callback must NOT prematurely set authLoading=false with currentUser=null.
// The existing 5 s safety timeout acts as the bounded fallback.

check('App.tsx subscription callback has hasPersistedSession guard for null user', () => {
  assert.ok(
    appSrc.includes('!user && AuthService.hasPersistedSession()'),
    'hasPersistedSession guard missing from subscription callback — a transient null will flash guest content',
  );
});

check('App.tsx guard returns early before any state mutation or setAuthLoading', () => {
  assert.ok(
    appSrc.includes('!user && AuthService.hasPersistedSession()) return;'),
    'guard must early-return without calling setAuthLoading or mutating auth state',
  );
});

check('App.tsx subscription guard is ordered before setAuthLoading(false)', () => {
  const guardIdx    = appSrc.indexOf('!user && AuthService.hasPersistedSession()');
  const loadingIdx  = appSrc.indexOf('setAuthLoading(false)', guardIdx);
  assert.ok(guardIdx   !== -1, 'hasPersistedSession guard not found in App.tsx');
  assert.ok(loadingIdx !== -1, 'setAuthLoading(false) not found after guard in App.tsx');
  assert.ok(guardIdx < loadingIdx, 'guard must precede setAuthLoading(false) in the callback');
});

check('authService propagates null to onUserChange only on SIGNED_OUT', () => {
  const signedOutIdx       = authSvcSrc.indexOf("event === 'SIGNED_OUT'");
  const onUserChangeNullIdx = authSvcSrc.indexOf('onUserChange(null)');
  assert.ok(signedOutIdx !== -1, "SIGNED_OUT branch missing from authService subscription handler");
  assert.ok(onUserChangeNullIdx !== -1, 'onUserChange(null) call missing from authService');
  assert.ok(
    signedOutIdx < onUserChangeNullIdx,
    'onUserChange(null) must reside inside the SIGNED_OUT branch, not at the top level',
  );
});

check('authService does not call onUserChange(null) for null INITIAL_SESSION', () => {
  // The second branch only fires onUserChange when session?.user is truthy.
  // Verify the condition guards the call: if null session, the branch is skipped.
  assert.ok(
    authSvcSrc.includes("session?.user &&"),
    'session?.user guard missing — onUserChange could fire with a user-less INITIAL_SESSION',
  );
  // Confirm that no bare onUserChange(null) exists outside the SIGNED_OUT block
  // by ensuring there is exactly one occurrence of onUserChange(null) in the file.
  const occurrences = authSvcSrc.split('onUserChange(null)').length - 1;
  assert.strictEqual(occurrences, 1, `onUserChange(null) should appear exactly once (inside SIGNED_OUT); found ${occurrences}`);
});

check('App.tsx 5-second safety timeout provides bounded fallback if subscription stalls', () => {
  assert.ok(
    appSrc.includes('loadingTimeout'),
    'loadingTimeout safety net missing — auth loading could stall indefinitely',
  );
  assert.ok(
    appSrc.includes('5000'),
    '5000 ms safety timeout value not found — bounded fallback may be absent',
  );
});

check('App.tsx sign-out cleanup path still intact after the null guard', () => {
  // The else branch must still exist for genuine SIGNED_OUT events where
  // hasPersistedSession() is false (session already cleared by Supabase).
  assert.ok(
    appSrc.includes('sessionStorage.removeItem(SIM_TOKEN_KEY)'),
    'Sign-out session cleanup removed — explicit sign-out would leave stale simulator state',
  );
  const navigateHomeIdx = appSrc.indexOf("navigate('home')");
  const guardIdx        = appSrc.indexOf('!user && AuthService.hasPersistedSession()');
  assert.ok(
    navigateHomeIdx !== -1 && guardIdx !== -1,
    "sign-out navigation or guard not found",
  );
  assert.ok(
    guardIdx < navigateHomeIdx,
    "guard must precede navigate('home') so it fires first and can skip the sign-out path",
  );
});

// ── Done ─────────────────────────────────────────────────────────────────────

console.log(`\n${passed} checks passed.`);
