# Analytics and Marketing

GA4, Microsoft Clarity, SEO, and UTM attribution for BizScope AI.

---

## GA4 Property

GA4 is used for product analytics: traffic, funnel events, plan selections, and report generation.

- Measurement ID format: `G-XXXXXXXXXX` (do NOT record the real ID in this file)
- Configured via `VITE_GA_MEASUREMENT_ID` in Vercel environment variables
- Completely disabled when the variable is absent (local dev default)
- Enhanced Measurement is **disabled** in the GA4 data stream settings — BizScope fires manual `page_view` events; enabling Enhanced Measurement would duplicate them

---

## Manual SPA Page View Strategy (Strategy B)

BizScope is a single-page application that uses `?view=` query parameter routing (not a traditional multi-page URL structure). Strategy B is used for page view tracking:

- GA4 is initialized with `send_page_view: false` in the `gtag('config', ...)` call
- One manual `page_view` event fires per view change via `trackPageView()` in the `useEffect([currentView])` hook in `App.tsx`
- This prevents the automatic page_view from firing on initial load AND prevents duplicates on SPA navigation

**Why Strategy B:** The GA4 Enhanced Measurement auto page_view fires once on load for any URL. SPA navigation via `history.pushState` (which BizScope uses for the Back button) does not trigger another Enhanced Measurement page_view. Strategy B fires exactly one `page_view` per navigation, including initial load, internal navigation, and browser Back/Forward.

**GA4 initialization order:**
1. `captureAttribution()` — reads UTM params from URL and stores in `sessionStorage`
2. `initAnalytics()` — loads GA4 gtag.js script and Clarity script
3. `useEffect([currentView])` fires → `trackPageView(currentView, title)` fires first `page_view`

A `gaInitialized` module-level guard prevents `initAnalytics()` from loading the GA4 script twice.

---

## Implemented GA4 Events

All events are verified from `src/utils/analytics.ts`, `App.tsx`, and `components/OpportunityExplorer.tsx`. Parameters contain only non-sensitive categorical data — no names, emails, user IDs, Stripe IDs, or report text.

| Event Name | Fired From | Key Parameters |
|---|---|---|
| `page_view` | `App.tsx` — `useEffect([currentView])` | `page_location`, `page_path`, `page_title` |
| `pricing_viewed` | `App.tsx` — same `useEffect`, when `currentView === 'pricing'` | — |
| `sign_up` | `components/AuthScreen.tsx` — after confirmed email signup | `method: 'email'` |
| `login` | `components/AuthScreen.tsx` — after confirmed email login | `method: 'email'` |
| `plan_selected` | `App.tsx` — `handleCheckout()` on click intent | `subscription_tier`, `source_page`, `trial_offered`, `authenticated` |
| `begin_checkout` | `App.tsx` — after confirmed Stripe checkout URL returned | `subscription_tier`, `trial_offered`, `source_page` |
| `viability_report_started` | `App.tsx` — `runAnalysis()` / `runAnonymousPreview()` | `report_type`, `subscription_tier`, `authenticated`, `source_page` |
| `viability_report_completed` | `App.tsx` — after report returned | `report_type`, `subscription_tier`, `authenticated`, `cached` |
| `viability_report_failed` | `App.tsx` — on error | `report_type`, `subscription_tier`, `authenticated`, `error_category` |
| `market_gap_started` | `components/OpportunityExplorer.tsx` | `subscription_tier`, `authenticated`, `source_page` |
| `market_gap_completed` | `components/OpportunityExplorer.tsx` | `subscription_tier`, `authenticated`, `cached` |
| `market_gap_failed` | `components/OpportunityExplorer.tsx` | `subscription_tier`, `authenticated`, `error_category` |
| `report_limit_reached` | `App.tsx` / `components/OpportunityExplorer.tsx` | `report_type`, `subscription_tier`, `authenticated` |

### `error_category` enum values (controlled — raw error messages are never sent)
- `network_interruption`
- `configuration_error`
- `api_error`
- `quota_exceeded`

---

## Intentionally Deferred GA4 Events

The following events are not implemented and should be added in a future sprint:

| Deferred Event | Reason |
|---|---|
| `trial_started` | Stripe lifecycle events require GA4 Measurement Protocol (server-side). The Vercel webhook function cannot reliably use the GA4 client library. |
| `subscription_activated` | Same — server-side lifecycle, Measurement Protocol needed |
| `subscription_canceled` | Same |
| `payment_failed` | Same |
| `payment_recovered` | Same |
| Google OAuth `sign_up` / `login` distinction | Supabase's `SIGNED_IN` event fires for both new and returning OAuth users; they are indistinguishable client-side |

---

## Key Events to Mark in GA4

After events propagate to GA4 (within 24 hours of first fire), mark these as Key Events in GA4 → Admin → Events:

- `sign_up`
- `begin_checkout`
- `viability_report_started`
- `viability_report_completed`

---

## Prohibited Data in GA4 / Clarity

Never send:
- User names, email addresses, Supabase user IDs
- Stripe customer IDs, subscription IDs, payment method IDs
- Auth tokens or session cookies
- Business descriptions, report prompts, or report text
- Business names or locations tied to specific users
- Raw error messages (use the `error_category` enum only)

---

## Microsoft Clarity

