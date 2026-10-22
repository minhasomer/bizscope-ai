/**
 * Sample reports tests — components/SampleReports.tsx + src/data/sampleReports/*.json
 *
 * Covers:
 *  1. Every card has a report file and a lazy loader
 *  2. Card figures match the real report they summarise
 *  3. Report files carry no account, cache or cost data
 *  4. Sample pages render read-only on the Pro plan (no live API calls)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeRangeSeparator } from '../src/utils/rangeFormat.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok   ${name}`);
}

// SampleReports.tsx imports React components, so read SAMPLES from source text.
const cardsSrc = fs.readFileSync(path.join(root, 'components', 'SampleReports.tsx'), 'utf8');
const samplesBlock = cardsSrc.slice(cardsSrc.indexOf('export const SAMPLES'), cardsSrc.indexOf('export const SAMPLE_REPORT_LOADERS'));
const field = (block: string, name: string) => {
  const m = block.match(new RegExp(`${name}:\\s*(?:'([^']*)'|(\\d+))`));
  assert.ok(m, `${name} present`);
  return m![1] ?? Number(m![2]);
};
const cards = samplesBlock.split(/\n\s*\{\s*\n/).slice(1).map((b) => ({
  slug: field(b, 'slug') as string,
  viabilityScore: field(b, 'viabilityScore') as number,
  startupCost: field(b, 'startupCost') as string,
  year1Revenue: field(b, 'year1Revenue') as string,
  breakEven: field(b, 'breakEven') as string,
  insight: field(b, 'insight') as string,
}));

const dataDir = path.join(root, 'src', 'data', 'sampleReports');
const load = (slug: string) => JSON.parse(fs.readFileSync(path.join(dataDir, `${slug}.json`), 'utf8'));

check('four sample cards, the first with a green verdict (60+)', () => {
  assert.equal(cards.length, 4);
  assert.ok(cards[0].viabilityScore >= 60);
});

for (const card of cards) {
  check(`${card.slug}: report file and lazy loader exist`, () => {
    assert.ok(fs.existsSync(path.join(dataDir, `${card.slug}.json`)));
    assert.ok(cardsSrc.includes(`import('../src/data/sampleReports/${card.slug}.json')`));
  });

  check(`${card.slug}: card figures match the report`, () => {
    const r = load(card.slug);
    const fp = r.financialProjections;
    assert.equal(card.viabilityScore, r.viabilityScore);
    assert.equal(card.startupCost, normalizeRangeSeparator(fp.startupCostRange));
    assert.equal(card.year1Revenue, normalizeRangeSeparator(fp.revenueYear1));
    // Plain-number ranges ("24\n\n36 months") aren't covered by normalizeRangeSeparator.
    assert.equal(card.breakEven, fp.breakEvenTime.replace(/\s*(?:\n+|[–-])\s*/, '–'));
    assert.ok(r.executiveSummary.startsWith(card.insight), 'insight is the summary’s first sentence');
  });

  check(`${card.slug}: no account, cache or cost data`, () => {
    const raw = fs.readFileSync(path.join(dataDir, `${card.slug}.json`), 'utf8');
    const r = JSON.parse(raw);
    for (const k of ['_cached', '_cacheAgeDays', '_isStale', 'loadedFromCache', 'cachedAt', 'userId', 'user_id', 'userEmail']) {
      assert.ok(!(k in r), `${k} absent`);
    }
    assert.ok(!/token|cost/i.test(Object.keys(r.generationMeta ?? {}).join(',')), 'no token/cost fields in generationMeta');
    assert.ok(!/@(gmail|bizscope)/i.test(raw), 'no email addresses');
    assert.ok(r._generatedAt, 'generation date kept');
  });
}

check('sample page renders ReportDisplay read-only on Pro', () => {
  const page = fs.readFileSync(path.join(root, 'components', 'SampleReportPage.tsx'), 'utf8');
  assert.ok(page.includes('currentPlan="Pro"'));
  assert.ok(page.includes(' readOnly '));
  assert.ok(!page.includes('onRegenerate'), 'no regenerate action');
});

check('App routes ?view=sample-<slug> to the sample page', () => {
  const app = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
  assert.ok(app.includes("activeView.startsWith('sample-')"));
});

console.log(`\n${passed} tests passed\n`);
