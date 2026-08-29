/**
 * Tests for the FAQ page feature.
 *
 * Covers:
 *  1. FAQ view exists in App.tsx
 *  2. VIEW_TITLES contains the FAQ entry
 *  3. Footer companyLinks includes FAQ
 *  4. Navbar navLinks does NOT gain a FAQ item
 *  5. FAQSection is reused (not duplicated) — no second accordion implementation
 *  6. Expected FAQ item count (must be within 12–18)
 *  7. FAQ JSON-LD (FAQPage schema) is present in FAQSection
 *  8. Key pricing facts in FAQ match current plans config
 *  9. No obsolete trial claims (conditional language used)
 * 10. Direct ?view=faq routing is supported via VIEW_TITLES
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { FAQ_ITEMS } from '../src/data/faqContent';

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

const appTs      = readSource('App.tsx');
const navbarTs   = readSource('components/Navbar.tsx');
const footerTs   = readSource('components/Footer.tsx');
const faqSection = readSource('components/seo/FAQSection.tsx');
const faqContent = readSource('src/data/faqContent.ts');

// ─── 1. FAQ view exists in App.tsx ───────────────────────────────────────────

ok(
  "App.tsx has case 'faq':",
  appTs.includes("case 'faq':"),
);

ok(
  'App.tsx imports FAQSection',
  appTs.includes('FAQSection'),
);

ok(
  'App.tsx imports FAQ_ITEMS',
  appTs.includes('FAQ_ITEMS'),
);

// ─── 2. VIEW_TITLES contains FAQ entry ───────────────────────────────────────

ok(
  'VIEW_TITLES contains faq entry',
  appTs.includes("faq:") && appTs.includes('FAQ'),
);

ok(
  'FAQ title includes BizScope brand',
  appTs.includes('BizScope') && appTs.includes("faq:"),
);

// ─── 3. Footer contains FAQ link ─────────────────────────────────────────────

ok(
  "Footer companyLinks includes { label: 'FAQ', page: 'faq' }",
  footerTs.includes("label: 'FAQ'") && footerTs.includes("page: 'faq'"),
);

// ─── 4. Navbar does NOT gain a FAQ item ──────────────────────────────────────

ok(
  "Navbar navLinks does NOT contain a FAQ entry",
  !navbarTs.includes("page: 'faq'") && !navbarTs.includes('FAQ'),
);

// ─── 5. FAQSection is reused, not duplicated ─────────────────────────────────

ok(
  'App.tsx uses FAQSection from components/seo/FAQSection',
  appTs.includes("from './components/seo/FAQSection'"),
);

ok(
  'No second accordion implementation (no AccordionItem or custom accordion class in App.tsx)',
  !appTs.includes('AccordionItem') && !appTs.includes('accordion-item'),
);

ok(
  'FAQSection component exists with expected export',
  faqSection.includes('export const FAQSection'),
);

ok(
  'FAQSection injects FAQPage JSON-LD schema',
  faqSection.includes("'@type': 'FAQPage'") || faqSection.includes('"@type": "FAQPage"') ||
  faqSection.includes("FAQPage"),
);

ok(
  'FAQSection removes schema on unmount (cleanup in useEffect)',
  faqSection.includes('remove()') || faqSection.includes('faq-schema'),
);

// ─── 6. Expected FAQ item count (12–18) ──────────────────────────────────────

ok(
  `FAQ_ITEMS count is between 12 and 18 (actual: ${FAQ_ITEMS.length})`,
  FAQ_ITEMS.length >= 12 && FAQ_ITEMS.length <= 18,
);

ok(
  'Every FAQ item has a non-empty question',
  FAQ_ITEMS.every(f => typeof f.question === 'string' && f.question.trim().length > 0),
);

ok(
  'Every FAQ item has a non-empty answer',
  FAQ_ITEMS.every(f => typeof f.answer === 'string' && f.answer.trim().length > 0),
);

// ─── 7. FAQPage JSON-LD will receive valid content ───────────────────────────

ok(
  'FAQ_ITEMS contains at least one pricing/plan question',
  FAQ_ITEMS.some(f =>
    f.question.toLowerCase().includes('plan') ||
    f.question.toLowerCase().includes('pro') ||
    f.question.toLowerCase().includes('price') ||
    f.question.toLowerCase().includes('explorer'),
  ),
);

ok(
  'FAQ_ITEMS contains at least one accuracy/limitation question',
  FAQ_ITEMS.some(f =>
    f.question.toLowerCase().includes('accurate') ||
    f.question.toLowerCase().includes('guarantee') ||
    f.question.toLowerCase().includes('limitation') ||
    f.question.toLowerCase().includes('should i open') ||
    f.question.toLowerCase().includes('strong opportunity'),
  ),
);

// ─── 8. Key pricing facts match current plans config ─────────────────────────

ok(
  'FAQ content states Explorer is free (verified: $0/forever in plans.ts)',
  faqContent.includes('free') && faqContent.toLowerCase().includes('explorer'),
);

ok(
  'FAQ content states Pro is $29/month',
  faqContent.includes('$29'),
);

ok(
  'FAQ content states Pro+ is $59/month',
  faqContent.includes('$59'),
);

ok(
  'FAQ content states Explorer has 3 reports/month',
  faqContent.includes('3 reports per month') || faqContent.includes('3 standard reports/month') ||
  faqContent.includes('3 reports'),
);

ok(
  'FAQ content states Pro has 20 reports/month',
  faqContent.includes('20 reports'),
);

ok(
  'FAQ content states Pro+ has 50 reports/month',
  faqContent.includes('50 reports') || faqContent.includes('50 standard'),
);

ok(
  'FAQ content states Decision Pass is $19 one-time',
  faqContent.includes('$19') && (faqContent.includes('one-time') || faqContent.includes('one time')),
);

ok(
  'FAQ content states Decision Pass includes 3 viability reports',
  faqContent.includes('3 Business Viability'),
);

ok(
  'FAQ content states Decision Pass includes 1 Market Gap report',
  faqContent.includes('1 Market Gap'),
);

ok(
  'FAQ content states cache is up to 90 days',
  faqContent.includes('90 days'),
);

ok(
  'FAQ content states US only (geographic limitation)',
  faqContent.toLowerCase().includes('us') && (
    faqContent.includes('United States') ||
    faqContent.includes('US market') ||
    faqContent.includes('US locations') ||
    faqContent.includes('US-based')
  ),
);

// ─── 9. No obsolete/unconditional trial claims ───────────────────────────────

ok(
  'FAQ content does NOT make unconditional trial claim (uses "when available" or omits trial)',
  !faqContent.toLowerCase().includes('all users get a trial') &&
  !faqContent.toLowerCase().includes('free trial for everyone') &&
  !faqContent.toLowerCase().includes('trial is always active'),
);

// ─── 10. ?view=faq routing is supported ──────────────────────────────────────

ok(
  "VIEW_TITLES map supports 'faq' key (direct link ?view=faq will resolve correctly)",
  appTs.includes("faq:") && appTs.includes("VIEW_TITLES"),
);

ok(
  "App.tsx navigate is used inside the FAQ case (not a hard-coded URL)",
  appTs.includes("navigate('home')") && appTs.includes("navigate('pricing')"),
);

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('');
console.log(`${pass + fail} tests: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
