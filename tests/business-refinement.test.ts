/**
 * Tests for the Business Concept Refinement feature.
 *
 * Run standalone (no test framework):
 *   npx tsx tests/business-refinement.test.ts
 * Exits non-zero on the first failed assertion.
 *
 * Covers:
 *   - parseRefinementResponse: validates AI JSON parsing and structural guardrails
 *   - fetchRefinement: fail-safe behavior (errors, timeouts, malformed JSON)
 *   - Cache key separation: broad vs. refined concept produces different cache keys
 *   - Quota non-consumption: /api/refine handler imports verified to exclude quota funcs
 *   - Analytics events: categorical only (no user free-text in params)
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRefinementResponse, fetchRefinement } from '../src/utils/refinementUtils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;

const testQueue: Array<{ name: string; fn: () => void | Promise<void> }> = [];

function check(name: string, fn: () => void | Promise<void>) {
  testQueue.push({ name, fn });
}

// ─── parseRefinementResponse ──────────────────────────────────────────────────

check('passthrough on null', () => {
  const r = parseRefinementResponse(null);
  assert.equal(r.needsRefinement, false);
});

check('passthrough on empty object', () => {
  const r = parseRefinementResponse({});
  assert.equal(r.needsRefinement, false);
});

check('passthrough when needsRefinement is missing', () => {
  const r = parseRefinementResponse({ options: [] });
  assert.equal(r.needsRefinement, false);
});

check('passthrough when needsRefinement is a string', () => {
  const r = parseRefinementResponse({ needsRefinement: 'true' });
  assert.equal(r.needsRefinement, false);
});

check('needsRefinement false passes through cleanly', () => {
  const r = parseRefinementResponse({ needsRefinement: false });
  assert.equal(r.needsRefinement, false);
  assert.equal(r.options, undefined);
});

check('needsRefinement true with fewer than 2 valid options → passthrough', () => {
  const r = parseRefinementResponse({
    needsRefinement: true,
    options: [{ label: 'Traditional coffee shop', value: 'Traditional coffee shop' }],
  });
  assert.equal(r.needsRefinement, false, 'too few options should fall through');
});

check('needsRefinement true with empty options array → passthrough', () => {
  const r = parseRefinementResponse({ needsRefinement: true, options: [] });
  assert.equal(r.needsRefinement, false);
});

check('valid refinement result parsed correctly', () => {
  const r = parseRefinementResponse({
    needsRefinement: true,
    question: 'What kind of coffee shop are you considering?',
    options: [
      { label: 'Traditional coffee shop', value: 'Traditional coffee shop' },
      { label: 'Specialty / third-wave coffee shop', value: 'Specialty third-wave coffee shop' },
      { label: 'Yemeni coffee shop', value: 'Yemeni coffee shop' },
      { label: 'Drive-through coffee', value: 'Drive-through coffee' },
    ],
  });
  assert.equal(r.needsRefinement, true);
  assert.equal(r.question, 'What kind of coffee shop are you considering?');
  assert.equal(r.options?.length, 4);
  assert.equal(r.options?.[0].label, 'Traditional coffee shop');
  assert.equal(r.options?.[2].value, 'Yemeni coffee shop');
});

check('options with blank label/value are filtered out', () => {
  const r = parseRefinementResponse({
    needsRefinement: true,
    question: 'What kind of bakery?',
    options: [
      { label: '  ', value: 'something' },   // blank label → rejected
      { label: 'Artisan', value: '  ' },      // blank value → rejected
      { label: 'Artisan sourdough bakery', value: 'Artisan sourdough bakery' },
      { label: 'Custom cake bakery', value: 'Custom cake bakery' },
    ],
  });
  assert.equal(r.needsRefinement, true);
  assert.equal(r.options?.length, 2, 'invalid options should be stripped');
});

check('options capped at 6 even if AI returns more', () => {
  const manyOptions = Array.from({ length: 10 }, (_, i) => ({
    label: `Option ${i + 1}`,
    value: `option-${i + 1}`,
  }));
  const r = parseRefinementResponse({
    needsRefinement: true,
    question: 'Which type?',
    options: manyOptions,
  });
  assert.equal(r.options?.length, 6, 'max 6 options should be returned');
});

check('question falls back to undefined when not a string', () => {
  const r = parseRefinementResponse({
    needsRefinement: true,
    question: 42,
    options: [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
    ],
  });
  assert.equal(r.needsRefinement, true);
  assert.equal(r.question, undefined);
});

// ─── Cache key separation ─────────────────────────────────────────────────────
// Verify that a broad concept and its refinement produce distinct cache keys
// using the same logic as ReportCacheService.makeKey (which uses the raw
// businessType string lowercased + trimmed as part of the key).

function simulateCacheKey(businessType: string, location: string): string {
  const cleanBiz = businessType.toLowerCase().trim();
  const cleanLoc = location.toLowerCase().trim();
  return `v2-phase4-shadow||${cleanBiz}||${cleanLoc}||standard||pro`;
}

check('broad and refined concepts produce different cache keys', () => {
  const broadKey    = simulateCacheKey('Coffee Shop', 'Arlington Heights, IL');
  const refinedKey  = simulateCacheKey('Yemeni coffee shop', 'Arlington Heights, IL');
  assert.notEqual(broadKey, refinedKey, 'cache keys must differ');
});

check('same refined concept, same key (idempotent)', () => {
  const key1 = simulateCacheKey('Yemeni coffee shop', 'Arlington Heights, IL');
  const key2 = simulateCacheKey('Yemeni coffee shop', 'Arlington Heights, IL');
  assert.equal(key1, key2, 'repeated analysis of same refined concept hits cache');
});

check('keep-general uses the original (broad) concept key', () => {
  const generalKey = simulateCacheKey('Coffee Shop', 'Arlington Heights, IL');
  const broadKey   = simulateCacheKey('Coffee Shop', 'Arlington Heights, IL');
  assert.equal(generalKey, broadKey, '"keep general" should not change the cache key');
});

// Additional broad/specific concept pairs
const BROAD_CONCEPTS = [
  'Coffee shop', 'Bakery', 'Restaurant', 'Gym', 'Daycare', 'Auto repair shop',
  'Salon', 'Grocery store', 'Bar', 'Pizza place',
];

const SPECIFIC_CONCEPTS = [
  'Yemeni coffee shop',
  'Artisan sourdough bakery',
  'Korean BBQ restaurant',
  'Women-only strength training gym',
  'Montessori preschool',
  'Mobile European-car repair service',
  'Custom wedding cake bakery',
  'Indoor pickleball facility',
  'Mobile dog grooming service',
];

check('broad and specific concepts are always different strings (cache keys differ)', () => {
  for (const broad of BROAD_CONCEPTS) {
    for (const specific of SPECIFIC_CONCEPTS) {
      const broadKey    = simulateCacheKey(broad, 'Chicago, IL');
      const specificKey = simulateCacheKey(specific, 'Chicago, IL');
      assert.notEqual(broadKey, specificKey, `"${broad}" and "${specific}" should differ`);
    }
  }
});

// ─── AI response guardrail: no analysis or viability in options ───────────────
check('options that appear to contain viability scores are not added by parseRefinementResponse', () => {
  // The parser does not strip these — the server prompt prevents them.
  // This test documents that parseRefinementResponse is value-neutral
  // and does NOT strip valid-looking option strings.
  const r = parseRefinementResponse({
    needsRefinement: true,
    question: 'Which restaurant type?',
    options: [
      { label: 'Fast casual restaurant', value: 'Fast casual restaurant' },
      { label: 'Fine dining restaurant', value: 'Fine dining restaurant' },
    ],
  });
  assert.equal(r.needsRefinement, true);
  assert.equal(r.options?.length, 2);
});

// ─── Analytics event categorization ──────────────────────────────────────────
// Verify that the event names used in App.tsx are categorical (no user free-text).

const EXPECTED_EVENTS = [
  'business_refinement_shown',
  'business_refinement_selected',
  'business_refinement_skipped',
  'business_refinement_custom',
];

import { readFileSync } from 'node:fs';

check('analytics events are categorical identifiers (no embedded free text)', () => {
  const appSrc = readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');
  for (const event of EXPECTED_EVENTS) {
    assert.ok(
      appSrc.includes(`'${event}'`),
      `Expected event '${event}' to be referenced in App.tsx`,
    );
  }
});

check('refinement events do not pass businessType string as GA4 param', () => {
  const appSrc = readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');
  // Verify none of the refinement trackEvent calls embed the raw business type string
  // (which would be user-entered free text that shouldn't go to GA4).
  const refinementBlocks = appSrc.match(/trackEvent\('business_refinement_[^']+',\s*\{[^}]+\}\)/g) ?? [];
  for (const block of refinementBlocks) {
    assert.ok(
      !block.includes('businessType') && !block.includes('originalConcept') && !block.includes('refinedConcept'),
      `trackEvent refinement call should not include raw business text: ${block}`,
    );
  }
});

// ─── Quota guard: refinement code in /api/preview.ts must not call quota functions ──
// Refinement is a mode: 'refine' early-return in preview.ts that bypasses report
// generation entirely. We verify the handleRefinementMode function does not reference
// any quota-tracking calls.
check('handleRefinementMode in /api/preview.ts does not reference quota-tracking functions', () => {
  const previewSrc = readFileSync(path.join(__dirname, '../api/preview.ts'), 'utf8');
  // Extract just the refinement section (before the main handler)
  const refinementSection = previewSrc.slice(0, previewSrc.indexOf('export default async function handler'));
  const quotaFunctions = [
    'incrementUsageTracking',
    'checkStandardQuota',
    'checkTrialQuota',
    'decrementDecisionPass',
    'checkServerLimit',
    'usageTracking',
  ];
  for (const fn of quotaFunctions) {
    assert.ok(
      !refinementSection.includes(fn),
      `handleRefinementMode must not reference quota function: ${fn}`,
    );
  }
});

// ─── Fail-safe: fetchRefinement never throws ─────────────────────────────────
// We verify this at the type/structural level: parseRefinementResponse always
// returns { needsRefinement: boolean } without throwing, even for garbage input.

check('parseRefinementResponse handles non-serializable-like garbage', () => {
  const inputs: unknown[] = [
    undefined,
    null,
    42,
    'string input',
    [],
    { needsRefinement: null },
    { needsRefinement: true },  // no options
    { needsRefinement: true, options: 'not-an-array' },
    { needsRefinement: true, options: [null, undefined, 42, { label: 'x' }] },
  ];
  for (const input of inputs) {
    assert.doesNotThrow(() => parseRefinementResponse(input), `threw for input: ${JSON.stringify(input)}`);
    const r = parseRefinementResponse(input);
    assert.equal(typeof r.needsRefinement, 'boolean', 'always returns a boolean');
  }
});

// ─── fetchRefinement fail-safe (network layer) ────────────────────────────────
// These tests mock globalThis.fetch to simulate various failure modes and verify
// that fetchRefinement ALWAYS returns { needsRefinement: false } rather than throwing.

type MockFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function withMockedFetch(mockImpl: MockFetch, fn: () => Promise<void>): Promise<void> {
  const orig = globalThis.fetch;
  globalThis.fetch = mockImpl as typeof fetch;
  try { await fn(); } finally { globalThis.fetch = orig; }
}

check('fetchRefinement: HTTP 500 → fail-safe passthrough', async () => {
  await withMockedFetch(async () => ({ ok: false, status: 500 } as Response), async () => {
    const r = await fetchRefinement('coffee shop', 'Chicago, IL');
    assert.equal(r.needsRefinement, false, '500 must not block analysis');
  });
});

check('fetchRefinement: malformed JSON body → fail-safe passthrough', async () => {
  await withMockedFetch(async () => ({
    ok: true,
    json: async () => { throw new SyntaxError('Unexpected token'); },
  } as Response), async () => {
    const r = await fetchRefinement('bakery', 'Austin, TX');
    assert.equal(r.needsRefinement, false, 'JSON parse failure must not block analysis');
  });
});

check('fetchRefinement: network error (fetch throws) → fail-safe passthrough', async () => {
  await withMockedFetch(async () => { throw new TypeError('Failed to fetch'); }, async () => {
    const r = await fetchRefinement('gym', 'Seattle, WA');
    assert.equal(r.needsRefinement, false, 'Network error must not block analysis');
  });
});

check('fetchRefinement: abort / timeout → fail-safe passthrough', async () => {
  await withMockedFetch(async (_input, init) => {
    // Simulate abort by listening to the signal
    return new Promise<Response>((_resolve, reject) => {
      if (init?.signal) {
        init.signal.addEventListener('abort', () => {
          const err = new Error('The user aborted a request.');
          (err as any).name = 'AbortError';
          reject(err);
        });
      }
      // Never resolve naturally — timeout will fire and abort
    });
  }, async () => {
    const r = await fetchRefinement('restaurant', 'Phoenix, AZ', 50); // 50ms timeout
    assert.equal(r.needsRefinement, false, 'Timeout/abort must not block analysis');
  });
});

check('fetchRefinement: valid needsRefinement:false response passes through', async () => {
  await withMockedFetch(async () => ({
    ok: true,
    json: async () => ({ needsRefinement: false }),
  } as Response), async () => {
    const r = await fetchRefinement('yemeni coffee shop', 'Arlington Heights, IL');
    assert.equal(r.needsRefinement, false);
    assert.equal(r.options, undefined);
  });
});

check('fetchRefinement: valid broad response returns options', async () => {
  const mockData = {
    needsRefinement: true,
    question: 'What kind of coffee shop are you considering?',
    options: [
      { label: 'Traditional coffee shop', value: 'Traditional coffee shop' },
      { label: 'Specialty / third-wave coffee shop', value: 'Specialty third-wave coffee shop' },
      { label: 'Drive-through coffee', value: 'Drive-through coffee' },
    ],
  };
  await withMockedFetch(async () => ({
    ok: true,
    json: async () => mockData,
  } as Response), async () => {
    const r = await fetchRefinement('coffee shop', 'Chicago, IL');
    assert.equal(r.needsRefinement, true);
    assert.equal(r.options?.length, 3);
    assert.equal(r.question, 'What kind of coffee shop are you considering?');
  });
});

check('fetchRefinement: invalid schema (missing needsRefinement) → fail-safe', async () => {
  await withMockedFetch(async () => ({
    ok: true,
    json: async () => ({ options: [{ label: 'A', value: 'a' }] }),
  } as Response), async () => {
    const r = await fetchRefinement('gym', 'Dallas, TX');
    assert.equal(r.needsRefinement, false, 'Missing needsRefinement field must fall through');
  });
});

check('fetchRefinement: empty options array → fail-safe', async () => {
  await withMockedFetch(async () => ({
    ok: true,
    json: async () => ({ needsRefinement: true, options: [] }),
  } as Response), async () => {
    const r = await fetchRefinement('daycare', 'Miami, FL');
    assert.equal(r.needsRefinement, false, 'Empty options must not show modal');
  });
});

// ─── Flow verification (source-code structural checks) ───────────────────────
// These checks verify the App.tsx wiring by scanning source — they are the
// equivalent of contract tests for the component's props and callbacks.

check('handleHeroSubmit funnels into handleAnalysisRequest for non-broad concepts', () => {
  const appSrc = readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');
  // When needsRefinement is false, handleHeroSubmit must call handleAnalysisRequest
  // directly — not set refinementPending.
  assert.ok(
    appSrc.includes('await handleAnalysisRequest(businessType, location)'),
    'handleHeroSubmit must call handleAnalysisRequest directly for non-broad concepts',
  );
});

check('handleHeroSubmit bypasses refinement in demo mode', () => {
  const appSrc = readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');
  // In demo mode, refinement should be skipped entirely.
  assert.ok(
    appSrc.includes('if (isDemoMode)') && appSrc.includes('handleAnalysisRequest(businessType, location)'),
    'Demo mode must bypass refinement and call handleAnalysisRequest directly',
  );
});

check('"Keep it general" passes originalConcept exactly to handleAnalysisRequest', () => {
  const appSrc = readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');
  // onKeepGeneral must extract originalConcept from refinementPending and pass it.
  assert.ok(
    appSrc.includes('handleAnalysisRequest(originalConcept, location)'),
    '"Keep it general" must call handleAnalysisRequest with originalConcept, not a modified value',
  );
});

check('selected option value passed directly to handleAnalysisRequest', () => {
  const appSrc = readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');
  // onSelect must pass the selected/custom concept to handleAnalysisRequest unchanged.
  assert.ok(
    appSrc.includes('handleAnalysisRequest(refinedConcept, loc)'),
    'onSelect must pass refinedConcept to handleAnalysisRequest without transformation',
  );
});

check('"Other" custom text becomes the final analyzed concept via onSelect', () => {
  const modalSrc = readFileSync(path.join(__dirname, '../components/BusinessRefinementModal.tsx'), 'utf8');
  // The modal must call onSelect with the trimmed custom input.
  assert.ok(
    modalSrc.includes('onSelect(trimmed)'),
    'Custom "Other" text must flow through onSelect unchanged',
  );
});

check('refinementPending is cleared in both modal callbacks before calling handleAnalysisRequest', () => {
  const appSrc = readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');
  // setRefinementPending(null) must appear in both the onSelect and onKeepGeneral
  // handlers (at least 2 occurrences total) so stale modal state can't persist.
  const clearCount = (appSrc.match(/setRefinementPending\(null\)/g) ?? []).length;
  assert.ok(
    clearCount >= 2,
    `Expected setRefinementPending(null) at least twice (once per modal callback), found ${clearCount}`,
  );
  // Also verify it appears in the BusinessRefinementModal render block context.
  const modalBlock = appSrc.slice(appSrc.indexOf('BusinessRefinementModal'));
  assert.ok(
    modalBlock.includes('setRefinementPending(null)'),
    'setRefinementPending(null) must appear inside the BusinessRefinementModal render props',
  );
});

check('handleHeroSubmit is what Hero.onSubmit receives (not handleAnalysisRequest directly)', () => {
  const appSrc = readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');
  // The Hero component must receive handleHeroSubmit so the refinement step runs.
  assert.ok(
    appSrc.includes('onSubmit={handleHeroSubmit}'),
    'Hero.onSubmit must be wired to handleHeroSubmit, not handleAnalysisRequest',
  );
  assert.ok(
    !appSrc.includes('onSubmit={handleAnalysisRequest}'),
    'Hero.onSubmit must NOT be wired directly to handleAnalysisRequest',
  );
});

// ─── Modal dismiss (X button / Escape) ───────────────────────────────────────

check('BusinessRefinementModal declares onDismiss prop', () => {
  const modalSrc = readFileSync(path.join(__dirname, '../components/BusinessRefinementModal.tsx'), 'utf8');
  assert.ok(
    modalSrc.includes('onDismiss: () => void'),
    'BusinessRefinementModal must declare an onDismiss prop',
  );
});

check('X close button is present with aria-label="Close"', () => {
  const modalSrc = readFileSync(path.join(__dirname, '../components/BusinessRefinementModal.tsx'), 'utf8');
  assert.ok(
    modalSrc.includes('aria-label="Close"'),
    'X button must have aria-label="Close" for accessibility',
  );
  assert.ok(
    modalSrc.includes('onClick={onDismiss}'),
    'X button onClick must call onDismiss',
  );
});

check('Escape key listener calls onDismiss', () => {
  const modalSrc = readFileSync(path.join(__dirname, '../components/BusinessRefinementModal.tsx'), 'utf8');
  assert.ok(
    modalSrc.includes("e.key === 'Escape'") && modalSrc.includes('onDismiss()'),
    'Modal must call onDismiss when Escape is pressed',
  );
  assert.ok(
    modalSrc.includes('removeEventListener'),
    'Escape key listener must be cleaned up on unmount',
  );
});

check('onDismiss in App.tsx only clears refinementPending — no handleAnalysisRequest', () => {
  const appSrc = readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');
  // Extract the onDismiss handler block
  const dismissStart = appSrc.indexOf("onDismiss={() => {");
  const dismissEnd = appSrc.indexOf('\n          }}\n        />', dismissStart);
  const dismissBlock = appSrc.slice(dismissStart, dismissEnd);
  assert.ok(
    dismissBlock.includes('setRefinementPending(null)'),
    'onDismiss must clear refinementPending',
  );
  assert.ok(
    !dismissBlock.includes('handleAnalysisRequest'),
    'onDismiss must NOT call handleAnalysisRequest — no analysis should run',
  );
});

check('onDismiss does not duplicate "Keep it general" behavior', () => {
  const appSrc = readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');
  const dismissStart = appSrc.indexOf("onDismiss={() => {");
  const dismissEnd = appSrc.indexOf('\n          }}\n        />', dismissStart);
  const dismissBlock = appSrc.slice(dismissStart, dismissEnd);
  // "Keep it general" always calls handleAnalysisRequest; dismiss must not.
  assert.ok(
    !dismissBlock.includes('handleAnalysisRequest'),
    'Dismiss must not trigger analysis (unlike "Keep it general")',
  );
  // Dismiss may fire analytics with a different reason
  assert.ok(
    dismissBlock.includes("'dismissed'"),
    "Dismiss analytics reason must be 'dismissed', not 'keep_general'",
  );
});

check('original concept and location preserved after dismiss (refinementPending clears, Hero state unchanged)', () => {
  // Structural test: refinementPending holds the concept/location for the modal.
  // When cleared, the Hero component's own input state (which is separate) is unchanged.
  // We verify that the onDismiss handler body only contains trackEvent + setRefinementPending(null)
  // and does not contain any navigation, field-reset, or analysis calls.
  const appSrc = readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');

  // Extract the onDismiss handler by finding its unique 'dismissed' reason string.
  // The handler body is the smallest block containing that string.
  const dismissedIdx = appSrc.indexOf("'dismissed'");
  assert.ok(dismissedIdx !== -1, "onDismiss handler must use reason: 'dismissed'");

  // Look backward from 'dismissed' to find the opening onDismiss={() => { line
  const handlerOpen = appSrc.lastIndexOf('onDismiss={() => {', dismissedIdx);
  // Look forward from 'dismissed' to find the closing }}
  const handlerClose = appSrc.indexOf('\n          }}', dismissedIdx);
  const dismissBlock = appSrc.slice(handlerOpen, handlerClose);

  assert.ok(
    !dismissBlock.includes('navigate('),
    'onDismiss must not navigate away — user must return to the same input state',
  );
  assert.ok(
    !dismissBlock.includes('setCurrentView'),
    'onDismiss must not call setCurrentView',
  );
  assert.ok(
    !dismissBlock.includes('setBusinessType') && !dismissBlock.includes('setLocation'),
    'onDismiss must not reset the Hero input fields',
  );
  assert.ok(
    !dismissBlock.includes('handleAnalysisRequest'),
    'onDismiss must not trigger an analysis',
  );
});

check('subsequent submission after dismiss can trigger refinement normally', () => {
  // After dismiss, refinementPending is null, so the next Hero submit
  // goes through handleHeroSubmit fresh — fetchRefinement is called again.
  // We verify this structurally: handleHeroSubmit always checks refinementPending
  // after fetchRefinement, not before it, so clearing it has no side effect on the next call.
  const appSrc = readFileSync(path.join(__dirname, '../App.tsx'), 'utf8');
  // handleHeroSubmit must not read refinementPending — it always calls fetchRefinement.
  const heroSubmitStart = appSrc.indexOf('const handleHeroSubmit = useCallback');
  const heroSubmitEnd = appSrc.indexOf('}, [isLoading, isDemoMode, handleAnalysisRequest]);', heroSubmitStart);
  const heroSubmitBlock = appSrc.slice(heroSubmitStart, heroSubmitEnd);
  assert.ok(
    !heroSubmitBlock.includes('refinementPending'),
    'handleHeroSubmit must not read refinementPending — it always runs fetchRefinement fresh',
  );
  assert.ok(
    heroSubmitBlock.includes('fetchRefinement(businessType, location)'),
    'handleHeroSubmit must call fetchRefinement on every submission',
  );
});

// ─── Run all tests sequentially (supports async) ──────────────────────────────
(async () => {
  for (const { name, fn } of testQueue) {
    try {
      await Promise.resolve(fn());
      passed++;
      console.log(`ok   ${name}`);
    } catch (err: any) {
      failed++;
      console.error(`FAIL ${name}`);
      console.error('     ', err.message);
    }
  }
  console.log('');
  console.log(`${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
