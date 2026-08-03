/**
 * Structural checks for the simplified homepage hero.
 * Source-level assertions — no DOM/browser needed.
 *   npx tsx tests/homepage-hero.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const heroSrc = fs.readFileSync(path.join(repoRoot, 'components', 'Hero.tsx'), 'utf8');
const appSrc = fs.readFileSync(path.join(repoRoot, 'App.tsx'), 'utf8');

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok   ${name}`);
}

// ── 1. Positioning line present ───────────────────────────────────────────────

check('positioning line "For Startups, Franchises" is present in Hero', () => {
  assert.ok(
    heroSrc.includes('For Startups, Franchises'),
    'Expected positioning line not found in Hero.tsx',
  );
});

check('positioning line uses indigo-300 color', () => {
  assert.ok(
    heroSrc.includes('text-indigo-300'),
    'indigo-300 color token missing — positioning line may have wrong color',
  );
});

// ── 2. Old clutter strings absent from Hero ───────────────────────────────────

const REMOVED_STRINGS: Array<[string, string]> = [
  ['Built for business decisions', 'old "Built for business decisions" heading'],
  ['use-case pills', 'use-case pill row markup'],
];

for (const [needle, label] of REMOVED_STRINGS) {
  check(`Hero does not contain old clutter: "${needle}"`, () => {
    assert.ok(!heroSrc.includes(needle), `Found removed ${label} in Hero.tsx`);
  });
}

// ── 3. Below-hero sections gated on !hasResults, not isAuthenticated ──────────

check('sections gate uses !hasResults, not isAuthenticated', () => {
  // The section block must be guarded by !hasResults
  assert.ok(
    heroSrc.includes('!hasResults'),
    'Expected !hasResults gate not found in Hero.tsx',
  );
});

check('isAuthenticated does not gate any section or div block in Hero', () => {
  // isAuthenticated may appear in JSX expressions for text/button selection,
  // but must not appear as the sole condition of a top-level layout branch.
  // Specifically, there must be no pattern like: {isAuthenticated && (<section or <div)
  const authSectionBranch = /\{\s*isAuthenticated\s*&&\s*\(\s*<(?:section|div)/;
  assert.ok(
    !authSectionBranch.test(heroSrc),
    'Found isAuthenticated-gated section/div — layout must be auth-agnostic',
  );
});

// ── 4. App.tsx home case: single Hero render, no auth-branched layout ─────────

check('App.tsx home case renders a single <Hero, not separate auth paths', () => {
  // Extract the home case switch branch by looking for the hasResults prop
  // (unique to the home Hero render) and confirming there's no currentUser ternary
  // wrapping a <Hero or layout element before it.
  const hasResultsProp = /hasResults=\{!!\s*report\s*\|\|\s*isLoading\}/.test(appSrc);
  assert.ok(hasResultsProp, 'hasResults prop not found in App.tsx — home Hero render missing');
});

check('App.tsx does not branch layout on currentUser for the home Hero', () => {
  // There must be no pattern like: currentUser ? <Hero : <OldHero
  const authHeroBranch = /currentUser\s*\?\s*<Hero|currentUser\s*\?\s*\(\s*<Hero/;
  assert.ok(
    !authHeroBranch.test(appSrc),
    'Found auth-branched Hero render — home layout must be unified',
  );
});

// ── Done ─────────────────────────────────────────────────────────────────────

console.log(`\n${passed} checks passed.`);
