/**
 * Tests for analytics.ts and attribution.ts utilities.
 * Run standalone: npx tsx tests/analytics.test.ts
 * Exits non-zero on the first failed assertion.
 *
 * GA_ID and CLARITY_ID are module-level constants that are read from
 * process.env at import time. We set the env vars here before dynamic-importing
 * the analytics module so the module initialises with non-empty IDs.
 */

import assert from 'node:assert/strict';

// ─── Set env vars BEFORE loading analytics module ─────────────────────────────
process.env.VITE_GA_MEASUREMENT_ID = 'G-TEST123456';
process.env.VITE_CLARITY_PROJECT_ID = 'testclarity00';

// ─── Browser environment mock ─────────────────────────────────────────────────

const injectedScripts: string[] = [];
const ssStore: Record<string, string> = {};

function setupMocks(locationSearch = '') {
  injectedScripts.length = 0;
  for (const k of Object.keys(ssStore)) delete ssStore[k];

  (global as any).window = {
    location: { href: 'https://www.bizscope.app/', search: locationSearch },
    dataLayer: [] as unknown[],
    gtag: undefined as any,
    clarity: undefined as any,
  };
  (global as any).document = {
    referrer: '',
    createElement: (_tag: string) => ({ src: '', async: false } as any),
    head: { appendChild: (el: any) => { injectedScripts.push(el.src); } },
    getElementsByTagName: () => [] as any,
  };
  (global as any).sessionStorage = {
    getItem: (k: string) => ssStore[k] ?? null,
    setItem: (k: string, v: string) => { ssStore[k] = v; },
    removeItem: (k: string) => { delete ssStore[k]; },
  };
}

// ─── Load modules after env vars are set ─────────────────────────────────────

setupMocks();

const {
  initAnalytics,
  trackEvent,
  trackPageView,
  isAnalyticsEnabled,
  isClarityEnabled,
  _testOnlyResetAnalytics,
} = await import('../src/utils/analytics');

const {
  captureAttribution,
  getAttribution,
  clearAttribution,
} = await import('../src/utils/attribution');

// ─── Test harness ─────────────────────────────────────────────────────────────

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  console.log(`  ✓ ${name}`);
  passed++;
}

// ─── analytics.ts ─────────────────────────────────────────────────────────────

console.log('\nanalytics.ts');

// 1.
check('isAnalyticsEnabled() returns true when GA ID env var is set', () => {
  assert.equal(isAnalyticsEnabled(), true);
});

// 2.
check('isClarityEnabled() returns true when Clarity ID env var is set', () => {
  assert.equal(isClarityEnabled(), true);
});

// 3.
check('initAnalytics() defines window.gtag', () => {
  setupMocks();
  _testOnlyResetAnalytics();
  initAnalytics();
  assert.equal(typeof (global as any).window.gtag, 'function');
});

// 4.
check('initAnalytics() initialises window.dataLayer as an array', () => {
  setupMocks();
  _testOnlyResetAnalytics();
  initAnalytics();
  assert.ok(Array.isArray((global as any).window.dataLayer));
});

// 5.
check('initAnalytics() configures GA4 with send_page_view: false', () => {
  setupMocks();
  _testOnlyResetAnalytics();
  initAnalytics();
  const dl: any[] = (global as any).window.dataLayer;
  const configCall = dl.find((e: any) => e[0] === 'config');
  assert.ok(configCall, 'gtag("config", ...) call not found in dataLayer');
  assert.equal(configCall[2]?.send_page_view, false);
});

// 6.
check('initAnalytics() configures GA4 with anonymize_ip: true', () => {
  setupMocks();
  _testOnlyResetAnalytics();
  initAnalytics();
  const dl: any[] = (global as any).window.dataLayer;
  const configCall = dl.find((e: any) => e[0] === 'config');
  assert.ok(configCall, 'gtag("config", ...) call not found in dataLayer');
  assert.equal(configCall[2]?.anonymize_ip, true);
});

// 7.
check('initAnalytics() injects GA4 script tag with correct src', () => {
  setupMocks();
  _testOnlyResetAnalytics();
  initAnalytics();
  assert.ok(
    injectedScripts.some(s => s.includes('googletagmanager.com/gtag/js?id=G-TEST123456')),
    `Expected GA4 script src. Got: ${JSON.stringify(injectedScripts)}`,
  );
});

// 8.
check('initAnalytics() does not inject GA4 script twice (idempotent)', () => {
  setupMocks();
  _testOnlyResetAnalytics();
  initAnalytics();
  const after1 = injectedScripts.filter(s => s.includes('googletagmanager')).length;
  initAnalytics(); // second call
  const after2 = injectedScripts.filter(s => s.includes('googletagmanager')).length;
  assert.equal(after1, after2);
});

