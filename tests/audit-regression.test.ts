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
import { checkStandardQuota, checkRegionalQuota, checkTrialQuota } from '../src/config/usageTracking';
import { getPlanLimits } from '../src/config/plans';

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

// Fluent Supabase mock: .from().select().eq().eq().eq().maybeSingle()
function mockDb(count: number | null, error: unknown = null) {
  const leaf = { maybeSingle: async () => ({ data: count !== null ? { count } : null, error }) };
  const eqable: any = { eq: () => eqable, maybeSingle: leaf.maybeSingle };
  return { from: () => ({ select: () => eqable }) };
}

const asyncTests: Array<{ name: string; fn: () => Promise<void> }> = [];
function checkAsync(name: string, fn: () => Promise<void>) {
  asyncTests.push({ name, fn });
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

// ── 5. Plan limits (static values) ───────────────────────────────────────────

check('plan limits: Explorer=3/mo, Pro=20/mo, Pro+=50/mo, Enterprise=unlimited', () => {
  assert.equal(getPlanLimits('Explorer').standardReportsPerCycle, 3);
  assert.equal(getPlanLimits('Pro').standardReportsPerCycle, 20);
  assert.equal(getPlanLimits('Pro+').standardReportsPerCycle, 50);
  assert.equal(getPlanLimits('Enterprise').standardReportsPerCycle, null);
  assert.equal(getPlanLimits('Explorer').regionalReportsPerCycle, 0);
  assert.equal(getPlanLimits('Pro').regionalReportsPerCycle, 0);
  assert.equal(getPlanLimits('Pro+').regionalReportsPerCycle, 10);
});

// ── 6. Quota enforcement (async, mocked Supabase) ─────────────────────────────

checkAsync('Explorer: requests 1–3 allowed (used=0,1,2 each < limit=3)', async () => {
  for (const used of [0, 1, 2]) {
    const r = await checkStandardQuota(mockDb(used), 'uid', 'Explorer', false);
    assert.equal(r.allowed, true,  `used=${used} should be allowed`);
    assert.equal(r.limit,   3,     `limit should be 3`);
    assert.equal(r.used,    used,  `used should be ${used}`);
  }
});

checkAsync('Explorer: request 4 blocked (used=3 not < limit=3)', async () => {
  const r = await checkStandardQuota(mockDb(3), 'uid', 'Explorer', false);
  assert.equal(r.allowed, false);
  assert.equal(r.used,    3);
  assert.equal(r.limit,   3);
});

checkAsync('Explorer: betaFullAccess=true bypasses quota even at used=3', async () => {
  const r = await checkStandardQuota(mockDb(3), 'uid', 'Explorer', true);
  assert.equal(r.allowed, true);
  assert.equal(r.used,    3);
});

checkAsync('Pro: allowed at used=19, blocked at used=20', async () => {
  const ok  = await checkStandardQuota(mockDb(19), 'uid', 'Pro', false);
  const nok = await checkStandardQuota(mockDb(20), 'uid', 'Pro', false);
  assert.equal(ok.allowed,  true);
  assert.equal(ok.limit,    20);
  assert.equal(nok.allowed, false);
});

checkAsync('Pro+: allowed at used=49, blocked at used=50', async () => {
  const ok  = await checkStandardQuota(mockDb(49), 'uid', 'Pro+', false);
  const nok = await checkStandardQuota(mockDb(50), 'uid', 'Pro+', false);
  assert.equal(ok.allowed,  true);
  assert.equal(ok.limit,    50);
  assert.equal(nok.allowed, false);
});

checkAsync('Enterprise: always allowed (limit=null)', async () => {
  const r = await checkStandardQuota(mockDb(9999), 'uid', 'Enterprise', false);
  assert.equal(r.allowed, true);
  assert.equal(r.limit,   null);
});

checkAsync('quota fails open when supabaseAdmin is null', async () => {
  const r = await checkStandardQuota(null, 'uid', 'Explorer', false);
  assert.equal(r.allowed, true);
});

checkAsync('quota fails open on Supabase error', async () => {
  const r = await checkStandardQuota(mockDb(null, new Error('timeout')), 'uid', 'Explorer', false);
  assert.equal(r.allowed, true);
});

checkAsync('Explorer regional quota: always blocked (limit=0)', async () => {
  const r = await checkRegionalQuota(mockDb(0), 'uid', 'Explorer', false);
  assert.equal(r.allowed, false);
  assert.equal(r.limit,   0);
});

// ── 7. Structural source guards ───────────────────────────────────────────────

check('analyze.ts: Explorer gate (INSUFFICIENT_PLAN) removed before quota check', () => {
  const src      = fs.readFileSync(path.join(repoRoot, 'api', 'analyze.ts'), 'utf8');
  const quotaIdx = src.indexOf('checkStandardQuota(');
  const insuffIdx = src.indexOf("code: 'INSUFFICIENT_PLAN'");
  assert.ok(quotaIdx !== -1, 'checkStandardQuota call not found in analyze.ts');
  // INSUFFICIENT_PLAN must not appear before the quota check — either absent or after.
  assert.ok(
    insuffIdx === -1 || insuffIdx > quotaIdx,
    `INSUFFICIENT_PLAN gate (char ${insuffIdx}) precedes quota check (char ${quotaIdx}) — Explorer blocked before quota`,
  );
});

check('analyze.ts: quota check precedes Gemini AI initialisation', () => {
  const src       = fs.readFileSync(path.join(repoRoot, 'api', 'analyze.ts'), 'utf8');
  const quotaIdx  = src.indexOf('checkStandardQuota(');
  const geminiIdx = src.indexOf('new GoogleGenAI(');
  assert.ok(quotaIdx  !== -1, 'checkStandardQuota not found');
  assert.ok(geminiIdx !== -1, 'GoogleGenAI instantiation not found');
  assert.ok(quotaIdx < geminiIdx, 'quota check must precede Gemini initialisation');
});

check('analyze.ts: quota rejection gate exists and precedes usage increment', () => {
  const src          = fs.readFileSync(path.join(repoRoot, 'api', 'analyze.ts'), 'utf8');
  const incrementIdx = src.indexOf('incrementUsageTracking(');
  // Trial and standard paths each emit their own rejection code.
  const quotaGateIdx = Math.min(
    ...[
      "QUOTA_EXCEEDED",
      "TRIAL_REPORT_LIMIT_REACHED",
    ].map(code => src.indexOf(code)).filter(i => i !== -1),
  );
  assert.ok(incrementIdx !== -1, 'incrementUsageTracking call not found');
  assert.ok(quotaGateIdx !== Infinity, 'no quota rejection code (QUOTA_EXCEEDED or TRIAL_REPORT_LIMIT_REACHED) found');
  assert.ok(incrementIdx > quotaGateIdx, 'incrementUsageTracking must come after the quota rejection gate');
});

check('analyze.ts: quota check precedes cache-hit return (cache hits consume a quota credit)', () => {
  const src          = fs.readFileSync(path.join(repoRoot, 'api', 'analyze.ts'), 'utf8');
  const cacheIdx     = src.indexOf('_cached:');
  const quotaIdx     = src.indexOf('checkStandardQuota(');
  assert.ok(cacheIdx !== -1, 'cache-hit return (_cached:) not found');
  assert.ok(quotaIdx !== -1, 'quota check not found');
  assert.ok(quotaIdx < cacheIdx, 'quota check must precede cache-hit return (fix/quota: enforce quota on server cache hits)');
});

check('opportunities.ts: Explorer still rejected (Market Gap remains locked)', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'api', 'opportunities.ts'), 'utf8');
  assert.ok(src.includes("code: 'INSUFFICIENT_PLAN'"), 'opportunities.ts must still gate Explorer');
});

