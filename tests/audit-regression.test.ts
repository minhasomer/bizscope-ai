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
import { stripScoreReferences, viabilityScoreToAssessment } from '../src/utils/assessmentUtils';

/** Matches any user-visible numeric viability-score phrasing. */
const SCORE_LEAK = /\b\d{1,3}\s*\/\s*100\b|\b(?:viability\s+)?score\s+of\s+\d+\b|\b\d{1,3}\s+out\s+of\s+100\b|\brated\s+\d{2,3}\b/i;

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

// ── 3. Scoreless UX — numeric viability scores never appear in prose ──────────

check('stripScoreReferences removes numeric scores from prose', () => {
  const cases = [
    'This concept earns a strong viability score of 77 in our analysis.',
    'An overall score of 62/100 reflects a workable opportunity.',
    'The business scored 68 out of 100 on demand and competition.',
    'We rated 62 across the core factors.',
    'Reasoning: a viability score of 68 indicates caution is warranted.',
  ];
  for (const c of cases) {
    const out = stripScoreReferences(c);
    assert.ok(!SCORE_LEAK.test(out), `score leaked: ${JSON.stringify(out)}`);
    assert.ok(!/\b(77|62|68)\b/.test(out), `raw score number leaked: ${JSON.stringify(out)}`);
  }
});

check('stripScoreReferences preserves grammar', () => {
  assert.equal(
    stripScoreReferences('This concept earns a strong viability score of 77 overall.'),
    'This concept earns a strong overall assessment overall.',
  );
  // "a viability score of 68" must not leave the article "a overall"
  assert.equal(stripScoreReferences('Reasoning: a viability score of 68 here.'), 'Reasoning: an overall assessment here.');
});

check('stripScoreReferences stays sentiment-neutral on a low score', () => {
  const out = stripScoreReferences('It scored 30 out of 100.');
  assert.equal(out, 'It was assessed.');
  assert.ok(!/\b(excellent|great|strong|favorable|favourable|well)\b/i.test(out), `injected sentiment: ${out}`);
});

check('stripScoreReferences does NOT touch currency or percentages', () => {
  assert.equal(stripScoreReferences('Startup cost is $68,000 for the buildout.'), 'Startup cost is $68,000 for the buildout.');
  assert.equal(stripScoreReferences('Net margins land near 62% at scale.'), 'Net margins land near 62% at scale.');
  assert.equal(stripScoreReferences(''), '');
  assert.equal(stripScoreReferences(undefined), '');
});

check('qualitative assessment labels still render correctly', () => {
  assert.equal(viabilityScoreToAssessment(85).label, 'Strong Opportunity');
  assert.equal(viabilityScoreToAssessment(77).label, 'Attractive Market');
  assert.equal(viabilityScoreToAssessment(62).label, 'Worth Further Investigation');
  assert.equal(viabilityScoreToAssessment(30).label, 'Not Recommended');
  // labels carry no digits
  for (const s of [85, 77, 62, 55, 40, 20]) {
    assert.ok(!/\d/.test(viabilityScoreToAssessment(s).label), `label has digit at ${s}`);
  }
});

console.log(`\n${passed} test group(s) passed.`);
