# Analytics Setup

BizScope uses **Google Analytics 4 (GA4)** and **Microsoft Clarity** for privacy-conscious product analytics. Both are fully opt-in via environment variables — the app runs normally with no analytics when the variables are absent.

---

## Environment Variables

Add to `.env.local` (never commit real IDs):

```
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_CLARITY_PROJECT_ID=xxxxxxxxxx
```

Both are build-time variables injected via `vite.config.ts`. When either variable is blank or absent the corresponding service is silently skipped.

---

## GA4 Setup

1. Create a GA4 property at [analytics.google.com](https://analytics.google.com).
2. Copy the **Measurement ID** (format `G-XXXXXXXXXX`).
3. Set `VITE_GA_MEASUREMENT_ID` in your Vercel project environment (staging only until policy is approved for production).
4. **Disable Enhanced Measurement** in the GA4 data stream settings — BizScope fires manual `page_view` events; Enhanced Measurement would duplicate them.

### Page Views

`trackPageView(viewName, title)` is called in `App.tsx` inside a `useEffect([currentView])`. GA4 is initialized with `send_page_view: false` to prevent the automatic page_view on load.

### Events

| Event | Fired from | Key parameters |
|-------|-----------|----------------|
| `sign_up` | `AuthScreen.tsx` — after confirmed email signup | `method: 'email'` |
| `login` | `AuthScreen.tsx` — after confirmed email login | `method: 'email'` |
| `pricing_viewed` | `App.tsx` — on navigation to `pricing` view | — |
| `plan_selected` | `App.tsx` — `handleCheckout()` before Stripe redirect | `subscription_tier`, `trial_offered` |
| `begin_checkout` | `App.tsx` — after confirmed Stripe checkout URL | `subscription_tier`, `trial_offered`, `source_page` |
| `viability_report_started` | `App.tsx` — `runAnalysis()` / `runAnonymousPreview()` | `subscription_tier`, `authenticated` |
| `viability_report_completed` | `App.tsx` — after report returned | `subscription_tier`, `authenticated`, `cached` |
| `viability_report_failed` | `App.tsx` — on error | `subscription_tier`, `authenticated`, `error_category` |
| `market_gap_started` | `OpportunityExplorer.tsx` | `subscription_tier`, `authenticated`, `source_page` |
| `market_gap_completed` | `OpportunityExplorer.tsx` | `subscription_tier`, `authenticated`, `cached` |
| `market_gap_failed` | `OpportunityExplorer.tsx` | `subscription_tier`, `authenticated`, `error_category` |
| `report_limit_reached` | `App.tsx` / `OpportunityExplorer.tsx` | `report_type`, `subscription_tier` |

**`error_category` values** (controlled enum — raw error messages are never sent):
- `network_interruption`
- `configuration_error`
- `api_error`
- `quota_exceeded`

### Deferred Events

The following subscription lifecycle events (`trial_started`, `subscription_activated`, `subscription_canceled`, `payment_failed`, `payment_recovered`) require GA4 Measurement Protocol server-side integration. They are not implemented in this release because the Stripe webhook handler runs in a serverless Vercel function that cannot reliably load the GA4 client library, and adding Measurement Protocol would require secret key management. These events should be implemented in a future sprint.

Google OAuth `sign_up` / `login` distinction is also deferred — Supabase's `SIGNED_IN` event fires for both new and returning OAuth users, making them indistinguishable client-side.

---

## Microsoft Clarity Setup

1. Create a project at [clarity.microsoft.com](https://clarity.microsoft.com).
2. Copy the **Project ID** (alphanumeric, ~10 chars).
3. Set `VITE_CLARITY_PROJECT_ID` in Vercel environment.

Clarity is initialized via `initAnalytics()` in `App.tsx`. It loads asynchronously and does not block rendering.

### Privacy Masking

`data-clarity-mask="True"` is applied to the following containers, which masks all text content from session recordings:

| Component | Masked area |
|-----------|------------|
| `AuthScreen.tsx` | All three rendered states: main form, ambiguous-signup screen (shows email), email-pending screen (shows email) |
| `Hero.tsx` | Business idea and location input grid |
| `ReportDisplay.tsx` | Entire report output |
| `OpportunityExplorer.tsx` | Report results section (market gap output) |
| `BillingPage.tsx` | Entire billing page |
| `AccountSettings.tsx` | Entire account settings page |
| `SavedReports.tsx` | Business name / location in report cards |

---

## UTM Attribution

`captureAttribution()` runs on app mount (before `initAnalytics()`). It reads `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and `utm_term` from the URL and stores them in `sessionStorage['bizscope_attr']`.

- Only printable ASCII, max 256 chars per value — malformed values are dropped.
- Referrer is stored as origin only (no path/query).
- Attribution survives OAuth and Stripe redirects within the same browser session.
- GA4's `_ga` cookie handles session stitching across same-origin redirects automatically.

---

## Prohibited Data

The following must **never** be sent to GA4 or Clarity:

- User names, email addresses, Supabase user IDs
- Stripe customer IDs, subscription IDs, payment method IDs
- Auth tokens or session cookies
- Business descriptions, report prompts, report text
- Business names entered by users
- ZIP codes or addresses tied to specific users
- Raw error messages (use the controlled `error_category` enum instead)

---

## Enabling on Production

Analytics variables are currently **absent from production** (`.env.production` has no analytics keys). Before enabling on production:

1. Confirm the Privacy Policy update (section 6 — Analytics & Session Recording) is live.
2. Verify no PII leaks in a staging GA4 property (use DebugView in GA4).
3. Add `VITE_GA_MEASUREMENT_ID` and `VITE_CLARITY_PROJECT_ID` to the Vercel **Production** environment.
4. Redeploy.

---

## Files Changed

| File | Change |
|------|--------|
| `src/utils/analytics.ts` | New — GA4 + Clarity loader, event helpers |
| `src/utils/attribution.ts` | New — UTM capture + sessionStorage helpers |
| `vite.config.ts` | Added `define` entries for analytics env vars |
| `App.tsx` | `initAnalytics`, `captureAttribution`, page view tracking, checkout events, report funnel events |
| `components/AuthScreen.tsx` | `sign_up` / `login` events, Clarity masking on all three render states |
| `components/Hero.tsx` | Clarity masking on business idea and location inputs |
| `components/OpportunityExplorer.tsx` | Market gap funnel events, Clarity masking |
| `components/ReportDisplay.tsx` | Clarity masking |
| `components/BillingPage.tsx` | Clarity masking |
| `components/AccountSettings.tsx` | Clarity masking |
| `components/SavedReports.tsx` | Clarity masking on sensitive card fields |
| `public/robots.txt` | New — allows all crawlers, references sitemap |
| `public/sitemap.xml` | New — public pages only |
| `index.html` | Added canonical URL and `og:url` |
| `.env.example` | Documented analytics variables |
