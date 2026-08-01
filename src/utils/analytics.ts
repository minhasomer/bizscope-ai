/**
 * Analytics utility — GA4 (Google Analytics 4) + Microsoft Clarity.
 *
 * Rules:
 * - Completely disabled when VITE_GA_MEASUREMENT_ID / VITE_CLARITY_PROJECT_ID are absent.
 * - Never loads on the server side (typeof window === 'undefined' guard).
 * - Analytics failures never interrupt BizScope — every operation is wrapped in try/catch.
 * - Each script loads exactly once.
 * - No PII, no user IDs, no Stripe IDs, no report text in any event.
 *
 * Do Not Track: DNT is checked but treated as advisory for product analytics.
 * GA4 receives only categorical data (plan tier, error_category enum, booleans).
 * No personal data is sent regardless of DNT setting. This policy is documented
 * in ANALYTICS_SETUP.md and disclosed in the Privacy Policy.
 *
 * Page-view strategy: Strategy B — manual SPA page_view events.
 * GA4 Enhanced Measurement auto page_view is disabled via send_page_view: false.
 * One page_view fires per view change via useEffect([currentView]) in App.tsx.
 */

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
    clarity: (command: string, ...args: unknown[]) => void;
  }
}

// Baked in at Vite build time — empty string when variable is absent.
const GA_ID: string = process.env.VITE_GA_MEASUREMENT_ID ?? '';
const CLARITY_ID: string = process.env.VITE_CLARITY_PROJECT_ID ?? '';

let gaInitialized = false;
let clarityInitialized = false;

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

// ─── GA4 loader ──────────────────────────────────────────────────────────────

function loadGA(): void {
  if (gaInitialized || !GA_ID || !isClient()) return;
  gaInitialized = true;

  // Set up dataLayer and the gtag function before the script loads so queued
  // events are not lost. gtag.js will process the queue on load.
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };

  // Configure GA4 — disable automatic page_view; we send manually.
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, {
    send_page_view: false,
    anonymize_ip: true,
  });

  // Inject the gtag.js script tag.
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
}

// ─── Clarity loader ───────────────────────────────────────────────────────────

function loadClarity(): void {
  if (clarityInitialized || !CLARITY_ID || !isClient()) return;
  clarityInitialized = true;

  // Clarity's standard init snippet (non-eval version).
  (window as any).clarity = (window as any).clarity || function () {
    ((window as any).clarity.q = (window as any).clarity.q || []).push(arguments);
  };

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${CLARITY_ID}`;
  const first = document.getElementsByTagName('script')[0];
  first?.parentNode?.insertBefore(script, first);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type EventParams = Record<string, string | number | boolean>;

/**
 * Initialize analytics. Call once on app mount.
 * Safe to call without IDs — both tools remain disabled.
 */
export function initAnalytics(): void {
  if (!isClient()) return;
  try {
    if (GA_ID) loadGA();
    if (CLARITY_ID) loadClarity();
  } catch {
    // Non-fatal — analytics must never interrupt the app.
  }
}

/**
 * Send a manual SPA page_view to GA4.
 * @param viewName  Internal view name (e.g. 'pricing', 'home')
 * @param title     Human-readable page title
 */
export function trackPageView(viewName: string, title: string): void {
  if (!isClient() || !GA_ID) return;
  try {
    // Construct a stable canonical URL for this view.
    const base = 'https://www.bizscope.app';
    const path = viewName === 'home' ? '/' : `/?view=${encodeURIComponent(viewName)}`;
    const pageLocation = `${base}${path}`;

    window.gtag('event', 'page_view', {
      page_location: pageLocation,
      page_path: path,
      page_title: title,
    });
  } catch {
    // Non-fatal.
  }
}

/**
 * Send a named event to GA4.
 * Params must contain ONLY non-sensitive categorical data.
 * Never include: names, emails, user IDs, Stripe IDs, report text, prompts.
 */
export function trackEvent(name: string, params?: EventParams): void {
  if (!isClient() || !GA_ID) return;
  try {
    window.gtag('event', name, params ?? {});
  } catch {
    // Non-fatal.
  }
}

/**
 * Whether GA4 is active in the current build.
 * Used in tests and to conditionally show analytics-related UI.
 */
export function isAnalyticsEnabled(): boolean {
  return !!GA_ID;
}

/** Whether Clarity is active in the current build. */
export function isClarityEnabled(): boolean {
  return !!CLARITY_ID;
}

/** Expose initialization state for testing. */
export function _testOnlyResetAnalytics(): void {
  gaInitialized = false;
  clarityInitialized = false;
}