// 9.
check('initAnalytics() defines window.clarity function', () => {
  setupMocks();
  _testOnlyResetAnalytics();
  initAnalytics();
  assert.equal(typeof (global as any).window.clarity, 'function');
});

// 10.
check('initAnalytics() is idempotent for Clarity (second call does not re-init)', () => {
  setupMocks();
  _testOnlyResetAnalytics();
  initAnalytics();
  const firstFn = (global as any).window.clarity;
  initAnalytics(); // second call — clarityInitialized guard fires, skipped
  assert.equal((global as any).window.clarity, firstFn);
});

// 11.
check('trackEvent() pushes event name and params to dataLayer via window.gtag', () => {
  setupMocks();
  _testOnlyResetAnalytics();
  initAnalytics();
  const dl: any[] = (global as any).window.dataLayer;
  const before = dl.length;
  trackEvent('plan_selected', { subscription_tier: 'Pro', trial_offered: true });
  const newEntries = dl.slice(before).filter((e: any) => e[0] === 'event');
  assert.ok(newEntries.length > 0, 'No event entries in dataLayer after trackEvent');
  assert.equal(newEntries[0][1], 'plan_selected');
  assert.equal(newEntries[0][2]?.subscription_tier, 'Pro');
  assert.equal(newEntries[0][2]?.trial_offered, true);
});

// 12.
check('trackEvent() passes empty params object when none provided', () => {
  setupMocks();
  _testOnlyResetAnalytics();
  initAnalytics();
  const dl: any[] = (global as any).window.dataLayer;
  const before = dl.length;
  trackEvent('pricing_viewed');
  const newEntries = dl.slice(before).filter((e: any) => e[0] === 'event');
  assert.ok(newEntries.length > 0, 'No event entries in dataLayer');
  assert.deepEqual({ ...newEntries[0][2] }, {});
});

// 13.
check('trackPageView() fires a page_view event', () => {
  setupMocks();
  _testOnlyResetAnalytics();
  initAnalytics();
  const dl: any[] = (global as any).window.dataLayer;
  const before = dl.length;
  trackPageView('pricing', 'Pricing — BizScope');
  const pageViews = dl.slice(before).filter((e: any) => e[0] === 'event' && e[1] === 'page_view');
  assert.ok(pageViews.length > 0, 'No page_view event in dataLayer');
});

// 14.
check("trackPageView() uses '/' as page_path for 'home' view", () => {
  setupMocks();
  _testOnlyResetAnalytics();
  initAnalytics();
  const dl: any[] = (global as any).window.dataLayer;
  const before = dl.length;
  trackPageView('home', 'BizScope — AI-Powered Business Viability Analysis');
  const pageViews = dl.slice(before).filter((e: any) => e[0] === 'event' && e[1] === 'page_view');
  assert.ok(pageViews.length > 0, 'No page_view event');
  assert.equal(pageViews[0][2]?.page_path, '/');
});

// 15.
check("trackPageView() uses '?view=pricing' as page_path for 'pricing' view", () => {
  setupMocks();
  _testOnlyResetAnalytics();
  initAnalytics();
  const dl: any[] = (global as any).window.dataLayer;
  const before = dl.length;
  trackPageView('pricing', 'Pricing — BizScope');
  const pageViews = dl.slice(before).filter((e: any) => e[0] === 'event' && e[1] === 'page_view');
  assert.ok(pageViews.length > 0, 'No page_view event');
  assert.equal(pageViews[0][2]?.page_path, '/?view=pricing');
});

// 16.
check('trackEvent() does not throw when window.gtag throws internally', () => {
  setupMocks();
  _testOnlyResetAnalytics();
  initAnalytics();
  (global as any).window.gtag = () => { throw new Error('gtag exploded'); };
  assert.doesNotThrow(() => trackEvent('test_event', { foo: 'bar' }));
});

// 21.
check("trackPageView('home') with UTM params → page_location includes utm_source", () => {
  setupMocks('?utm_source=meta&utm_medium=paid_social&utm_campaign=bizscope_aug2026&utm_content=video01');
  _testOnlyResetAnalytics();
  initAnalytics();
  const dl: any[] = (global as any).window.dataLayer;
  const before = dl.length;
  trackPageView('home', 'BizScope');
  const pv = dl.slice(before).find((e: any) => e[0] === 'event' && e[1] === 'page_view');
  assert.ok(pv, 'No page_view found');
  const loc: string = pv[2]?.page_location ?? '';
  assert.ok(loc.includes('utm_source=meta'), `Expected utm_source=meta in page_location. Got: ${loc}`);
  assert.ok(loc.includes('utm_medium=paid_social'), `Expected utm_medium in page_location. Got: ${loc}`);
  assert.ok(loc.includes('utm_campaign=bizscope_aug2026'), `Expected utm_campaign in page_location. Got: ${loc}`);
  assert.ok(loc.includes('utm_content=video01'), `Expected utm_content in page_location. Got: ${loc}`);
});