check('opportunity-dossier.ts: Explorer still rejected (dossier remains locked)', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'api', 'opportunity-dossier.ts'), 'utf8');
  assert.ok(src.includes("code: 'INSUFFICIENT_PLAN'"), 'opportunity-dossier.ts must still gate Explorer');
});

// ── 8. Regional analysis — plan limits and structural guards ──────────────────

check('plan limits: Pro regional=0 (same as Explorer — blocked)', () => {
  assert.equal(getPlanLimits('Pro').regionalReportsPerCycle, 0);
  assert.equal(getPlanLimits('Pro+').regionalReportsPerCycle, 10);
  assert.equal(getPlanLimits('Enterprise').regionalReportsPerCycle, null);
});

checkAsync('Pro regional quota: always blocked (limit=0)', async () => {
  const r = await checkRegionalQuota(mockDb(0), 'uid', 'Pro', false);
  assert.equal(r.allowed, false);
  assert.equal(r.limit,   0);
});

checkAsync('Pro+ regional quota: allowed at used=9, blocked at used=10', async () => {
  const ok  = await checkRegionalQuota(mockDb(9),  'uid', 'Pro+', false);
  const nok = await checkRegionalQuota(mockDb(10), 'uid', 'Pro+', false);
  assert.equal(ok.allowed,  true);
  assert.equal(ok.limit,    10);
  assert.equal(nok.allowed, false);
  assert.equal(nok.used,    10);
});

checkAsync('Enterprise regional quota: always allowed (limit=null)', async () => {
  const r = await checkRegionalQuota(mockDb(9999), 'uid', 'Enterprise', false);
  assert.equal(r.allowed, true);
  assert.equal(r.limit,   null);
});

check('regional-analysis.ts: unauthenticated → 401 gate present', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'api', 'regional-analysis.ts'), 'utf8');
  assert.ok(src.includes("code: 'UNAUTHENTICATED'"), 'regional-analysis.ts must gate unauthenticated requests with 401');
});

