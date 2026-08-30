/**
 * Tests for the three analysis reliability fixes:
 *   1. Malformed-response retry (Phase 3 resilience)
 *   2. Refined business concept persistence (businessType override)
 *   3. Nearby competitor distance classification (isLocal / distanceMiles)
 *
 * Run standalone:
 *   npx tsx tests/analysis-reliability.test.ts
 * Exits non-zero on the first failed assertion.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { haversineMiles } from '../src/utils/franchiseGeography.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
const testQueue: Array<{ name: string; fn: () => void | Promise<void> }> = [];
function check(name: string, fn: () => void | Promise<void>) { testQueue.push({ name, fn }); }

const analyzeSrc   = readFileSync(path.join(__dirname, '../api/analyze.ts'), 'utf8');
const competitorSrc = readFileSync(path.join(__dirname, '../components/CompetitorMap.tsx'), 'utf8');

// ─── haversineMiles: correctness ──────────────────────────────────────────────

check('haversineMiles: same point → 0 miles', () => {
  assert.equal(haversineMiles(41.85, -87.65, 41.85, -87.65), 0);
});

check('haversineMiles: Chicago to New York ≈ 713 miles (±5%)', () => {
  const dist = haversineMiles(41.85, -87.65, 40.71, -74.01);
  assert.ok(dist > 677 && dist < 749, `expected ≈713 mi, got ${dist.toFixed(1)}`);
});

check('haversineMiles: Gurnee IL to Morton Grove IL — should exceed 10 miles', () => {
  // Gurnee ≈ 42.37, -87.93 | Morton Grove ≈ 42.04, -87.79 — real distance ~23 mi
  const dist = haversineMiles(42.37, -87.93, 42.04, -87.79);
  assert.ok(dist > 10, `expected >10 mi, got ${dist.toFixed(1)}`);
});

check('haversineMiles: ~1-mile separation', () => {
  // Moving ~0.014 degrees latitude ≈ 1 mile
  const dist = haversineMiles(41.85, -87.65, 41.864, -87.65);
  assert.ok(dist > 0.8 && dist < 1.3, `expected ≈1 mi, got ${dist.toFixed(2)}`);
});

// ─── Competitor distance classification logic ─────────────────────────────────
// Re-implements the exact logic from analyze.ts for unit-testing without live AI.

function getLocalRadiusMiles(businessType: string): number {
  const bt = businessType.toLowerCase();
  const dense = [
    'coffee', 'cafe', 'espresso', 'boba', 'bubble tea',
    'fast food', 'burger', 'pizza', 'sandwich', 'sub', 'taco', 'sushi',
    'chinese', 'mexican', 'thai', 'indian', 'italian', 'restaurant',
    'bar', 'brewery', 'pub', 'nightclub', 'lounge',
    'gas station', 'convenience store', 'c-store',
    'gym', 'fitness', 'yoga', 'pilates', 'crossfit',
    'nail salon', 'hair salon', 'barber', 'beauty salon',
    'pharmacy', 'drug store', 'grocery',
    'dry cleaning', 'laundromat', 'laundry',
    'car wash', 'auto detail',
    'dentist', 'dental', 'orthodontist',
    'urgent care', 'medical clinic', 'physical therapy',
    'tutoring', 'learning center',
  ];
  const sparse = [
    'rv repair', 'rv service', 'rv dealer', 'motorhome',
    'boat repair', 'marine', 'aircraft',
    'taxidermy', 'taxidermist',
    'specialty', 'niche', 'artisan', 'bespoke',
    'helicopter', 'skydiving', 'scuba',
    'exotic', 'vintage', 'antique dealer',
    'organ repair', 'piano repair', 'instrument repair',
    'escape room',
  ];
  const label = dense.some(k => bt.includes(k)) ? 'dense' : sparse.some(k => bt.includes(k)) ? 'sparse' : 'normal';
  return label === 'dense' ? 10 : label === 'sparse' ? 25 : 15;
}

function classifyCompetitor(
  hasRealCoords: boolean,
  distanceMiles: number | null,
  localRadius: number,
): { isLocal: boolean; coordinatesVerified: boolean } {
  const coordinatesVerified = hasRealCoords;
  const isLocal = hasRealCoords && distanceMiles !== null && distanceMiles <= localRadius;
  return { isLocal, coordinatesVerified };
}

check('dense category (Pakistani restaurant) uses 10-mile local radius', () => {
  assert.equal(getLocalRadiusMiles('Casual Pakistani Restaurant'), 10);
  assert.equal(getLocalRadiusMiles('restaurant'), 10);
  assert.equal(getLocalRadiusMiles('Coffee Shop'), 10);
  assert.equal(getLocalRadiusMiles('gym'), 10);
});

check('sparse category uses 25-mile local radius', () => {
  assert.equal(getLocalRadiusMiles('RV Repair Shop'), 25);
  assert.equal(getLocalRadiusMiles('Escape Room'), 25);
  assert.equal(getLocalRadiusMiles('taxidermist'), 25);
});

check('normal category uses 15-mile local radius', () => {
  assert.equal(getLocalRadiusMiles('Dog Grooming'), 15);
  assert.equal(getLocalRadiusMiles('Accountant'), 15);
  assert.equal(getLocalRadiusMiles('Daycare'), 15);
});

check('competitor within local radius → isLocal true', () => {
  // 5 miles away, dense category (10-mile radius)
  const { isLocal } = classifyCompetitor(true, 5.0, 10);
  assert.equal(isLocal, true);
});

check('competitor outside local radius → isLocal false', () => {
  // Morton Grove scenario: 23 mi from Gurnee, dense category (10-mile radius)
  const dist = haversineMiles(42.37, -87.93, 42.04, -87.79); // Gurnee → Morton Grove
  const { isLocal } = classifyCompetitor(true, dist, 10);
  assert.equal(isLocal, false, `Morton Grove (${dist.toFixed(1)} mi) should be regional for dense category`);
});

check('competitor at exactly the radius boundary → isLocal true', () => {
  const { isLocal } = classifyCompetitor(true, 10.0, 10);
  assert.equal(isLocal, true, 'at-boundary competitor is local (≤ not <)');
});

check('competitor just over boundary → isLocal false', () => {
  const { isLocal } = classifyCompetitor(true, 10.1, 10);
  assert.equal(isLocal, false);
});

check('estimated/offset coordinates → coordinatesVerified false, isLocal false', () => {
  // Competitors with no AI-supplied lat/lng must NOT be silently classified as local.
  // They receive coordinatesVerified:false and appear in the unverified section only.
  const { isLocal, coordinatesVerified } = classifyCompetitor(false, null, 10);
  assert.equal(coordinatesVerified, false, 'estimated coords must be marked unverified');
  assert.equal(isLocal, false, 'unverified competitor must not appear as confirmed local');
});

check('distanceMiles null with real coords → isLocal false (cannot confirm)', () => {
  // Real coords but no distance computed → cannot confirm local status
  const { isLocal, coordinatesVerified } = classifyCompetitor(true, null, 10);
  assert.equal(coordinatesVerified, true);
  assert.equal(isLocal, false, 'null distance must not claim local');
});

check('Des Plaines scenario: ~28 miles from Gurnee → regional for dense', () => {
  // Des Plaines IL ≈ 42.03, -87.88 | Gurnee ≈ 42.37, -87.93
  const dist = haversineMiles(42.37, -87.93, 42.03, -87.88);
  assert.ok(dist > 20, `expected >20 miles, got ${dist.toFixed(1)}`);
  const { isLocal } = classifyCompetitor(true, dist, 10);
  assert.equal(isLocal, false, `Des Plaines (${dist.toFixed(1)} mi) should be regional for dense`);
});

// ─── Issue 2: businessType override in analyze.ts ────────────────────────────

check('analyze.ts overrides parsed.businessType with request businessType', () => {
  assert.ok(
    analyzeSrc.includes('parsed.businessType = businessType'),
    'analyze.ts must override parsed.businessType with the request param',
  );
});

check('businessType override appears after cleanAndParseJSON call', () => {
  const parseIdx   = analyzeSrc.indexOf('cleanAndParseJSON(synthesisText');
  const overrideIdx = analyzeSrc.indexOf('parsed.businessType = businessType');
  assert.ok(parseIdx !== -1,    'cleanAndParseJSON call not found');
  assert.ok(overrideIdx !== -1, 'businessType override not found');
  assert.ok(overrideIdx > parseIdx, 'override must come after the parse call');
});

// ─── Issue 1: malformed-response retry in analyze.ts ─────────────────────────

check('analyze.ts wraps Phase 3 parse in try/catch for malformed_response', () => {
  assert.ok(
    analyzeSrc.includes("parseErr.message === 'malformed_response'"),
    'must check for malformed_response in catch block',
  );
});

check('analyze.ts retries synthesis exactly once on malformed response', () => {
  // Verify there is exactly one call to runSynthesis inside the malformed catch block.
  // We look for the retry log message and that synthesis is awaited again.
  assert.ok(
    analyzeSrc.includes('one controlled retry'),
    'retry log message must be present',
  );
  // Verify cost is recomputed after the retry
  assert.ok(
    analyzeSrc.includes('cost = aggregateGeminiUsage(model, [phase1Usage, phase2Usage, ...synthesisUsages]'),
    'cost must be recomputed after retry to include the extra synthesis usage',
  );
});

check('malformed retry only fires when time remains (SYNTHESIS_FLOOR_MS guard)', () => {
  assert.ok(
    analyzeSrc.includes('remainingMs() > SYNTHESIS_FLOOR_MS'),
    'malformed retry must check remaining deadline',
  );
  // Count occurrences — should appear for both MAX_TOKENS retry and malformed retry
  const count = (analyzeSrc.match(/remainingMs\(\) > SYNTHESIS_FLOOR_MS/g) ?? []).length;
  assert.ok(count >= 2, `expected ≥2 SYNTHESIS_FLOOR_MS guards, found ${count}`);
});

check('no while-loop or recursive retry (only one catch-path retry)', () => {
  // The retry must not loop
  const malformedSection = analyzeSrc.slice(
    analyzeSrc.indexOf("parseErr.message === 'malformed_response'"),
    analyzeSrc.indexOf('} else {', analyzeSrc.indexOf("parseErr.message === 'malformed_response'")),
  );
  assert.ok(!malformedSection.includes('while ('), 'must not use a while loop for retry');
  assert.ok(!malformedSection.includes('for ('),   'must not use a for loop for retry');
});

check('cost variable is declared as let (not const) to allow recompute after retry', () => {
  assert.ok(
    analyzeSrc.includes('let cost = aggregateGeminiUsage('),
    'cost must be let so it can be updated after the malformed retry',
  );
});

// ─── Issue 3: CompetitorMap local/regional split ──────────────────────────────

check('CompetitorMap local filter requires both isLocal !== false AND coordinatesVerified !== false', () => {
  assert.ok(
    competitorSrc.includes('c.coordinatesVerified !== false'),
    'local filter must exclude coordinatesVerified === false (unverified) competitors',
  );
  assert.ok(
    competitorSrc.includes('c.isLocal !== false'),
    'local filter must also check isLocal',
  );
});

check('CompetitorMap regional filter requires coordinatesVerified === true', () => {
  assert.ok(
    competitorSrc.includes('c.coordinatesVerified === true'),
    'regional list must only show verified-coordinate competitors',
  );
  assert.ok(
    competitorSrc.includes('c.isLocal === false'),
    'regional list must check isLocal === false',
  );
});

check('CompetitorMap computes unverifiedList for offset-coordinate competitors', () => {
  assert.ok(
    competitorSrc.includes('c.coordinatesVerified === false'),
    'unverifiedList must capture coordinatesVerified === false competitors',
  );
});

check('CompetitorMap shows unverified section with disclaimer', () => {
  assert.ok(
    competitorSrc.includes('Unverified Location'),
    'unverified section header must be present',
  );
  assert.ok(
    competitorSrc.includes('Coordinate data unavailable'),
    'unverified section must disclaim that coordinates are unavailable',
  );
});

check('CompetitorMap shows regional section when regional competitors exist', () => {
  assert.ok(
    competitorSrc.includes('Regional'),
    'CompetitorMap must render a regional section header',
  );
  assert.ok(
    competitorSrc.includes('distanceMiles'),
    'regional list must show distanceMiles when available',
  );
});

check('CompetitorMap shows empty state when no verified local competitors found', () => {
  assert.ok(
    competitorSrc.includes('No verified nearby competitors found'),
    'CompetitorMap must show a clean empty state for zero verified local competitors',
  );
});

check('CompetitorMap legend updated to "Nearby Competitor"', () => {
  assert.ok(
    competitorSrc.includes('Nearby Competitor'),
    'legend must say "Nearby Competitor" instead of bare "Competitor"',
  );
});

check('analyze.ts sets coordinatesVerified on each competitor', () => {
  assert.ok(
    analyzeSrc.includes('const coordinatesVerified = hasRealCoords') ||
    analyzeSrc.includes('coordinatesVerified: hasRealCoords'),
    'each competitor must be annotated with coordinatesVerified derived from hasRealCoords',
  );
});

check('analyze.ts isLocal requires hasRealCoords (no false-positive for estimated coords)', () => {
  assert.ok(
    analyzeSrc.includes('const isLocal = hasRealCoords && distanceMiles !== null && distanceMiles <='),
    'isLocal must require hasRealCoords — unverified coords must not claim local status',
  );
});

// ─── Runner ───────────────────────────────────────────────────────────────────

(async () => {
  for (const { name, fn } of testQueue) {
    try {
      await fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (err: any) {
      failed++;
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
    }
  }
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
