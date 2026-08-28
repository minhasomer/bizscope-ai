/**
 * Tests for direct/indirect competitor modeling.
 * Covers: Phase 1 prompt structure, schema additions, synthesis COMPETITOR LIST RULE,
 * refinement value normalization, and empty-state/presentation logic.
 *
 * All checks are source-scans (no live Gemini calls) to match the project's test pattern.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseRefinementResponse } from '../src/utils/refinementUtils';

const root = resolve(import.meta.dirname, '..');

function readSource(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

let pass = 0;
let fail = 0;

function ok(label: string, cond: boolean): void {
  if (cond) {
    console.log(`ok   ${label}`);
    pass++;
  } else {
    console.error(`FAIL ${label}`);
    fail++;
  }
}

// ─── 1. Phase 1 prompt: direct/indirect labeling ──────────────────────────────

const analyzeTs = readSource('api/analyze.ts');

ok(
  'Phase 1 prompt asks for [DIRECT] label',
  analyzeTs.includes('[DIRECT]'),
);

ok(
  'Phase 1 prompt asks for [INDIRECT] label',
  analyzeTs.includes('[INDIRECT]'),
);

ok(
  'Phase 1 prompt restricts indirect to commercially meaningful substitutes',
  analyzeTs.includes('commercially meaningful substitute'),
);

ok(
  'Phase 1 prompt retains Maps-data instruction (no hallucination)',
  analyzeTs.includes('Use Google Maps data to find actual businesses'),
);

ok(
  'Franchise Phase 1 path still intact (separate prompt for franchise)',
  analyzeTs.includes('franchiseCheck.isFranchise'),
);

// ─── 2. Competitor schema: type field ─────────────────────────────────────────

ok(
  'reportSchema competitor items include type field with enum',
  analyzeTs.includes('"direct", "indirect"') || analyzeTs.includes("'direct', 'indirect'") ||
  analyzeTs.includes("enum: ['direct', 'indirect']"),
);

ok(
  'types.ts Competition interface has type?: "direct" | "indirect"',
  readSource('types.ts').includes("type?: 'direct' | 'indirect'"),
);

// ─── 3. Synthesis COMPETITOR LIST RULE: type instruction ─────────────────────

ok(
  'Synthesis COMPETITOR LIST RULE instructs setting the type field',
  analyzeTs.includes('"direct" if the competitor was labeled [DIRECT]') ||
  analyzeTs.includes('set to "direct" if the competitor was labeled [DIRECT]'),
);

ok(
  'Synthesis COMPETITOR LIST RULE provides indirect fallback ("indirect" if labeled [INDIRECT])',
  analyzeTs.includes('"indirect" if labeled [INDIRECT]'),
);

ok(
  'Synthesis COMPETITOR LIST RULE defaults to "direct" when no label present',
  analyzeTs.includes('Default to "direct" if no label is present'),
);

// ─── 4. Refinement value normalization ────────────────────────────────────────

ok(
  'normalizeOptionValue: snake_case → Title Case',
  parseRefinementResponse({
    needsRefinement: true,
    options: [
      { label: 'Coffee/Beverage Food Truck', value: 'coffee_beverage_food_truck' },
      { label: 'Taco Truck', value: 'taco_truck' },
    ],
  }).options?.[0].value === 'Coffee Beverage Food Truck',
);

ok(
  'normalizeOptionValue: hyphen slug → Title Case',
  parseRefinementResponse({
    needsRefinement: true,
    options: [
      { label: 'Artisan Bakery', value: 'artisan-bakery' },
      { label: 'Other', value: 'other-concept' },
    ],
  }).options?.[0].value === 'Artisan Bakery',
);

ok(
  'normalizeOptionValue: already readable values are unchanged',
  parseRefinementResponse({
    needsRefinement: true,
    options: [
      { label: 'Yemeni Coffee Shop', value: 'Yemeni Coffee Shop' },
      { label: 'Specialty Cafe', value: 'Specialty Cafe' },
    ],
  }).options?.[0].value === 'Yemeni Coffee Shop',
);

ok(
  'normalizeOptionValue: slash-separated values unchanged (no underscores)',
  parseRefinementResponse({
    needsRefinement: true,
    options: [
      { label: 'Coffee/Beverage Food Truck', value: 'Coffee/Beverage Food Truck' },
      { label: 'Hot Dog Cart', value: 'Hot Dog Cart' },
    ],
  }).options?.[0].value === 'Coffee/Beverage Food Truck',
);

// ─── 5. Refinement system prompt: value format instruction ────────────────────

const previewTs = readSource('api/preview.ts');

ok(
  'REFINEMENT_SYSTEM_PROMPT instructs human-readable values (not snake_case)',
  previewTs.includes('NEVER use snake_case') || previewTs.includes('never use snake_case'),
);

ok(
  'REFINEMENT_SYSTEM_PROMPT covers both label and value readability',
  previewTs.includes('label AND value') || previewTs.includes('label and value'),
);

// ─── 6. CompetitorMap: empty state ────────────────────────────────────────────

const mapTs = readSource('components/CompetitorMap.tsx');

ok(
  'CompetitorMap renders empty state message when no mapped competitors',
  mapTs.includes('No mapped competitor locations') || mapTs.includes('No reliable nearby competitor locations'),
);

ok(
  'CompetitorMap accepts hasOnlyIndirect prop',
  mapTs.includes('hasOnlyIndirect'),
);

ok(
  'CompetitorMap shows explanatory banner when hasOnlyIndirect is true',
  mapTs.includes('No direct competitors were identified nearby'),
);

ok(
  'CompetitorMap uses amber color for indirect markers',
  mapTs.includes('#F59E0B') || mapTs.includes('amber'),
);

ok(
  'CompetitorMap legend distinguishes Direct from Indirect',
  mapTs.includes('Direct') && mapTs.includes('Indirect'),
);

// ─── 7. ReportDisplay: direct/indirect sections and empty state ───────────────

const reportDisplayTs = readSource('components/ReportDisplay.tsx');

ok(
  'ReportDisplay shows "Direct Competitors" section label',
  reportDisplayTs.includes('Direct Competitors'),
);

ok(
  'ReportDisplay shows "Relevant Indirect Competitors" section label',
  reportDisplayTs.includes('Relevant Indirect Competitors'),
);

ok(
  'ReportDisplay shows empty state when no named competitors found',
  reportDisplayTs.includes('No named competitors identified') ||
  reportDisplayTs.includes('No specific nearby competitors were returned'),
);

ok(
  'ReportDisplay passes hasOnlyIndirect to CompetitorMap',
  reportDisplayTs.includes('hasOnlyIndirect={directComps.length === 0 && indirectComps.length > 0}') ||
  reportDisplayTs.includes('hasOnlyIndirect='),
);

ok(
  'ReportDisplay indirect badge visible in Nearby Competitors list',
  reportDisplayTs.includes("comp.type === 'indirect'"),
);

// ─── 8. Scoring/formula untouched ─────────────────────────────────────────────

ok(
  'Scoring formula weights unchanged (0.30 Market Demand still present)',
  analyzeTs.includes('0.30 × Market Demand'),
);

ok(
  'Scoring formula weights unchanged (0.25 Competition Intensity still present)',
  analyzeTs.includes('0.25 × (100 - Competition Intensity)'),
);

ok(
  'Competition Intensity definition still includes substitutes instruction',
  analyzeTs.includes('relevant substitute offerings that satisfy the same customer need'),
);

ok(
  'Recommendation thresholds unchanged (70-100 Recommended)',
  analyzeTs.includes('70-100 Recommended'),
);

ok(
  'Recommendation thresholds unchanged (40-69 Caution Advised)',
  analyzeTs.includes('40-69 Caution Advised'),
);

// ─── 9. Phase 8: refined concept passes through correctly ─────────────────────

ok(
  'competitorCountForCategory dense list includes coffee (refined coffee concepts match)',
  analyzeTs.includes("'coffee'") && analyzeTs.includes("'cafe'"),
);

ok(
  'cache key normalization uses normalizeCacheKey (businessType.toLowerCase().trim())',
  analyzeTs.includes('normalizeCacheKey(businessType)'),
);

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('');
console.log(`${pass + fail} tests: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
