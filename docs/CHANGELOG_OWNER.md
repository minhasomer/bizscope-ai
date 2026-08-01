# Owner Changelog

Operational milestone history for BizScope AI. Grouped by sprint, newest first. For the full commit-level log, run `git log --oneline`.

Audience: owner reference — what changed, when, and what to watch.

---

## 2026-07-31 — Analytics, SEO Baseline, and Trial CTA

**Milestone:** Production-ready analytics and SEO infrastructure landed on `staging`.

**What changed:**
- GA4 analytics with Strategy B manual `page_view` firing (no duplicate events on SPA navigation)
- Microsoft Clarity with comprehensive PII masking across all sensitive components
- UTM attribution via `sessionStorage` (survives OAuth redirects)
- Sitemap and robots.txt added to `public/`
- Google Search Console verification meta tag embedded in `index.html`
- Homepage hero "Start Free 7-Day Trial" CTA added (staging only)
- Privacy Policy Section 6 corrected to accurately describe analytics behavior

**Commits:** `1716624`, `31eceec`, `2445e05`, `fb0bec2`, `0e375db`

**What to watch:**
- Enable GA4 (`VITE_GA_MEASUREMENT_ID`) and Clarity (`VITE_CLARITY_PROJECT_ID`) in Vercel Production when ready. See `docs/ANALYTICS_AND_MARKETING.md`.
- Verify no PII appears in GA4 DebugView before enabling.

---

## 2026-07-30 — 7-Day Pro Trial (Complete)

**Milestone:** Full trial lifecycle validated on staging. Trial feature ready for Production activation.

**What changed:**
- 7-day free Pro trial implementation: `checkout.session.completed` sets `has_used_trial=true`, quota capped at 5 reports in `usage_tracking WHERE month_key='trial'`
- `PRO_TRIAL_ENABLED` server-side feature toggle; `VITE_PRO_TRIAL_ENABLED` client-side toggle
- Trial staging lifecycle fully tested end-to-end (Task 12 complete)
- Security hardening:
  - `protect_profile_columns` trigger: blocks authenticated clients from self-escalating `role`, `subscription_tier`, `has_used_trial` via anon key (`85661cd`)
  - `WITH CHECK` added to `saved_reports` UPDATE policy to prevent row-level bypass (`8428ebe`)
- `invoice.payment_succeeded` webhook fixed to not overwrite `trialing` status (`5d12289`)

**Commits:** `7da3c26`, `5d12289`, `080a57a`, `8428ebe`, `85661cd` and multiple staging fix commits

**What to watch:**
- To activate trial in Production: set `PRO_TRIAL_ENABLED=true` and `VITE_PRO_TRIAL_ENABLED=true` in Vercel Production env, then redeploy. See `docs/BILLING_AND_TRIALS.md`.
- The protect_profile_columns trigger is critical security infrastructure — do not remove it.

---

## 2026-07-29 — Regional Analysis + Quota Hardening

**Milestone:** Pro+ regional reports (Market Gap Explorer) fully operational.

**What changed:**
- Regional analysis endpoint (`/api/opportunities`) migrated from deprecated `gemini-2.5-pro` to `gemini-3.1-pro-preview`
- Quota enforcement fixed to apply to server-side cache hits (was previously bypassed)
- Explorer plan correctly permitted through to quota check (was accidentally blocked)
- Gemini pricing rates corrected in cost accounting tables

**Commits:** `06c8ca4`, `4574add`, `7d54ef0`, `9e721a9`, `d1be0d4`, `40578f6`

**What to watch:**
- `gemini-3.1-pro-preview` model IDs can change. If regional reports start returning 404 from Gemini, check the model ID in `api/opportunities.ts` against Google AI Studio.

---

## 2026-07-28 — Marketing Copy

**Milestone:** Differentiation messaging updated.

**What changed:**
- Homepage and marketing copy updated to clarify BizScope's position versus general-purpose AI tools

**Commits:** `f851cb5`

---

## 2026-07-18–24 — Full Stripe Integration

**Milestone:** End-to-end Stripe subscription management live on staging.