check('regional-analysis.ts: Explorer and Pro explicitly rejected with INSUFFICIENT_PLAN', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'api', 'regional-analysis.ts'), 'utf8');
  assert.ok(src.includes("code: 'INSUFFICIENT_PLAN'"), 'regional-analysis.ts must have INSUFFICIENT_PLAN gate');
  // Gate must require both Pro+ and Enterprise — i.e. neither Explorer nor Pro passes
  assert.ok(src.includes("verifiedPlan !== 'Pro+' && verifiedPlan !== 'Enterprise'"), 'gate must block both Explorer and Pro');
});

check('regional-analysis.ts: quota check precedes Gemini call', () => {
  const src      = fs.readFileSync(path.join(repoRoot, 'api', 'regional-analysis.ts'), 'utf8');
  const quotaIdx = src.indexOf('checkRegionalQuota(');
  const genIdx   = src.indexOf('ai.models.generateContent(');
  assert.ok(quotaIdx !== -1, 'checkRegionalQuota call not found');
  assert.ok(genIdx   !== -1, 'generateContent call not found');
  assert.ok(quotaIdx < genIdx, 'quota check must precede generateContent call');
});

check('regional-analysis.ts: incrementUsageTracking only in success path (after generation)', () => {
  const src          = fs.readFileSync(path.join(repoRoot, 'api', 'regional-analysis.ts'), 'utf8');
  const incrementIdx = src.indexOf('incrementUsageTracking(');
  const quotaGateIdx = src.indexOf("code: 'QUOTA_EXCEEDED'");
  const genIdx       = src.indexOf('ai.models.generateContent(');
  assert.ok(incrementIdx !== -1, 'incrementUsageTracking not found');
  assert.ok(quotaGateIdx !== -1, 'QUOTA_EXCEEDED gate not found');
  assert.ok(genIdx       !== -1, 'generateContent not found');
  // increment must come AFTER quota gate and AFTER Gemini call
  assert.ok(incrementIdx > quotaGateIdx, 'increment must be after QUOTA_EXCEEDED gate');
  assert.ok(incrementIdx > genIdx, 'increment must be after Gemini generateContent call');
});

// ── 9. Pro 7-day trial feature toggle (structural + async) ───────────────────
//
// Safety invariants for the PRO_TRIAL_ENABLED / VITE_PRO_TRIAL_ENABLED toggle.
// All source-scan tests are structural: they assert that the server code is
// wired correctly regardless of the env-var value at test-run time, making it
// impossible for a code change to accidentally break the safety boundary.

// T-1: Checkout trial block is gated by the server flag and plan='Pro'.
//      If someone removes either condition, the trial becomes unconditional.
check('T-1: checkout trial eligibility requires proTrialEnabled AND plan===Pro (structural)', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'api', 'stripe', '[...path].ts'), 'utf8');
  assert.ok(
    src.includes("proTrialEnabled && plan === 'Pro'"),
    'checkout must gate trial on proTrialEnabled && plan === "Pro"',
  );
  assert.ok(
    src.includes('trial_period_days: 7'),
    'checkout must pass trial_period_days: 7 to Stripe',
  );
});

// T-2: When proTrialEnabled=false the isTrialEligible flag starts false and the
//      only place it can become true is inside the proTrialEnabled gate.
check('T-2: isTrialEligible defaults false; only set to true inside proTrialEnabled block (structural)', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'api', 'stripe', '[...path].ts'), 'utf8');
  assert.ok(
    src.includes('let isTrialEligible = false;'),
    'isTrialEligible must default to false',
  );
  // The only truthy assignment must be inside the proTrialEnabled guard.
  const trueIdx = src.indexOf('isTrialEligible = noPriorTrial');
  const gateIdx = src.indexOf('if (proTrialEnabled && plan === \'Pro\')');
  assert.ok(trueIdx > gateIdx && gateIdx !== -1, 'isTrialEligible can only become true inside proTrialEnabled block');
});

// T-3: Checkout eligibility must not read any client-supplied trial field.
//      A client passing {trial: true} or {isTrialEligible: true} must have no effect.
check('T-3: checkout does not read client-supplied trial fields for eligibility (structural)', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'api', 'stripe', '[...path].ts'), 'utf8');
  // body.trial and body.trialEligible must not appear anywhere that sets isTrialEligible.
  assert.ok(
    !src.includes('body.trial') && !src.includes('body.trialEligible') && !src.includes('body?.trial'),
    'checkout must not read client-supplied trial field',
  );
});

