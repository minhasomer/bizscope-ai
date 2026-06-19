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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkBlockedCategory } from '../src/utils/blockedCategories';
import { normalizeRangeSeparator } from '../src/utils/rangeFormat';
import { stripScoreReferences, viabilityScoreToAssessment } from '../src/utils/assessmentUtils';
import {
  estimateCost,
  aggregateGeminiUsage,
  GEMINI_MODELS,
  MODEL_PRICING,
  GROUNDING_CALL_COST_USD,
} from '../src/config/aiBudget';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

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

// ── 4. Authoritative cost accounting (aiBudget aggregateGeminiUsage) ──────────
// Guards the cost-accounting sprint invariants: grounding is billed, thinking
// tokens are folded into output exactly once, and every billable call (incl. a
// MAX_TOKENS retry attempt) is summed.

const STD = GEMINI_MODELS.standard;
const P = MODEL_PRICING[STD];
const closeTo = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`);

check('aggregateGeminiUsage bills grounding calls (C-1)', () => {
  const usages = [
    { promptTokenCount: 1000, candidatesTokenCount: 2000, thoughtsTokenCount: 500 },
    { promptTokenCount: 3000, candidatesTokenCount: 4000 },
  ];
  const withGrounding = aggregateGeminiUsage(STD, usages, 2);
  const noGrounding   = aggregateGeminiUsage(STD, usages, 0);
  assert.equal(withGrounding.inputTokens, 4000);
  assert.equal(withGrounding.outputTokens, 6500);   // (2000+500) + 4000, thinking folded in
  assert.equal(withGrounding.thinkingTokens, 500);
  assert.equal(withGrounding.groundingCalls, 2);
  // The whole point of C-1: grounding must change the persisted cost.
  closeTo(withGrounding.estimatedCostUsd - noGrounding.estimatedCostUsd, 2 * GROUNDING_CALL_COST_USD);
  closeTo(
    withGrounding.estimatedCostUsd,
    (4000 / 1000) * P.inputPer1kTokens + (6500 / 1000) * P.outputPer1kTokens + 2 * GROUNDING_CALL_COST_USD,
  );
});

check('thinking tokens folded into output exactly once (no double-count)', () => {
  const usage = { promptTokenCount: 1000, candidatesTokenCount: 1000, thoughtsTokenCount: 1000 };
  const agg = aggregateGeminiUsage(STD, [usage], 1);
  // Must equal the per-call primitive given candidates + thoughts passed separately.
  const direct = estimateCost(STD, 1000, 1000, 1, 1000);
  assert.equal(agg.outputTokens, 2000);
  closeTo(agg.estimatedCostUsd, direct.estimatedCostUsd);
});

check('MAX_TOKENS retry: both synthesis attempts are summed (C-3)', () => {
  const truncated = { promptTokenCount: 2000, candidatesTokenCount: 16000 }; // first attempt hit the ceiling
  const final     = { promptTokenCount: 2000, candidatesTokenCount: 8000 };  // retry
  const agg = aggregateGeminiUsage(STD, [truncated, final], 0);
  assert.equal(agg.inputTokens, 4000);
  assert.equal(agg.outputTokens, 24000); // 16000 + 8000 — truncated attempt is NOT dropped
});

check('null/failed-phase usage entries are skipped', () => {
  const usage = { promptTokenCount: 1000, candidatesTokenCount: 2000 };
  const withNulls = aggregateGeminiUsage(STD, [null, usage, undefined], 1);
  const without   = aggregateGeminiUsage(STD, [usage], 1);
  closeTo(withNulls.estimatedCostUsd, without.estimatedCostUsd);
  assert.equal(withNulls.inputTokens, 1000);
});

// ── Market Gap scoreless-UX regression (production incident, June 18) ─────────
// "View Full Analysis" on a Market Gap opportunity rendered raw model prose
// containing "...with an estimated market demand of 78 and a viability score
// of 72, this niche offers..." — stripScoreReferences was never wired into
// OpportunityExplorer.tsx, only into ReportDisplay.tsx.

check('stripScoreReferences cleans the exact Market Gap production leak', () => {
  const leaked = 'With an estimated market demand of 78 and a viability score of 72, this niche offers significant potential.';
  const cleaned = stripScoreReferences(leaked);
  assert.ok(!SCORE_LEAK.test(cleaned), `score leak survived cleaning: ${cleaned}`);
  assert.equal(cleaned, 'With an estimated market demand of 78 and an overall assessment, this niche offers significant potential.');
});

// Static source guard: every known AI-prose render site for these fields must
// route through stripScoreReferences(...). This is a regex source-scan, not a
// render test (no JSX runtime in this standalone script) — it exists to make
// "added a new raw {opportunity.executiveSummary} render" fail CI instead of
// silently shipping a leak the way the original regression did.
check('all known AI-prose render sites are wrapped in stripScoreReferences', () => {
  const targets: Array<{ file: string; fields: string[] }> = [
    {
      file: 'components/OpportunityExplorer.tsx',
      fields: [
        'opportunity.description', 'opportunity.whyItsGood', 'opportunity.executiveSummary',
        'opportunity.marketDemand.summary', 'opportunity.marketDemand.targetAudience',
        'opportunity.marketDemand.localMarketConditions', 'opportunity.competitiveLandscape.summary',
        'opportunity.competitiveLandscape.existingCompetitors', 'opportunity.revenueModel.summary',
        'opportunity.revenueModel.scalabilityPotential', 'opportunity.strategicRecommendation.rationale',
      ],
    },
    {
      file: 'components/ReportDisplay.tsx',
      fields: [
        'report.executiveSummary', 'report.competitionAnalysis.summary', 'report.marketTrends.summary',
        'report.demographicInsights.summary', 'regionalData.countyContext', 'regionalData.regionalRecommendation',
      ],
    },
    { file: 'components/ReportSummaryCard.tsx', fields: ['summary'] },
    {
      file: 'components/SavedReports.tsx',
      fields: ['rep.riskAssessment.summary', 'rep.competitionAnalysis.summary'],
    },
    {
      file: 'services/pdfService.ts',
      fields: ['report.demographicInsights.summary', 'report.riskAssessment.summary', 'report.competitionAnalysis.summary'],
    },
  ];

  for (const { file, fields } of targets) {
    const src = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    for (const field of fields) {
      const escaped = field.replace(/[.[\]]/g, '\\$&');
      // Require the field to appear at least once immediately preceded by
      // "stripScoreReferences(" (allowing for `cleanedSummary`/`summary` local
      // aliases is out of scope for this regex — those are checked by field
      // name on their own line in ReportSummaryCard above).
      const wrapped = new RegExp(`stripScoreReferences\\([^)]*\\b${escaped}\\b`);
      assert.ok(wrapped.test(src), `${file}: "${field}" does not appear wrapped in stripScoreReferences(...)`);
    }
  }
});

console.log(`\n${passed} test group(s) passed.`);
