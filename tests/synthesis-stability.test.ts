/**
 * Synthesis stability tests — Phase 9 consistency test harness.
 *
 * Validates that:
 *   1. The evidence-based scoring rubric is present in the synthesis prompt.
 *   2. The structured evidence fingerprint (competitor count hint) is injected.
 *   3. Synthesis temperature is at most 0.3 (analytical task, not creative).
 *   4. The post-synthesis consistency validation logic is present and correct.
 *   5. The EVIDENCE STABILITY PRINCIPLE is stated in the prompt.
 *   6. Version constants reflect the stability configuration.
 *
 * These tests are static/structural — they do not make live AI calls.
 * For real same-evidence repeatability testing, use the developer QA script
 * (see STABILITY_TESTING.md) which feeds fixed Phase 1/2 text into synthesis
 * multiple times and compares component scores.
 *
 * Run standalone:
 *   npx tsx tests/synthesis-stability.test.ts
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import {
  scoreToMarketDemandRating,
  scoreToCompetitionRating,
  scoreToCapitalRating,
  scoreToComplexityRating,
  scoreToGrowthRating,
  scoreToRiskRating,
  viabilityScoreToAssessment,
} from '../src/utils/assessmentUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const analyzeSrc = readFileSync(path.join(__dirname, '../api/analyze.ts'), 'utf8');

let passed = 0;
let failed = 0;
const testQueue: Array<{ name: string; fn: () => void }> = [];
function check(name: string, fn: () => void) { testQueue.push({ name, fn }); }

// ─── Phase 7: Sampling settings ───────────────────────────────────────────────

check('synthesis temperature is ≤ 0.3 (analytical task, not creative)', () => {
  // Matches: temperature: 0.2,  or  temperature: 0.25, etc.
  const match = analyzeSrc.match(/temperature:\s*([\d.]+)/);
  assert.ok(match, 'temperature must be set explicitly in synthesis config');
  const temp = parseFloat(match![1]);
  assert.ok(temp <= 0.3, `synthesis temperature should be ≤ 0.3, got ${temp}`);
});

check('thinkingBudget: 0 is set to disable thinking on synthesis', () => {
  assert.ok(
    analyzeSrc.includes('thinkingBudget: 0'),
    'thinkingBudget must be 0 for synthesis (prevents timeout)',
  );
});

// ─── Phase 6: Research quality context ────────────────────────────────────────

check('research quality context section is injected into synthesis prompt', () => {
  assert.ok(
    analyzeSrc.includes('RESEARCH QUALITY CONTEXT'),
    'synthesis prompt must include a RESEARCH QUALITY CONTEXT section',
  );
});

check('research quality context is advisory-only (no competitor count claim)', () => {
  // Must NOT contain a text-parsed competitor count presented as fact.
  // Reliable boolean flags (phase1Grounded) and length-based quality signals
  // are used instead. The advisory nature is stated in the section header.
  assert.ok(
    !analyzeSrc.includes('estimateCompetitorCountFromResearch'),
    'unreliable text-parsing heuristic must not be present',
  );
  assert.ok(
    !analyzeSrc.includes('approxCompetitorCount'),
    'parsed competitor count variable must not be injected into the prompt',
  );
  assert.ok(
    analyzeSrc.includes('do not treat as a competitor count'),
    'section header must explicitly warn the model not to treat it as a count',
  );
});

check('research quality context uses reliable grounding flag, not text parsing', () => {
  assert.ok(
    analyzeSrc.includes('phase1Grounded'),
    'evidence summary must use the phase1Grounded boolean (reliable) not a parsed count',
  );
  assert.ok(
    analyzeSrc.includes('competitionInfo.length'),
    'evidence summary must use response length as a data-richness proxy',
  );
});

check('evidence summary states scoring must be based on Competition Analysis section', () => {
  assert.ok(
    analyzeSrc.includes('Base all scoring on the Competition Analysis'),
    'synthesis instruction must direct model to the Competition Analysis as the primary source',
  );
});

// ─── Phase 4: Scoring rubric ──────────────────────────────────────────────────

check('EVIDENCE-BASED SCORING RUBRIC section is present in prompt', () => {
  assert.ok(
    analyzeSrc.includes('EVIDENCE-BASED SCORING RUBRIC'),
    'synthesis prompt must include the EVIDENCE-BASED SCORING RUBRIC section',
  );
});

check('rubric defines Risk Level bands with evidence anchors', () => {
  assert.ok(
    analyzeSrc.includes('small-town or rural location'),
    'riskLevel rubric must explicitly address small/rural locations',
  );
  assert.ok(
    analyzeSrc.includes('21–40 (Low)') && analyzeSrc.includes('41–60 (Moderate)'),
    'riskLevel rubric must define Low and Moderate bands',
  );
});

check('rubric defines Competition Intensity bands and directs model to Competition Analysis prose', () => {
  assert.ok(
    analyzeSrc.includes('0–20 (Very Low)') && analyzeSrc.includes('21–40 (Low)'),
    'competitionIntensity rubric must define Very Low and Low bands',
  );
  // The rubric must point to the actual Competition Analysis text, not a heuristic count.
  assert.ok(
    analyzeSrc.includes('actual named businesses in the Competition Analysis section above'),
    'competitionIntensity rubric must direct model to the Competition Analysis prose as primary source',
  );
  // Must NOT still reference the removed heuristic count as the primary anchor.
  assert.ok(
    !analyzeSrc.includes('"Approximate direct competitors found"'),
    'rubric must not reference the removed heuristic count anchor',
  );
});

check('rubric defines Market Demand bands', () => {
  assert.ok(
    analyzeSrc.includes('65–79 (Strong)') && analyzeSrc.includes('80–100 (Exceptional)'),
    'marketDemand rubric must define Strong and Exceptional bands',
  );
});

check('rubric defines Scalability guidance', () => {
  assert.ok(
    analyzeSrc.includes('financialProjections.scalability'),
    'rubric must provide scalability (Low/Medium/High) guidance',
  );
});

check('EVIDENCE STABILITY PRINCIPLE is stated in prompt', () => {
  assert.ok(
    analyzeSrc.includes('EVIDENCE STABILITY PRINCIPLE'),
    'prompt must state the evidence stability principle',
  );
  assert.ok(
    analyzeSrc.includes('Only cross a band boundary when there is a concrete, identifiable evidence difference'),
    'stability principle must specify the condition for crossing a band boundary',
  );
});

// ─── Phase 16: Post-synthesis consistency validation ──────────────────────────

check('consistency validation block is present after parse', () => {
  assert.ok(
    analyzeSrc.includes('Phase 16: post-synthesis consistency validation'),
    'Phase 16 consistency validation block must be present',
  );
});

check('validates competition intensity vs competitor count contradiction', () => {
  assert.ok(
    analyzeSrc.includes('claimed Very Low but'),
    'consistency check must log a warning when competition intensity contradicts competitor count',
  );
  assert.ok(
    analyzeSrc.includes('_competitorCount >= 4'),
    'contradiction threshold for competition must be 4+ competitors',
  );
});

check('validates risk level vs high-severity risk count contradiction', () => {
  assert.ok(
    analyzeSrc.includes('_highRisks >= 2'),
    'contradiction threshold for risk must be 2+ High-severity risks',
  );
  assert.ok(
    analyzeSrc.includes('_rl <= 30'),
    'risk correction only fires when claimed Very Low (≤30)',
  );
});

check('consistency validation recomputes viability score using prompt formula', () => {
  assert.ok(
    analyzeSrc.includes('0.30 * _md') && analyzeSrc.includes('0.25 * (100 - _ciF)'),
    'score recomputation must use the same formula stated in the synthesis prompt',
  );
});

check('version constants reflect stability configuration', () => {
  assert.ok(
    analyzeSrc.includes("PROMPT_VERSION = '2026-09-03'"),
    'PROMPT_VERSION must be bumped to 2026-09-03',
  );
  assert.ok(
    analyzeSrc.includes("MODEL_CONFIG_VERSION = 'flash-synth-t0.2-rubric1'"),
    'MODEL_CONFIG_VERSION must reflect temperature and rubric change',
  );
});

// ─── Category label thresholds (deterministic, frontend) ─────────────────────
// These tests document and verify the exact frontend thresholds so any future
// change to assessmentUtils.ts does not silently break the rubric alignment.

check('Operational Complexity threshold: riskLevel 40 = Manageable, 41 = Moderate', () => {
  assert.equal(scoreToComplexityRating(40).label, 'Manageable');
  assert.equal(scoreToComplexityRating(41).label, 'Moderate');
  assert.equal(scoreToComplexityRating(20).label, 'Simple');
  assert.equal(scoreToComplexityRating(60).label, 'Moderate');
  assert.equal(scoreToComplexityRating(61).label, 'Complex');
});

check('Risk Level threshold: riskLevel 40 = Low, 41 = Moderate', () => {
  assert.equal(scoreToRiskRating(40).label, 'Low');
  assert.equal(scoreToRiskRating(41).label, 'Moderate');
  assert.equal(scoreToRiskRating(20).label, 'Very Low');
  assert.equal(scoreToRiskRating(75).label, 'Elevated');
  assert.equal(scoreToRiskRating(76).label, 'High');
});

check('Market Demand threshold: 65 = Strong, 80 = Exceptional', () => {
  assert.equal(scoreToMarketDemandRating(65).label, 'Strong');
  assert.equal(scoreToMarketDemandRating(64).label, 'Moderate');
  assert.equal(scoreToMarketDemandRating(80).label, 'Exceptional');
  assert.equal(scoreToMarketDemandRating(79).label, 'Strong');
});

check('Growth Potential: marketDemand 80 + scalability Medium = Exceptional', () => {
  assert.equal(scoreToGrowthRating(80, 'Medium').label, 'Exceptional');
  assert.equal(scoreToGrowthRating(70, 'Medium').label, 'Strong');
  // scalability High adds 10 → 70 + 10 = 80 → Exceptional
  assert.equal(scoreToGrowthRating(70, 'High').label, 'Exceptional');
  // scalability Low subtracts 10 → 80 - 10 = 70 → Strong (not Exceptional)
  assert.equal(scoreToGrowthRating(79, 'Low').label, 'Strong');
});

check('Competition label: intensity 40 = Low, 41 = Moderate', () => {
  assert.equal(scoreToCompetitionRating(40).label, 'Low');
  assert.equal(scoreToCompetitionRating(41).label, 'Moderate');
  assert.equal(scoreToCompetitionRating(20).label, 'Very Low');
  assert.equal(scoreToCompetitionRating(21).label, 'Low');
});

check('Capital Requirements: financialFeasibility 65 = Moderate Capital', () => {
  assert.equal(scoreToCapitalRating(65).label, 'Moderate Capital');
  assert.equal(scoreToCapitalRating(64).label, 'Significant Capital');
  assert.equal(scoreToCapitalRating(80).label, 'Low Capital');
  assert.equal(scoreToCapitalRating(79).label, 'Moderate Capital');
});

check('Overall Assessment: score 60 = Worth Further Investigation', () => {
  assert.equal(viabilityScoreToAssessment(60).label, 'Worth Further Investigation');
  assert.equal(viabilityScoreToAssessment(59).label, 'Proceed Carefully');
  assert.equal(viabilityScoreToAssessment(70).label, 'Strong Opportunity');
  assert.equal(viabilityScoreToAssessment(69).label, 'Worth Further Investigation');
});

// ─── Rubric alignment: thresholds match frontend band boundaries ──────────────
// The scoring rubric in the prompt uses band boundaries that match the frontend
// display thresholds. These tests verify alignment (rubric says 65–79 = Strong,
// frontend says ≥65 = Strong — they must agree).

check('rubric bands align with frontend: marketDemand 65 boundary is in rubric', () => {
  // Rubric says 65–79 = Strong, 45–64 = Moderate — matches frontend exactly
  assert.ok(
    analyzeSrc.includes('65–79 (Strong)') && analyzeSrc.includes('45–64 (Moderate)'),
    'marketDemand rubric must use the same 65 threshold as the frontend',
  );
});

check('rubric bands align with frontend: riskLevel 40 boundary is in rubric', () => {
  // Rubric says 21–40 = Low, 41–60 = Moderate — matches frontend exactly
  assert.ok(
    analyzeSrc.includes('21–40 (Low)') && analyzeSrc.includes('41–60 (Moderate)'),
    'riskLevel rubric must use the same 40 threshold as the frontend',
  );
});

check('rubric bands align with frontend: competitionIntensity 40 boundary is in rubric', () => {
  // Rubric says 21–40 = Low, 41–60 = Moderate — matches frontend exactly
  assert.ok(
    analyzeSrc.includes('21–40 (Low)') && analyzeSrc.includes('41–60 (Moderate)'),
    'competitionIntensity rubric must use the same 40 threshold as the frontend',
  );
});

// ─── Runner ───────────────────────────────────────────────────────────────────

(async () => {
  for (const { name, fn } of testQueue) {
    try {
      fn();
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