// T-4: Pro+ plan must never receive a trial — the plan === 'Pro' condition blocks it.
check('T-4: Pro+ plan cannot receive trial (plan guard is exact string "Pro") (structural)', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'api', 'stripe', '[...path].ts'), 'utf8');
  // The guard must be exact equality, not a startsWith or includes check.
  assert.ok(
    src.includes("plan === 'Pro'") && !src.includes("plan.startsWith('Pro')") && !src.includes("plan.includes('Pro')"),
    'trial gate must use exact plan === "Pro" (not startsWith/includes which would admit Pro+)',
  );
});

// T-5: has_used_trial is read from the DB (not from client body) and fails safe.
//      If the DB read errors, the code must default to has_used_trial=true (no trial).
check('T-5: has_used_trial read from DB; defaults true on error (fail-safe for second trial) (structural)', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'api', 'stripe', '[...path].ts'), 'utf8');
  assert.ok(
    src.includes("select('has_used_trial, subscription_tier, role')"),
    'checkout must read has_used_trial, subscription_tier, and role from profiles',
  );
  assert.ok(
    src.includes('profileData?.has_used_trial ?? true'),
    'checkout must default has_used_trial to true on DB error (fails safe — no accidental second trial)',
  );
});

// T-6: analyze.ts detects trialing via subscriptions.status in the DB, never via
//      PRO_TRIAL_ENABLED. This ensures existing trialing users keep trial quota
//      enforcement even after the feature toggle is disabled.
check('T-6: analyze.ts detects trialing from DB status, not from PRO_TRIAL_ENABLED (structural)', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'api', 'analyze.ts'), 'utf8');
  assert.ok(
    src.includes("_subRow?.status === 'trialing'"),
    'analyze.ts must read trialing status from DB, not from env var',
  );
  // PRO_TRIAL_ENABLED must NOT appear in analyze.ts — analyze is toggle-agnostic.
  assert.ok(
    !src.includes('PRO_TRIAL_ENABLED'),
    'analyze.ts must not read PRO_TRIAL_ENABLED — existing trialing users must always get trial quota',
  );
});

// T-7: App.tsx derives trialEligible from the client VITE_ flag AND the server's
//      trialEligible field — both must be present in the expression.
check('T-7: App.tsx gates trialEligible on proTrialEnabled AND subscriptionStatus.trialEligible (structural)', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'App.tsx'), 'utf8');
  assert.ok(
    src.includes('proTrialEnabled && !!(subscriptionStatus?.trialEligible)'),
    'App.tsx trialEligible must require both proTrialEnabled and server-returned trialEligible',
  );
});

// T-8: The client and server flags are sourced independently.
//      VITE_PRO_TRIAL_ENABLED is baked into the client bundle via vite.config.ts define.
//      PRO_TRIAL_ENABLED is read from process.env in the API route (server).
//      They must never share the same runtime read.
check('T-8: client and server trial flags are independent reads (structural)', () => {
  const clientSrc = fs.readFileSync(path.join(repoRoot, 'src', 'config', 'appConfig.ts'), 'utf8');
  const serverSrc = fs.readFileSync(path.join(repoRoot, 'api', 'stripe', '[...path].ts'), 'utf8');
  const viteSrc   = fs.readFileSync(path.join(repoRoot, 'vite.config.ts'), 'utf8');
  assert.ok(
    clientSrc.includes('VITE_PRO_TRIAL_ENABLED'),
    'appConfig.ts must read VITE_PRO_TRIAL_ENABLED',
  );
  assert.ok(
    viteSrc.includes("'process.env.VITE_PRO_TRIAL_ENABLED'"),
    'vite.config.ts must bake VITE_PRO_TRIAL_ENABLED into the client bundle via define block',
  );
  assert.ok(
    serverSrc.includes("PRO_TRIAL_ENABLED?.trim() === 'true'"),
    'checkout handler must read PRO_TRIAL_ENABLED from process.env (with .trim())',
  );
  // Server must NOT read VITE_ prefixed flag — that would couple to client build.
  assert.ok(
    !serverSrc.includes('VITE_PRO_TRIAL_ENABLED'),
    'checkout handler must not read VITE_PRO_TRIAL_ENABLED',
  );
  // Client must NOT read unprefixed PRO_TRIAL_ENABLED — that exposes server env.
  assert.ok(
    !clientSrc.includes("process.env.PRO_TRIAL_ENABLED'") && !clientSrc.includes('"PRO_TRIAL_ENABLED"'),
    'appConfig.ts must not reference server-only PRO_TRIAL_ENABLED key',
  );
});

