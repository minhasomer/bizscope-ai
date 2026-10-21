/**
 * Maps research cache guard — api/analyze.ts
 *
 * Phase 1 (Maps grounding) regularly exceeds its 14 s timeout in dense markets,
 * which produced reports with 0 competitors that were then cached and served
 * to everyone. Covers:
 *  1. isMissingMapsResearch only flags Maps failure + empty competitor list
 *  2. Such reports are not written to report_cache
 *  3. Already-cached ones are treated as a miss (isCachedReportValid)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { isMissingMapsResearch } = await import('../api/analyze.ts');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.resolve(__dirname, '..', 'api', 'analyze.ts'), 'utf8');

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok   ${name}`);
}

const report = (mapsGrounded: boolean | undefined, competitors: unknown[] | undefined) => ({
  generationMeta: mapsGrounded === undefined ? undefined : { grounding: { mapsGrounded } },
  competitionAnalysis: competitors === undefined ? undefined : { competitors },
});

check('Maps failed + 0 competitors → missing research', () => {
  assert.equal(isMissingMapsResearch(report(false, [])), true);
  assert.equal(isMissingMapsResearch(report(false, undefined)), true);
});

check('Maps failed but competitors present → keep', () => {
  assert.equal(isMissingMapsResearch(report(false, [{ name: 'A' }])), false);
});

check('Maps succeeded with 0 competitors (genuinely none nearby) → keep', () => {
  assert.equal(isMissingMapsResearch(report(true, [])), false);
});

check('older reports without generationMeta → keep', () => {
  assert.equal(isMissingMapsResearch(report(undefined, [])), false);
  assert.equal(isMissingMapsResearch(null), false);
});

check('cache write is skipped for missing Maps research', () => {
  const guard = src.indexOf('if (isMissingMapsResearch(parsed))');
  const write = src.indexOf("await setInServerCache(businessType, location, 'standard', verifiedPlan, parsed)");
  assert.ok(guard > 0 && write > guard, 'guard wraps the standard cache write');
});

check('cached reports missing Maps research are a cache miss', () => {
  const fn = src.slice(src.indexOf('function isCachedReportValid'), src.indexOf('function competitorCountForCategory'));
  assert.ok(fn.includes('!isMissingMapsResearch(report)'));
});

console.log(`\n${passed} tests passed\n`);
