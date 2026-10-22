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

check('ad-matched headline "Market Research" is present in Hero', () => {
  assert.ok(
    heroSrc.includes('Market Research'),
    'Expected headline not found in Hero.tsx',
  );
});

check('headline accent "in Minutes" uses indigo-300 color', () => {
  assert.ok(
    /text-indigo-300">in Minutes</.test(heroSrc),
    'indigo-300 "in Minutes" accent missing from the headline',
  );
});

check('subheadline "Know If Your Idea Works Before You Spend a Cent." is present in Hero', () => {
  assert.ok(
    heroSrc.includes('Know If Your Idea Works Before You Spend a Cent.'),
    'Expected subheadline not found in Hero.tsx',
  );
});

check('landing sections (what you get, how it works, who it is for, FAQ) render below the hero', () => {
  for (const tag of ['<WhatYouGet', '<HowItWorks', '<BuiltFor', '<HomeFAQ']) {
    assert.ok(heroSrc.includes(tag), `${tag} not rendered in Hero.tsx`);
  }
});

check('homepage FAQ questions all exist in the verified FAQ content', () => {
  const landingSrc = fs.readFileSync(path.join(repoRoot, 'components', 'LandingSections.tsx'), 'utf8');
  const faqSrc = fs.readFileSync(path.join(repoRoot, 'src', 'data', 'faqContent.ts'), 'utf8');
  const block = landingSrc.slice(landingSrc.indexOf('HOME_FAQ_QUESTIONS = ['), landingSrc.indexOf('];', landingSrc.indexOf('HOME_FAQ_QUESTIONS')));
  const questions = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.equal(questions.length, 6, 'expected 6 homepage FAQ questions');
  for (const q of questions) assert.ok(faqSrc.includes(`question: '${q}'`), `FAQ question missing from faqContent.ts: ${q}`);
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
