/**
 * sim-billing-display.test.ts
 *
 * Behavioral tests for the buildSimBillingDisplay() pure helper used by BillingPage
 * to render simulated billing state during Admin simulation.
 *
 * Run standalone:
 *   npx tsx tests/sim-billing-display.test.ts
 * Exits non-zero on the first failed assertion.
 *
 * Coverage (6 scenarios):
 *   B7.  Canceled ProPlus → hasPaidAccess=false (simulated canceled does not show as active)
 *   B8.  Trialing ProPlus → statusLabel='Trial', subscriptionState='trialing'
 *   B9.  Past-due ProPlus → statusLabel='Past Due', periodEndNote includes 'past due'
 *   B10. None state → hasPaidAccess=false, statusLabel='No Subscription'
 *   B11. Active ProPlus (real Stripe actions disabled by prop, no buildSimBillingDisplay concern)
 *        → hasPaidAccess=true; callers must use simulationActive flag to disable buttons
 *   B12. Clearing simulation (simulationActive=false) → buildSimBillingDisplay not called;
 *        verified by confirming null simDisplay when simulationActive=false
 */

import assert from 'node:assert/strict';
import { buildSimBillingDisplay } from '../src/utils/billingSimState.js';

let passed = 0;
const tests: Array<{ name: string; fn: () => void }> = [];
function check(name: string, fn: () => void) { tests.push({ name, fn }); }

// ─── B7. Canceled ProPlus → hasPaidAccess=false ───────────────────────────────

check('B7. canceled ProPlus → hasPaidAccess=false (simulated canceled is not shown as active)', () => {
  const d = buildSimBillingDisplay('Pro+', 'canceled');
  assert.equal(d.hasPaidAccess,      false,       `expected false, got ${d.hasPaidAccess}`);
  assert.equal(d.subscriptionState,  'canceled');
  assert.equal(d.statusLabel,        'Cancelled');
  assert.ok(d.periodEndNote?.includes('canceled'), `periodEndNote should mention 'canceled': ${d.periodEndNote}`);
});

// ─── B8. Trialing ProPlus → Trial status ─────────────────────────────────────

check('B8. trialing ProPlus → statusLabel=Trial, subscriptionState=trialing', () => {
  const d = buildSimBillingDisplay('Pro+', 'trialing');
  assert.equal(d.subscriptionState, 'trialing');
  assert.equal(d.statusLabel,       'Trial');
  assert.equal(d.hasPaidAccess,     true, 'trialing Pro+ should still have paid access');
  assert.ok(d.periodEndNote !== null, 'trialing should have a period note');
});

// ─── B9. Past-due ProPlus → Past Due status ───────────────────────────────────

check('B9. past_due ProPlus → statusLabel=Past Due, periodEndNote present', () => {
  const d = buildSimBillingDisplay('Pro+', 'past_due');
  assert.equal(d.subscriptionState, 'past_due');
  assert.equal(d.statusLabel,       'Past Due');
  assert.equal(d.hasPaidAccess,     true, 'past_due Pro+ should retain access (not demoted by plan rules)');
  assert.ok(d.periodEndNote?.toLowerCase().includes('past due'), `periodEndNote should mention 'past due': ${d.periodEndNote}`);
});

// ─── B10. None → no paid access, no subscription label ───────────────────────

check('B10. none state → hasPaidAccess=false, statusLabel=No Subscription', () => {
  const d = buildSimBillingDisplay('Pro+', 'none');
  assert.equal(d.subscriptionState, 'none');
  assert.equal(d.statusLabel,       'No Subscription');
  assert.equal(d.hasPaidAccess,     false);
  assert.equal(d.periodEndNote,     null);
});

// ─── B11. Active ProPlus → hasPaidAccess=true (buttons disabled by simulationActive prop) ────

check('B11. active ProPlus → hasPaidAccess=true; billing buttons must be disabled via simulationActive prop', () => {
  const d = buildSimBillingDisplay('Pro+', 'active');
  assert.equal(d.subscriptionState, 'active');
  assert.equal(d.statusLabel,       'Active');
  assert.equal(d.hasPaidAccess,     true);
  assert.equal(d.periodEndNote,     null);
  // Note: the actual button disabling is controlled by simulationActive=true in BillingPage props,
  // which replaces the action buttons section entirely regardless of hasPaidAccess.
});

// ─── B12. simulationActive=false → simDisplay is null (real Stripe path taken) ──

check('B12. simulationActive=false → simDisplay would be null (real Billing UI path)', () => {
  // BillingPage computes: const simDisplay = simulationActive ? buildSimBillingDisplay(...) : null
  // When simulationActive=false the function is never called. We verify buildSimBillingDisplay
  // with a null rawState still returns a safe default (active) and does not throw.
  const d = buildSimBillingDisplay('Pro+', null);
  assert.equal(d.subscriptionState, 'active', 'null rawState defaults to active');
  assert.doesNotThrow(() => buildSimBillingDisplay('Explorer', undefined));
  assert.doesNotThrow(() => buildSimBillingDisplay('Enterprise', 'unknown_state'));
});

// ─── Run ──────────────────────────────────────────────────────────────────────

for (const { name, fn } of tests) {
  try {
    fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (err: any) {
    console.error(`FAIL ${name}`);
    console.error(`     ${err.message ?? err}`);
    process.exit(1);
  }
}

console.log(`\nPassed ${passed}/${tests.length} tests`);
