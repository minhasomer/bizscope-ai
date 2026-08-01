/**
 * Stripe checkout regression tests — verifies the startCheckout() API change
 * and the App.tsx handleCheckout integration.
 *
 * These are structural source-level tests that verify ordering and presence of
 * key patterns without requiring a running server or Stripe credentials.
 * Run standalone: npx tsx tests/stripe-checkout.test.ts
 * Exits non-zero on the first failed assertion.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const stripeSource = fs.readFileSync(path.join(root, 'services/stripeService.ts'), 'utf8');
const appSource    = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  console.log(`  ✓ ${name}`);
  passed++;
}

// ─── stripeService.ts — return type ──────────────────────────────────────────

console.log('\nstripeService.ts — return type & guards');

// 1.
check('startCheckout() return type is Promise<{ url; trialEligible } | null>', () => {
  assert.ok(
    stripeSource.includes('Promise<{ url: string; trialEligible: boolean } | null>'),
    'Return type annotation not found in stripeService.ts',
  );
});

// 2.
check('startCheckout() returns null in demo mode', () => {
  assert.ok(stripeSource.includes('return null;'), 'null return not found in stripeService.ts');
});

// 3.
check('startCheckout() throws when data.url is absent', () => {
  assert.ok(
    stripeSource.includes("throw new Error('No checkout URL returned from server.')"),
    'Missing URL guard not found in stripeService.ts',
  );
});

// 4.
check('startCheckout() does not redirect internally (caller owns the redirect)', () => {
  // Isolate just the startCheckout method body.
  const methodStart = stripeSource.indexOf('static async startCheckout(');
  const methodEnd   = stripeSource.indexOf('\n  static ', methodStart + 1);
  const methodText  = stripeSource.slice(methodStart, methodEnd > 0 ? methodEnd : undefined);
  assert.ok(
    !methodText.includes('window.location.href'),
    'startCheckout() must NOT redirect internally — caller fires analytics then redirects',
  );
});

// ─── App.tsx — handleCheckout integration ────────────────────────────────────

console.log('\nApp.tsx — handleCheckout integration');

// 5.
check('plan_selected fires before startCheckout() is called', () => {
  const planSelected  = appSource.indexOf("trackEvent('plan_selected'");
  const startCheckout = appSource.indexOf('StripeService.startCheckout(plan)');
  assert.ok(planSelected  > 0, 'plan_selected event missing from App.tsx');
  assert.ok(startCheckout > 0, 'StripeService.startCheckout() call missing from App.tsx');
  assert.ok(planSelected < startCheckout, 'plan_selected must precede startCheckout() call');
});

// 6.
check('begin_checkout fires only after startCheckout() returns', () => {
  const startCheckout = appSource.indexOf('StripeService.startCheckout(plan)');
  const beginCheckout = appSource.indexOf("trackEvent('begin_checkout'");
  assert.ok(beginCheckout > 0, 'begin_checkout event missing from App.tsx');
  assert.ok(beginCheckout > startCheckout, 'begin_checkout must fire AFTER startCheckout() returns');
});

// 7.
check('null guard (demo mode) prevents redirect and analytics when result is null', () => {
  assert.ok(appSource.includes('if (!result) return;'), 'null result guard missing from App.tsx');
  const nullGuard     = appSource.indexOf('if (!result) return;');
  const beginCheckout = appSource.indexOf("trackEvent('begin_checkout'");
  assert.ok(nullGuard < beginCheckout, 'null guard must precede begin_checkout event');
});

// 8.
check('window.location.href = result.url executes after begin_checkout fires', () => {
  assert.ok(appSource.includes('window.location.href = result.url;'), 'redirect to result.url not found in App.tsx');
  const beginCheckout = appSource.indexOf("trackEvent('begin_checkout'");
  const redirect      = appSource.indexOf('window.location.href = result.url;');
  assert.ok(redirect > beginCheckout, 'redirect must follow begin_checkout event');
});

// 9.
check('plan_selected does not include email, user ID, or Stripe customer ID', () => {
  const idx   = appSource.indexOf("trackEvent('plan_selected'");
  const block = appSource.slice(idx, idx + 300);
  assert.ok(!block.includes('email'),                          'email found in plan_selected params');
  assert.ok(!block.includes('userId') && !block.includes('user_id'), 'user ID found in plan_selected params');
  assert.ok(!block.includes('customerId') && !block.includes('customer_id'), 'customer ID found in plan_selected params');
});

// 10.
check('trial eligibility comes from server-computed subscriptionStatus, not re-derived client-side', () => {
  assert.ok(
    appSource.includes('subscriptionStatus?.trialEligible'),
    'trialEligible must be read from subscriptionStatus (server-computed field)',
  );
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n✓ All ${passed} tests passed.\n`);