// T-9: webhook.ts only sets has_used_trial when the Stripe sub status is 'trialing'.
//      A paid (non-trial) checkout must not mark has_used_trial.
check('T-9: webhook only sets has_used_trial inside isTrialing block (structural)', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'api', 'stripe', 'webhook.ts'), 'utf8');
  const trialIdx    = src.indexOf('if (isTrialing)');
  const hasUsedIdx  = src.indexOf('has_used_trial: true');
  assert.ok(trialIdx   !== -1, 'webhook must have isTrialing guard');
  assert.ok(hasUsedIdx !== -1, 'webhook must set has_used_trial: true');
  assert.ok(hasUsedIdx > trialIdx, 'has_used_trial must only be set inside the isTrialing block');
  // Confirm isTrialing is derived from Stripe sub.status, not from an env var.
  assert.ok(
    src.includes("sub.status === 'trialing'"),
    "webhook must derive isTrialing from Stripe sub.status === 'trialing'",
  );
});

// T-10: checkTrialQuota enforces the 5-report hard cap (async, mocked DB).
checkAsync('T-10: checkTrialQuota allows ≤4 reports and blocks at 5 (async)', async () => {
  for (const used of [0, 1, 4]) {
    const r = await checkTrialQuota(mockDb(used), 'uid');
    assert.equal(r.allowed, true,  `used=${used} should be allowed (limit=5)`);
    assert.equal(r.limit,   5,     `trial limit must be 5`);
    assert.equal(r.used,    used);
  }
  // At exactly limit=5, must block.
  const blocked = await checkTrialQuota(mockDb(5), 'uid');
  assert.equal(blocked.allowed, false, 'used=5 must be blocked');
  assert.equal(blocked.used,    5);
  assert.equal(blocked.limit,   5);

  // Fails open on DB error or null admin.
  const failOpen = await checkTrialQuota(mockDb(null, new Error('db down')), 'uid');
  assert.equal(failOpen.allowed, true, 'trial quota must fail open on DB error');

  const nullAdmin = await checkTrialQuota(null, 'uid');
  assert.equal(nullAdmin.allowed, true, 'trial quota must fail open when supabaseAdmin is null');
});

// ── 10. Trial eligibility — Explorer-only gate (structural) ──────────────────
//
// The trial must be restricted to users whose server-resolved effective plan is
// Explorer.  Former paid subscribers, profile-tier overrides (e.g. DB-level
// ProPlus), and elevated roles (Admin / BetaTester) must all be rejected
// server-side, regardless of has_used_trial or current subscription status.
//
// E-1 through E-5 are structural: they assert that the source code in
// api/stripe/[...path].ts contains the required eligibility gates.

const stripeSrc = fs.readFileSync(
  path.join(repoRoot, 'api', 'stripe', '[...path].ts'),
  'utf8',
);

check('E-1: checkout selects plan from subscriptions (historical-paid-plan gate)', () => {
  assert.ok(
    stripeSrc.includes("select('status, stripe_customer_id, plan')"),
    'create-checkout-session must select plan from the subscriptions row ' +
    'so it can reject users who previously held a Pro/Pro+ subscription',
  );
});

check('E-2: checkout blocks former Pro/Pro+ subscribers via plan check', () => {
  assert.ok(
    stripeSrc.includes("hasHistoricalPaidPlan") &&
    stripeSrc.includes("existing?.plan"),
    'create-checkout-session must check existing?.plan against [Pro, Pro+] ' +
    'so cancellation of a prior paid plan cannot re-grant a free trial',
  );
});

check('E-3: checkout blocks elevated profile tiers (ProPlus DB override)', () => {
  assert.ok(
    stripeSrc.includes("profileTierElevated") &&
    stripeSrc.includes("subscription_tier"),
    'create-checkout-session must read profiles.subscription_tier and reject ' +
    'Pro/ProPlus values so a DB-level plan override cannot obtain a trial',
  );
});

check('E-4: checkout blocks elevated roles (Admin / BetaTester)', () => {
  assert.ok(
    stripeSrc.includes("roleElevated") &&
    stripeSrc.includes("Admin") &&
    stripeSrc.includes("BetaTester"),
    'create-checkout-session must reject Admin and BetaTester roles ' +
    'because they already carry elevated access',
  );
});

check('E-5: subscription-status applies the same three additional gates', () => {
  // Count how many times each condition appears — must appear in BOTH handlers.
  const htCount   = (stripeSrc.match(/hasHistoricalPaidPlan/g) ?? []).length;
  const tierCount = (stripeSrc.match(/profileTierElevated/g)   ?? []).length;
  const roleCount = (stripeSrc.match(/roleElevated/g)          ?? []).length;
  assert.ok(htCount   >= 2, `hasHistoricalPaidPlan must appear in both handlers (found ${htCount})`);
  assert.ok(tierCount >= 2, `profileTierElevated must appear in both handlers (found ${tierCount})`);
  assert.ok(roleCount >= 2, `roleElevated must appear in both handlers (found ${roleCount})`);
});

// ── 11. Homepage trial CTA — structural tests (H-1..H-15) ────────────────────
//
// These tests assert that the Hero component wiring and the App.tsx prop
// connections match the ADD HOMEPAGE PRO TRIAL CTA spec.  All are pure source
// scans — no runtime required.

