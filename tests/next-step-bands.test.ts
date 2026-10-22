/**
 * Recommended Next Step tracks the Overall Assessment badge — src/utils/assessmentUtils.ts
 *
 * Covers:
 *  1. One next step per badge, at every band boundary
 *  2. Next step changes exactly where the badge changes (0–100)
 *  3. ReportDisplay derives it from the score, not the AI's 3-band decision
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getNextStep, viabilityScoreToAssessment } from '../src/utils/assessmentUtils.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok   ${name}`);
}

check('each badge has its own next step', () => {
  const cases: Array<[number, string, string]> = [
    [82, 'Strong Opportunity',          'Proceed to Due Diligence'],
    [70, 'Strong Opportunity',          'Proceed to Due Diligence'],
    [69, 'Worth Further Investigation', 'Further Validation Recommended'],
    [60, 'Worth Further Investigation', 'Further Validation Recommended'],
    [59, 'Proceed Carefully',           'Review Key Risks Before Investing'],
    [50, 'Proceed Carefully',           'Review Key Risks Before Investing'],
    [49, 'Significant Concerns',        'Investigate Thoroughly Before Proceeding'],
    [35, 'Significant Concerns',        'Investigate Thoroughly Before Proceeding'],
    [34, 'Not Recommended',             'Do not proceed without major reassessment'],
  ];
  for (const [score, badge, step] of cases) {
    assert.equal(viabilityScoreToAssessment(score).label, badge, `badge at ${score}`);
    assert.equal(getNextStep(score), step, `next step at ${score}`);
  }
});

check('next step changes exactly where the badge changes', () => {
  for (let s = 1; s <= 100; s++) {
    const badgeChanged = viabilityScoreToAssessment(s).label !== viabilityScoreToAssessment(s - 1).label;
    const stepChanged = getNextStep(s) !== getNextStep(s - 1);
    assert.equal(stepChanged, badgeChanged, `boundary mismatch at ${s}`);
  }
});

check('ReportDisplay derives the next step from the score', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'components', 'ReportDisplay.tsx'), 'utf8');
  assert.ok(src.includes('getNextStep(report.viabilityScore)'));
});

console.log(`\n${passed} tests passed\n`);