Clarity provides session recording and heatmaps for UX analysis.

- Project ID format: alphanumeric string (~10 characters) — do NOT record the real ID in this file
- Configured via `VITE_CLARITY_PROJECT_ID` in Vercel env
- Completely disabled when the variable is absent
- Loads asynchronously; does not block rendering

### Clarity Masking Inventory

`data-clarity-mask="True"` is applied to the following components. All text content within these containers is masked from session recordings.

| Component | Masked Area | Why |
|---|---|---|
| `components/AuthScreen.tsx` | All three rendered states: main form, ambiguous-signup screen (shows email), email-pending screen (shows email) | Auth inputs and email addresses must not appear in recordings |
| `components/Hero.tsx` | Business idea and location input grid | User's business concept is PII-adjacent |
| `components/ReportDisplay.tsx` | Entire report output | Report contains business details entered by user |
| `components/OpportunityExplorer.tsx` | Report results section (market gap output) | Same as above |
| `components/BillingPage.tsx` | Entire billing page | Shows subscription details and customer identifiers |
| `components/AccountSettings.tsx` | Entire account settings page | Shows email and profile data |
| `components/SavedReports.tsx` | Business name / location in report cards | User-entered business data |

---

## UTM Attribution

`captureAttribution()` (in `src/utils/attribution.ts`) runs on app mount before `initAnalytics()`. It reads standard UTM parameters from the URL and stores them in `sessionStorage['bizscope_attr']`.

**Captured parameters:** `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`

**Privacy protections:**
- Only printable ASCII, max 256 chars per value — malformed values are dropped
- Referrer stored as origin only (no path or query that might contain sensitive data)
- `sessionStorage` lifetime = browser tab (not indefinite like `localStorage`)
- Attribution survives Google OAuth and Stripe Checkout redirects within the same browser session

**GA4 session stitching:** GA4's `_ga` cookie handles session continuity across same-origin redirects automatically. The `sessionStorage` UTM data is supplementary for custom attribution if needed.

---

## Recommended Campaign URL Format

```
https://example.com/?utm_source=<source>&utm_medium=<medium>&utm_campaign=<campaign>&utm_content=<variant>
```

Common values:
- `utm_source`: `google`, `facebook`, `twitter`, `email`, `newsletter`
- `utm_medium`: `cpc`, `social`, `email`, `organic`
- `utm_campaign`: `launch`, `trial-promo`, `retargeting`
- `utm_content`: `hero-cta`, `sidebar-banner`, `pricing-link`

Example campaign URLs (use your actual domain, not `example.com`):
```
# Google Ads — trial promotion
/?utm_source=google&utm_medium=cpc&utm_campaign=trial-promo&utm_content=search-ad

# Email newsletter — feature announcement
/?utm_source=newsletter&utm_medium=email&utm_campaign=feature-launch&utm_content=header-link

# Social media — organic post
/?utm_source=twitter&utm_medium=social&utm_campaign=launch&utm_content=organic-post
```

---

## Search Console

- Search Console property: `https://www.bizscope.app/`
- Verification method: HTML meta tag in `index.html` (in the `<head>` section)
- Why not GA4 verification: GA4 analytics-based verification requires the GA4 tag to be active on the page at the time of verification. For SPAs this can be unreliable. The meta tag method is always present regardless of analytics state.
- Sitemap submitted: `https://www.bizscope.app/sitemap.xml`

---

## Sitemap

Location: `public/sitemap.xml`

Current entries:
- `https://www.bizscope.app/` (priority 1.0, weekly)
- `https://www.bizscope.app/?view=pricing` (priority 0.9, weekly)
- `https://www.bizscope.app/?view=privacy` (priority 0.4, monthly)
- `https://www.bizscope.app/?view=terms` (priority 0.4, monthly)
- `https://www.bizscope.app/?view=contact` (priority 0.5, monthly)

---

## robots.txt

Location: `public/robots.txt`

```
User-agent: *
Allow: /

Sitemap: https://www.bizscope.app/sitemap.xml
```

All crawlers are permitted. The sitemap is referenced.

---

## Metrics to Monitor Before Scaling Ad Spend

1. **Signup conversion rate** — `sign_up` events / total sessions. Baseline this before spending.
2. **Preview-to-signup rate** — sessions with `viability_report_completed (type=preview)` → `sign_up`
3. **Checkout start rate** — `begin_checkout` / `pricing_viewed`
4. **Report generation success rate** — `viability_report_completed` / `viability_report_started` (catch Gemini errors early)
5. **Quota exhaustion rate** — `report_limit_reached` / `viability_report_started` per plan tier (high rate on Explorer may indicate upsell opportunity)
6. **Core Web Vitals** (in GA4 → Reports → Experience → Web Vitals) before paying for traffic

---

## Enabling Analytics on Production

Analytics variables are currently absent from the production Vercel environment. Before enabling:

1. Confirm the Privacy Policy analytics section is live at `https://www.bizscope.app/?view=privacy`
2. Verify no PII leaks using GA4 DebugView on the staging environment first
3. Add `VITE_GA_MEASUREMENT_ID` and `VITE_CLARITY_PROJECT_ID` to Vercel **Production** environment
4. Trigger a Vercel Production redeployment
5. Verify events appear in GA4 Real-time within 30 seconds of visiting the site