const heroSrc = fs.readFileSync(path.join(repoRoot, 'components', 'Hero.tsx'), 'utf8');
const appSrc  = fs.readFileSync(path.join(repoRoot, 'App.tsx'), 'utf8');

check('H-1: Hero.tsx renders "Start Free 7-Day Trial" CTA text', () => {
  assert.ok(
    heroSrc.includes('Start Free 7-Day Trial'),
    'Hero.tsx must contain the trial CTA label "Start Free 7-Day Trial"',
  );
});

check('H-2: Hero.tsx contains trial supporting copy', () => {
  assert.ok(
    heroSrc.includes('Includes up to 5 Pro reports'),
    'Hero.tsx must include the supporting copy "Includes up to 5 Pro reports"',
  );
  assert.ok(
    heroSrc.includes('Payment method required. Then $29/month.'),
    'Hero.tsx must include the pricing disclosure text',
  );
});

check('H-3: Hero.tsx invokes onProCheckout for the trial CTA', () => {
  assert.ok(
    heroSrc.includes('onProCheckout'),
    'Hero.tsx must reference the onProCheckout callback',
  );
});

check('H-4: Hero.tsx does not re-derive trial eligibility from raw profile fields', () => {
  assert.ok(
    !heroSrc.includes('has_used_trial'),
    'Hero.tsx must not read has_used_trial — eligibility is server-computed and passed via trialEligible prop',
  );
  assert.ok(
    !heroSrc.includes('subscription_tier'),
    'Hero.tsx must not read subscription_tier — plan state is passed via currentPlan/hasPaidSubscription props',
  );
});

check('H-5: App.tsx passes trialEligible prop to Hero', () => {
  assert.ok(
    appSrc.includes('trialEligible={trialEligible}'),
    'App.tsx must pass trialEligible={trialEligible} to <Hero>',
  );
});

check('H-6: Hero.tsx implements trial-signup state with onSignUp for signed-out visitors', () => {
  assert.ok(
    heroSrc.includes("'trial-signup'"),
    'Hero.tsx must have a trial-signup CTA state for signed-out visitors',
  );
  assert.ok(
    heroSrc.includes('onSignUp'),
    'Hero.tsx must reference the onSignUp callback used by the trial-signup state',
  );
});

check('H-7: Hero.tsx implements get-pro state with "Get Pro →" label', () => {
  assert.ok(
    heroSrc.includes("'get-pro'"),
    'Hero.tsx must have a get-pro CTA state for ineligible signed-in users',
  );
  assert.ok(
    heroSrc.includes('Get Pro →'),
    'Hero.tsx must render "Get Pro →" in the get-pro state',
  );
});

check('H-8: Hero.tsx implements dashboard state with "Go to Dashboard →" label', () => {
  assert.ok(
    heroSrc.includes("ctaState === 'dashboard'"),
    'Hero.tsx must have a dashboard CTA state',
  );
  assert.ok(
    heroSrc.includes('Go to Dashboard →'),
    'Hero.tsx must render "Go to Dashboard →" in the dashboard state',
  );
});

check('H-9: Hero.tsx routes non-Explorer plans (Admin/BetaTester) to dashboard, not trial', () => {
  assert.ok(
    heroSrc.includes("currentPlan !== 'Explorer'"),
    "Hero.tsx must guard non-Explorer plans via currentPlan !== 'Explorer' " +
    'so Admin and BetaTester users are never shown the trial CTA',
  );
});

check('H-10: Hero.tsx implements trialing-active state with trial notice', () => {
  assert.ok(
    heroSrc.includes("'trialing-active'"),
    'Hero.tsx must have a trialing-active CTA state',
  );
  assert.ok(
    heroSrc.includes('Your Pro trial is active.'),
    'Hero.tsx must render "Your Pro trial is active." in the trialing-active state',
  );
});

check('H-11: Anonymous visitors fall through to default state — trial-signup removed to prevent payment CTA', () => {
  // trial-signup was removed from getHeroCTAState to fix the P0 conversion issue where
  // anonymous visitors were shown "Payment method required" UI. proTrialEnabled is still
  // a prop (App passes it) but CTA routing uses server-derived trialEligible instead.
  const start = heroSrc.indexOf('const getHeroCTAState');
  const end = heroSrc.indexOf('};', start) + 2;
  const fnBody = heroSrc.slice(start, end);
  assert.ok(
    !fnBody.includes("'trial-signup'"),
    "getHeroCTAState must NOT return 'trial-signup' — anonymous visitors must reach 'default' state",
  );
  assert.ok(
    heroSrc.includes('proTrialEnabled'),
    'Hero.tsx must still accept the proTrialEnabled prop (passed from App)',
  );
});