// 22.
check("trackPageView('home') with UTM params → page_path contains the UTM query string", () => {
  setupMocks('?utm_source=meta&utm_medium=paid_social');
  _testOnlyResetAnalytics();
  initAnalytics();
  const dl: any[] = (global as any).window.dataLayer;
  const before = dl.length;
  trackPageView('home', 'BizScope');
  const pv = dl.slice(before).find((e: any) => e[0] === 'event' && e[1] === 'page_view');
  const path: string = pv?.[2]?.page_path ?? '';
  assert.ok(path.startsWith('/?utm_source=meta'), `Expected path to start with /?utm_source=meta. Got: ${path}`);
});

// 23.
check("trackPageView('home') with sensitive auth params → sensitive params excluded from page_location", () => {
  setupMocks('?code=oauth-secret-code&access_token=tok123&utm_source=meta');
  _testOnlyResetAnalytics();
  initAnalytics();
  const dl: any[] = (global as any).window.dataLayer;
  const before = dl.length;
  trackPageView('home', 'BizScope');
  const pv = dl.slice(before).find((e: any) => e[0] === 'event' && e[1] === 'page_view');
  const loc: string = pv?.[2]?.page_location ?? '';
  assert.ok(!loc.includes('code='), `OAuth code must not appear in page_location. Got: ${loc}`);
  assert.ok(!loc.includes('access_token='), `access_token must not appear in page_location. Got: ${loc}`);
  assert.ok(loc.includes('utm_source=meta'), `UTM source must still be present. Got: ${loc}`);
});

// 24.
check("trackPageView('home') with fbclid → fbclid excluded, UTMs included", () => {
  setupMocks('?utm_source=meta&utm_medium=paid_social&fbclid=fbclid');
  _testOnlyResetAnalytics();
  initAnalytics();
  const dl: any[] = (global as any).window.dataLayer;
  const before = dl.length;
  trackPageView('home', 'BizScope');
  const pv = dl.slice(before).find((e: any) => e[0] === 'event' && e[1] === 'page_view');
  const loc: string = pv?.[2]?.page_location ?? '';
  assert.ok(!loc.includes('fbclid'), `fbclid must not appear in page_location. Got: ${loc}`);
  assert.ok(loc.includes('utm_source=meta'), `utm_source must be present. Got: ${loc}`);
});

// 25.
check("trackPageView('home') with no UTMs in URL → page_path is '/'", () => {
  setupMocks('?view=home');
  _testOnlyResetAnalytics();
  initAnalytics();
  const dl: any[] = (global as any).window.dataLayer;
  const before = dl.length;
  trackPageView('home', 'BizScope');
  const pv = dl.slice(before).find((e: any) => e[0] === 'event' && e[1] === 'page_view');
  assert.equal(pv?.[2]?.page_path, '/', `Expected '/' when no UTMs present`);
});

// ─── attribution.ts ───────────────────────────────────────────────────────────

console.log('\nattribution.ts');

// 17.
check('getAttribution() returns null when sessionStorage has no attribution', () => {
  setupMocks();
  assert.equal(getAttribution(), null);
});

// 18.
check('captureAttribution() stores UTM params from URL search string', () => {
  setupMocks('?utm_source=google&utm_medium=cpc&utm_campaign=launch&utm_content=ad1&utm_term=startup');
  captureAttribution();
  const result = getAttribution();
  assert.ok(result !== null, 'Expected attribution to be stored');
  assert.equal(result!.params.utm_source, 'google');
  assert.equal(result!.params.utm_medium, 'cpc');
  assert.equal(result!.params.utm_campaign, 'launch');
  assert.equal(result!.params.utm_content, 'ad1');
  assert.equal(result!.params.utm_term, 'startup');
  assert.ok(typeof result!.capturedAt === 'number' && result!.capturedAt > 0);
});

// 19.
check('captureAttribution() ignores non-UTM query params', () => {
  setupMocks('?foo=bar&baz=qux&utm_source=email');
  captureAttribution();
  const result = getAttribution();
  assert.ok(result !== null, 'Expected attribution to be stored');
  assert.equal(result!.params.utm_source, 'email');
  assert.equal((result!.params as any).foo, undefined);
  assert.equal((result!.params as any).baz, undefined);
});

// 20.
check('clearAttribution() removes stored attribution data', () => {
  setupMocks('?utm_source=twitter&utm_medium=social');
  captureAttribution();
  assert.ok(getAttribution() !== null, 'Attribution should be stored before clearing');
  clearAttribution();
  assert.equal(getAttribution(), null);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n✓ All ${passed} tests passed.\n`);
