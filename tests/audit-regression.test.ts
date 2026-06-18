/**
 * Regression tests for the June 17 Pre-Beta Audit fixes.
 *
 * No test runner is configured for this project, so these run standalone:
 *   npx tsx tests/audit-regression.test.ts
 * Exits non-zero on the first failed assertion.
 *
 * Covers the two highest-frequency audit defects, both pure functions:
 *   1. checkBlockedCategory false-positives via substring matching
 *      ("thc" inside "healthcare" blocked legitimate cards → "View Full
 *       Analysis" no-op + a stale cannabis warning).
 *   2. normalizeRangeSeparator currency/percentage range formatting
 *      ("$150,000 $350,000" rendered with no separator).
 */
import assert from 'node:assert/strict';
import { checkBlockedCategory } from '../src/utils/blockedCategories';
import { normalizeRangeSeparator } from '../src/utils/rangeFormat';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok   ${name}`);
}

// ── 1. Blocked-category word-boundary matching ────────────────────────────────

check('healthcare is NOT blocked (was: "thc" substring of "healthcare")', () => {
  assert.equal(checkBlockedCategory('Specialized Healthcare Staffing Agency').matched, false);
  assert.equal(checkBlockedCategory('Home Healthcare Services').matched, false);
});

check('unrelated businesses are not blocked by substring noise', () => {
  for (const biz of ['Coffee Shop', 'Physical Therapy Clinic', 'Ammonia Supplier', 'Botanical Garden', 'SaaS Startup']) {
    assert.equal(checkBlockedCategory(biz).matched, false, biz);
  }
});

check('genuinely blocked categories still match', () => {
  assert.equal(checkBlockedCategory('Cannabis Dispensary').matched, true);
  assert.equal(checkBlockedCategory('Open a THC edibles brand').matched, true); // standalone word
  assert.equal(checkBlockedCategory('Gun Shop').matched, true);
  assert.equal(checkBlockedCategory('Vape Store').matched, true);
  assert.equal(checkBlockedCategory('Delta-8 products').matched, true);
});

// ── 2. Range separator normalization ──────────────────────────────────────────

check('inserts en-dash separator for currency/percent ranges', () => {
  assert.equal(normalizeRangeSeparator('$150,000 $350,000'), '$150,000–$350,000');
  assert.equal(normalizeRangeSeparator('$150,000\n\n$350,000'), '$150,000–$350,000');
  assert.equal(normalizeRangeSeparator('$150,000-$350,000'), '$150,000–$350,000');
  assert.equal(normalizeRangeSeparator('15% 25%'), '15%–25%');
  assert.equal(normalizeRangeSeparator('2,500 5,000 sq ft'), '2,500–5,000 sq ft');
  assert.equal(normalizeRangeSeparator('$5,000 $10,000/month'), '$5,000–$10,000/month');
});

check('leaves single values and qualitative text untouched', () => {
  assert.equal(normalizeRangeSeparator('$200,000'), '$200,000');
  assert.equal(normalizeRangeSeparator('High (multi-million annual potential)'), 'High (multi-million annual potential)');
  assert.equal(normalizeRangeSeparator(''), '');
  assert.equal(normalizeRangeSeparator(undefined), '');
});

console.log(`\n${passed} test group(s) passed.`);