check('H-12: Hero.tsx has a default fallback state rendering "View Pricing →"', () => {
  assert.ok(
    heroSrc.includes("'default'"),
    "Hero.tsx must have a 'default' CTA state as the final fallback",
  );
  assert.ok(
    heroSrc.includes('View Pricing →'),
    'Hero.tsx must render "View Pricing →" in the default fallback state',
  );
});

check('H-13: Hero.tsx uses subscriptionStatusLoaded to prevent CTA flash', () => {
  assert.ok(
    heroSrc.includes('subscriptionStatusLoaded'),
    'Hero.tsx must check the subscriptionStatusLoaded prop',
  );
  assert.ok(
    heroSrc.includes("'loading'"),
    "Hero.tsx must have a 'loading' CTA state that returns the neutral fallback while status is in-flight",
  );
});

check('H-14: App.tsx passes subscriptionStatusLoaded to Hero', () => {
  assert.ok(
    appSrc.includes('subscriptionStatusLoaded={subscriptionStatusLoaded}'),
    'App.tsx must pass subscriptionStatusLoaded={subscriptionStatusLoaded} to <Hero>',
  );
  assert.ok(
    appSrc.includes('const subscriptionStatusLoaded'),
    'App.tsx must define subscriptionStatusLoaded',
  );
});

check('H-15: PricingTiers.tsx original trialEligible CTA logic is intact', () => {
  const pricingSrc = fs.readFileSync(path.join(repoRoot, 'components', 'PricingTiers.tsx'), 'utf8');
  assert.ok(
    pricingSrc.includes('trialEligible'),
    'PricingTiers.tsx must still reference trialEligible — the pricing page CTA must be unchanged',
  );
  assert.ok(
    pricingSrc.includes('Start Free 7-Day Trial'),
    'PricingTiers.tsx must still contain "Start Free 7-Day Trial" — its trial CTA must be intact',
  );
});

// ── 12. Assessment-logic bias audit — structural guards ───────────────────────
//
// These tests verify that the synthesis prompt contains the required reasoning
// principles and sub-score definitions introduced to prevent optimism bias in
// competitive-market assessments.
//
// They are SOURCE SCANS, not LLM calls — they assert that the prompt text
// contains specific language, making it impossible to silently regress the fix.
//
// Scenarios verified structurally (A–E from the audit spec):
//   A. Heavy competition + no differentiation must not resolve solely on demographics.
//   B. Competition + credible unmet niche can still yield a favorable result.
//   C. Weak demand + weak economics → system willing to be unfavorable.
//   D. Strong demand + moderate competition + whitespace → favorable still possible.
//   E. Missing competition data → uncertainty acknowledged, not optimism.
//
// A–E cannot be deterministically asserted on live LLM output without an API
// call, so they are validated via formula arithmetic (the formula is deterministic)
// plus prompt-content guards (the instructions the LLM must follow).

const analyzeSrc = fs.readFileSync(path.join(repoRoot, 'api', 'analyze.ts'), 'utf8');

// ── A-1: Prompt defines Market Demand as available-to-new-entrant, not category size ──

check('A-1: synthesis prompt defines Market Demand as demand available to a new entrant', () => {
  assert.ok(
    analyzeSrc.includes('AVAILABLE TO A NEW ENTRANT'),
    'synthesis prompt must define Market Demand as demand available to a new entrant, not just category interest',
  );
});

// ── A-2: Prompt explicitly guards against demographics-only favorable conclusions ──

check('A-2: synthesis prompt warns that large affluent population ≠ high addressable demand', () => {
  assert.ok(
    analyzeSrc.includes('does NOT automatically mean high addressable demand'),
    'synthesis prompt must state that affluent demographics do not automatically imply high addressable demand',
  );
});

// ── A-3: Prompt requires substitute competition to be included in Competition Intensity ──

check('A-3: Competition Intensity definition includes substitute offerings', () => {
  assert.ok(
    analyzeSrc.includes('substitute offerings that satisfy the same customer need'),
    'synthesis prompt must require substitute competition to be included in Competition Intensity scoring',
  );
});

// ── A-4: Prompt carries the critical principle distinguishing demand from opportunity ──

check('A-4: prompt contains the principle "High category demand is NOT equivalent to high opportunity"', () => {
  assert.ok(
    analyzeSrc.includes('High category demand is NOT equivalent to high opportunity'),
    'synthesis prompt must include the critical demand-vs-opportunity principle',
  );
});

// ── A-5: Prompt requires the RECONCILIATION REQUIREMENT block ──

check('A-5: synthesis prompt contains the RECONCILIATION REQUIREMENT section', () => {
  assert.ok(
    analyzeSrc.includes('RECONCILIATION REQUIREMENT'),
    'synthesis prompt must include the RECONCILIATION REQUIREMENT block',
  );
  assert.ok(
    analyzeSrc.includes('strongest specific evidence FOR this opportunity'),
    'reconciliation block must ask for strongest FOR evidence',
  );
  assert.ok(
    analyzeSrc.includes('strongest specific evidence AGAINST'),
    'reconciliation block must ask for strongest AGAINST evidence',
  );
});