**What changed (in order):**
- `api/stripe/_shared.ts`: Stripe/Supabase singletons, `PRICE_TO_PLAN`, `PLAN_TO_DB_TIER`, webhook event RPC wrappers (`begin_stripe_event`, `complete_stripe_event`, `fail_stripe_event`)
- `api/stripe/webhook.ts`: handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`
- Subscription status, checkout, and portal session endpoints
- `subscriptions` table constraints and `stripe_event_log` migration applied
- SPA catch-all rewrite in `vercel.json` fixed to exclude `/api/*`
- `cancel_at` column added and cancellation-pending state derived correctly
- Missing `Explorer` tier in `PLAN_TO_DB_TIER` fixed (was causing `subscription.deleted` to fail)
- `invoice.payment_succeeded` guarded against overwriting newer subscriptions
- Billing page: stale date hidden for cancelled/free plans; portal button surfaced for active subscribers
- Subscription status derived from live API call (not stale session data)

**Commits:** `51f36ed`, `031e587`, `21bcec2`, `001acb1`, `c8c701a`, `5910d4a`, `63b9703`, `3cfc612`, `271bb16`, `d863c48`, `cf43e30`, `f44a898`, `b1f5f9f`, `a784aeb`, `b539100`

**What to watch:**
- `STRIPE_PRICE_ID_PRO` and `STRIPE_PRICE_ID_PRO_PLUS` must be set in Vercel Production for live checkout. Use live mode keys (`sk_live_...`) in Production.
- Webhook signing secret must match between Stripe Dashboard and `STRIPE_WEBHOOK_SECRET` env var.

---

## 2026-07-01 — Decision Framework UX

**Milestone:** Report recommendation display refactored to consistent action-oriented copy.

**What changed:**
- Raw `recommendation.decision` enum labels replaced with human-readable action-oriented text
- Decision framework display mapping consolidated into a single source

**Commits:** `fa76474`, `2f507ce`, `98027a1`

---

## 2026-06-29–30 — LinkedIn Beta Launch

**Milestone:** Soft beta launch announced publicly on LinkedIn.

**What changed:**
- Pre-beta polish across pricing page, logout flow, anonymous navigation badge
- Account-specific UI elements hidden from anonymous visitors
- Beta banner copy refined
- Closed beta signup gate enabled via `VITE_BETA_CLOSED` flag

**Commits:** `0740957`, `8bb033a`, `e122df4`, `27c77a7`, `2fb4eb8`, `5728711`, `0d62c11`

**What to watch:**
- `VITE_BETA_CLOSED` controls whether new signups are blocked. Remove or set to `false` when open to the public.

---

## 2026-06-23 — Pre-Launch Hardening

**Milestone:** Stability and reliability hardening before beta announcement.

**What changed:**
- Analysis timeout hardened (`maxDuration` set; synthesis given full deadline budget)
- Loading readability and long-wait messaging improved
- Cache transparency messaging added
- Terms-of-service acceptance gate added after authentication
- Contact sales navigation fixed
- Closed beta flag wired into Vite build
- Assessment color hierarchy and SVG badge components standardized

**Commits:** `5dc6133` (prod main SHA at this point), `cfc6fdc`, `a54d3f6`, `26943c4`, `032964d`, `662cfe7`, `b0b062f`, `cc346f8`, `b804c33`

---

## 2026-06-18–19 — Pre-Beta Audit + Cost Accounting + Scoreless UX

**Milestone:** Major audit sprint before beta launch.

**What changed:**
- Audit regression test suite added (`tests/audit-regression.test.ts`) with ~60 checks
- Scoreless UX enforcement: numeric viability scores removed from all report surfaces; prompt instructs models not to include scores in prose
- AI cost accounting completed: `usage_logs` table, hard-cap budget guard, cost tracking per report type
- Report consistency guardrails and assessment legend added
- Report verdict and recommendation hierarchy clarified
- PDF export aligned with report verdict hierarchy
- Billing beta-grant detection corrected (from live verification)
- Anonymous quota copy, signup-tab routing, and auth-lock flash fixed

**Commits:** `c7103f0`, `768df6ef`, `63290f0`, `82db3f0`, `ca5e0f6`, `b7fee86`, `8fefa15`, `7a2ff86`, `ee99f64`, `a2ab656`, `2ea4526`, `6dad3f7`, `87b153f`, `4faa7de`, `bea9126`, `57eef6f`

**What to watch:**
- Scores-in-prose is a prompt-level guard, not a code-level one. Periodically test that reports are not including numeric viability scores in their text sections.
- `usage_logs.within_hard_cap = false` rows indicate the hard cost budget was exceeded for that report. Query these periodically to track budget health.

---

## 2026-06-04–08 — Foundation (Supabase Schema)

**Milestone:** Database schema foundation established via migrations.

**Key migrations applied:**
- `profiles` with role/subscription_tier enum CHECK constraints
- `auth.users` trigger for auto-creating profile rows
- `saved_reports` with RLS policies
- `report_cache` for Gemini response deduplication

**Note:** The earliest commits pre-date this changelog's tracking. The `supabase/migrations/` directory contains the full schema history as SQL.

---

## How to Read This Changelog

This file tracks operational milestones — not every commit. For the full granular history:

```bash
git log --oneline
```

For changes to a specific file:

```bash
git log --oneline -- api/stripe/webhook.ts
```

For a specific commit's diff:

```bash
git show <SHA>
```