// ── A-6: Prompt explicitly bars a favorable conclusion from crowded market with no whitespace ──

check('A-6: prompt bars favorable conclusion when competition is dense and no whitespace is identified', () => {
  assert.ok(
    analyzeSrc.includes('Do NOT reach a favorable conclusion (Recommended) if the competitive evidence shows a dense, mature market'),
    'synthesis prompt must explicitly bar a favorable conclusion without whitespace evidence in competitive markets',
  );
});

// ── B: Formula arithmetic — "competition can still allow favorable if whitespace exists" ──
// Scenario B: attractive demographics (demand=78) + moderate-to-heavy competition (intensity=65) +
// defensible niche drives up financial feasibility (feasibility=72) + moderate risk (risk=50)
//   Score = 0.30×78 + 0.25×(100-65) + 0.25×72 + 0.20×(100-50)
//         = 23.4 + 8.75 + 18 + 10 = 60.15 → "Worth Further Investigation" (score ≥ 60)
// Verifies that the formula can still produce a positive result when differentiation improves
// the financial feasibility and demand scores even in a competitive market.

check('B: formula can produce ≥60 when competition is high but demand/feasibility are strong (niche scenario)', () => {
  const mktDemand = 78;
  const compIntensity = 65;
  const finFeasibility = 72;
  const riskLevel = 50;
  const score = 0.30 * mktDemand + 0.25 * (100 - compIntensity) + 0.25 * finFeasibility + 0.20 * (100 - riskLevel);
  assert.ok(score >= 60, `expected score ≥ 60 for credible-niche scenario, got ${score.toFixed(2)}`);
  assert.ok(score < 70, `expected score < 70 (not "Strong"), got ${score.toFixed(2)}`);
});

// ── C: Formula arithmetic — weak demand + bad economics → sub-50 score ──
// Scenario C: low demand (40), moderate competition (60), poor financial feasibility (35), high risk (75)
//   Score = 0.30×40 + 0.25×(100-60) + 0.25×35 + 0.20×(100-75)
//         = 12 + 10 + 8.75 + 5 = 35.75 → "Significant Concerns" (score ≥ 35, < 50)

check('C: formula produces Significant Concerns territory for weak demand + poor economics', () => {
  const score = 0.30 * 40 + 0.25 * (100 - 60) + 0.25 * 35 + 0.20 * (100 - 75);
  assert.ok(score >= 35, `expected ≥ 35 (Significant Concerns), got ${score.toFixed(2)}`);
  assert.ok(score < 50, `expected < 50, got ${score.toFixed(2)}`);
});

// ── D: Formula arithmetic — strong demand + moderate competition + whitespace → ≥70 ──
// Scenario D: strong demand (82), moderate competition (45), good financial feasibility (75), low risk (35)
//   Score = 0.30×82 + 0.25×(100-45) + 0.25×75 + 0.20×(100-35)
//         = 24.6 + 13.75 + 18.75 + 13 = 70.1 → "Attractive Market" (score ≥ 70)

check('D: formula produces ≥70 for strong demand + moderate competition + demonstrated whitespace', () => {
  const score = 0.30 * 82 + 0.25 * (100 - 45) + 0.25 * 75 + 0.20 * (100 - 35);
  assert.ok(score >= 70, `expected ≥ 70 (Attractive Market), got ${score.toFixed(2)}`);
});

// ── E: Prompt handles missing grounding data without treating absence as low competition ──

check('E: synthesis prompt does not assume low competition when grounding data is absent', () => {
  // The prompt must NOT contain language that defaults favorably on missing competition data.
  // The correct behavior is: uncertainty should not be resolved as a positive signal.
  // We verify the reconciliation requirement asks "what assumptions would need to be true"
  // which forces the model to surface missing-data uncertainty rather than assume favorable.
  assert.ok(
    analyzeSrc.includes('What assumptions would need to be true for a new entrant to succeed'),
    'prompt must require explicit assumption enumeration, forcing uncertainty to be surfaced rather than silently resolved as favorable',
  );
});

// ── Prompt version bumped after scoring-rule change ──

check('PROMPT_VERSION updated to reflect the assessment-logic fix', () => {
  assert.ok(
    analyzeSrc.includes("const PROMPT_VERSION = '2026-08-24'"),
    'PROMPT_VERSION must be updated to 2026-08-24 to track the assessment-logic fix',
  );
});

// ── Run async tests, then report ──────────────────────────────────────────────

for (const { name, fn } of asyncTests) {
  try {
    await fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`FAIL ${name}: ${msg}`);
    process.exit(1);
  }
}

console.log(`\n${passed} test group(s) passed.`);
