# BizScope Owner Reference Manual

> **The one document to open when you need to operate or maintain BizScope.**
> For deep technical detail, see the [detailed documentation index](#appendix-b-detailed-documentation-index).

**Last reviewed:** 2026-07-31
**Production:** https://www.bizscope.app
**Staging:** https://bizscope-ai-git-staging-omer-minhas-projects.vercel.app

---

## Table of Contents

1. [Quick System Overview](#1-quick-system-overview)
2. [Important Links](#2-important-links)
3. [Daily and Weekly Checks](#3-daily-and-weekly-checks)
4. [How to Count Users](#4-how-to-count-users)
5. [How to Find a User](#5-how-to-find-a-user)
6. [How to Grant Complimentary Pro](#6-how-to-grant-complimentary-pro)
7. [How to Grant Complimentary Pro+](#7-how-to-grant-complimentary-pro)
8. [How to Return a User to Explorer](#8-how-to-return-a-user-to-explorer)
9. [How to Check Active Trials](#9-how-to-check-active-trials)
10. [How to Check Paid Subscriptions](#10-how-to-check-paid-subscriptions)
11. [How to Check Failed Payments](#11-how-to-check-failed-payments)
12. [How to Check Report Usage](#12-how-to-check-report-usage)
13. [How to Check AI Costs](#13-how-to-check-ai-costs)
14. [How to Turn the Trial On or Off](#14-how-to-turn-the-trial-on-or-off)
15. [How to Check Stripe](#15-how-to-check-stripe)
16. [How to Check Supabase](#16-how-to-check-supabase)
17. [How to Check Vercel](#17-how-to-check-vercel)
18. [How to Check GA4](#18-how-to-check-ga4)
19. [How to Check Clarity](#19-how-to-check-clarity)
20. [How to Check Search Console](#20-how-to-check-search-console)
21. [How to Deploy Safely](#21-how-to-deploy-safely)
22. [How to Roll Back](#22-how-to-roll-back)
23. [What to Do If the Site Is Down](#23-what-to-do-if-the-site-is-down)
24. [What to Do If Payments Fail](#24-what-to-do-if-payments-fail)
25. [What to Do If Users Have the Wrong Plan](#25-what-to-do-if-users-have-the-wrong-plan)
26. [Backup and Recovery Checklist](#26-backup-and-recovery-checklist)
27. [Key Environment Variables](#27-key-environment-variables)
28. [Common Safe SQL Queries](#28-common-safe-sql-queries)
29. [Things Never to Change Casually](#29-things-never-to-change-casually)
30. [Monthly Maintenance Checklist](#30-monthly-maintenance-checklist)

Appendices:
- [Appendix A: One-Page Quick Reference](#appendix-a-one-page-quick-reference)
- [Appendix B: Detailed Documentation Index](#appendix-b-detailed-documentation-index)

---

## 1. Quick System Overview

BizScope AI is a SaaS product that helps entrepreneurs and founders assess the business viability of a new idea. Users enter a business type and location; the app calls Google Gemini to generate a structured viability report covering market conditions, financials, risks, and competitor analysis. Reports are gated by plan. Users subscribe via Stripe.

| Layer | What it does | Where to manage it |
|---|---|---|
| Frontend | React web app (SPA, `?view=` routing) | Vercel |
| Database + Auth | User accounts, plans, usage tracking, report data | Supabase |
| Payments | Subscriptions, trials, billing portal, invoices | Stripe |
| AI Engine | Generates viability and regional intelligence reports | Google AI Studio (Gemini) |
| Email | Transactional email (contact form) | Resend |
| Analytics | Traffic, funnel events, session recordings | GA4 + Microsoft Clarity |
| Hosting | Deploys and serves the app (static + serverless) | Vercel |

**Plans:**

| Plan | Price | Standard Reports/Month | Regional Reports/Month |
|---|---|---|---|
| Explorer | Free | 3 | 0 (locked) |
| Pro | $29/month | 20 | 0 (locked) |
| Pro+ | $59/month | 50 | 10 |
| Enterprise | Custom | Unlimited | Unlimited |

Trial: 7-day free Pro trial (5 reports total during trial). One trial per user, payment method required upfront.

---

## 2. Important Links

| System | URL | Purpose |
|---|---|---|
| Production app | https://www.bizscope.app | Live site |
| Staging app | https://bizscope-ai-git-staging-omer-minhas-projects.vercel.app | Test environment |
| GitHub | https://github.com/minhasomer/bizscope-ai | Source code |
| Vercel dashboard | https://vercel.com/omer-minhas-projects/bizscope-ai | Deployments, logs, env vars |
| Supabase dashboard | https://app.supabase.com/ | Database, auth, SQL editor |
| Stripe dashboard | https://dashboard.stripe.com/ | Payments, subscriptions |
| GA4 | https://analytics.google.com/ | Web analytics |
| Clarity | https://clarity.microsoft.com/ | Session recordings |
| Search Console | https://search.google.com/search-console/ | SEO performance |
| Google AI Studio | https://aistudio.google.com/ | Gemini API keys and usage |
| Resend | https://resend.com/ | Email delivery logs |

---

## 3. Daily and Weekly Checks

### Daily (5 minutes)

1. Check Vercel dashboard for any failed Production deployments (Vercel → Deployments → verify green status).
2. Check Stripe → Payments → Failed for any payment failures in the last 24 hours.
3. Check Stripe → Webhooks → Recent Deliveries for any failed webhook events.
4. Check Supabase → Logs → Edge Functions for unusual error rates.
5. If GA4 is enabled: check GA4 Realtime to confirm events are flowing.

### Weekly (15 minutes)

1. Run the past-due subscriptions query (Section 11) to check for stuck accounts.
2. Run the AI cost summary query (Section 13) to confirm Gemini spend is on track.
3. Check for trials ending in the next 7 days (Section 9) — consider a manual outreach if conversion looks low.
4. Review Vercel → Analytics → Functions for any sustained error rates.
5. Check Clarity for rage clicks or navigation confusion on the hero/pricing pages.
6. Check Search Console → Index Coverage for any crawl errors.

---

## 4. How to Count Users

1. Go to https://app.supabase.com/ and open your project.
2. Click **SQL Editor** in the left sidebar.
3. Run:

```sql
-- Total users
SELECT COUNT(*) AS total_users FROM public.profiles;

-- Signups by day (last 30 days)
SELECT
  DATE(created_at AT TIME ZONE 'UTC') AS signup_date,
  COUNT(*) AS signups
FROM public.profiles
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1 DESC;
```

---

## 5. How to Find a User

1. Go to Supabase → SQL Editor.
2. Run the query below, replacing `friend@example.com` with the real email:

```sql
-- Find user by email
SELECT
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.subscription_tier,
  p.has_used_trial,
  p.tos_accepted_at,
  p.created_at,
  s.plan        AS stripe_plan,
  s.status      AS stripe_status,
  s.trial_started_at,
  s.trial_ends_at,
  s.current_period_end,
  s.cancel_at_period_end
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id
WHERE p.email = 'friend@example.com';
```

**Column meaning:**

| Column | Meaning |
|---|---|
| `role` | Determines special access overrides. Values below. |
| `subscription_tier` | Drives feature gating. Values below. |
| `has_used_trial` | `true` means the user already used their 7-day trial and cannot start another. |
| `stripe_status` | Current Stripe subscription status: `active`, `trialing`, `past_due`, `cancelled`. If NULL, no Stripe subscription exists. |

**Valid `role` values:**

| Value | Meaning |
|---|---|
| `Explorer` | Normal registered user — no special override |
| `Pro` | Not typically used for role; subscription_tier carries the plan |
| `ProPlus` | Not typically used for role; subscription_tier carries the plan |
| `Enterprise` | Not typically used for role; subscription_tier carries the plan |
| `BetaTester` | Grants effective Pro+ access via `getEffectivePlan()` regardless of subscription_tier |
| `Admin` | Grants effective Enterprise access; also shows DevAdminPanel in the UI |

**Valid `subscription_tier` values (DB enum):**

| DB value | UI display | Who has it |
|---|---|---|
| `Explorer` | Explorer | Free registered users; default |
| `Pro` | Pro | Active Pro subscribers; trialing users; complimentary Pro grants |
| `ProPlus` | Pro+ | Active Pro+ subscribers; complimentary Pro+ grants (note: Stripe writes `ProPlus`, never `Pro+`) |
| `Enterprise` | Enterprise | Enterprise customers or complimentary grants |
| `BetaTester` | — | Not used for subscription_tier in practice |
| `Admin` | — | Not used for subscription_tier in practice |

---

## 6. How to Grant Complimentary Pro

This gives Pro access without requiring payment. The user will not be charged. No Stripe subscription is created. Access persists until explicitly revoked.

**Warning — ADMINISTRATIVE WRITE.** Always run the verification SELECT first. Confirm you see the right user before running the UPDATE.

```sql
-- Step 1: Verify first
SELECT id, email, role, subscription_tier
FROM public.profiles
WHERE email = 'friend@example.com';

-- Step 2: Grant Pro (only run after confirming Step 1 shows the right user)
-- Replace friend@example.com with the actual email.
-- service_role key required (Supabase SQL Editor uses it automatically).
UPDATE public.profiles
SET
  role              = 'Pro',
  subscription_tier = 'Pro',
  updated_at        = NOW()
WHERE email = 'friend@example.com'
RETURNING id, email, role, subscription_tier, updated_at;
```

Step 3: Verify by running the find-user query from Section 5.

**This is a complimentary grant, not a Stripe subscription.** The Stripe Customer Portal button will not appear for this user. This access will not appear in Stripe. It persists until you explicitly revert it (see Section 8).

---

## 7. How to Grant Complimentary Pro+

Same as Section 6 but grants Pro+ instead. The DB enum value is `ProPlus` — never write `Pro+` directly to the database.

**Warning — ADMINISTRATIVE WRITE.** Always run the verification SELECT first.

```sql
-- Step 1: Verify first
SELECT id, email, role, subscription_tier
FROM public.profiles
WHERE email = 'friend@example.com';

-- Step 2: Grant Pro+ (only run after confirming Step 1 shows the right user)
-- Note: DB enum is 'ProPlus' — not 'Pro+'. The webhook uses PLAN_TO_DB_TIER
-- to translate 'Pro+' → 'ProPlus' before writing. We do the same here manually.
-- service_role key required.
UPDATE public.profiles
SET
  role              = 'ProPlus',
  subscription_tier = 'ProPlus',
  updated_at        = NOW()
WHERE email = 'friend@example.com'
RETURNING id, email, role, subscription_tier, updated_at;
```

Step 3: Verify by running the find-user query from Section 5.

---

## 8. How to Return a User to Explorer

Use this to revoke complimentary access or enforce a policy violation.

**Warning — ADMINISTRATIVE WRITE.** If the user has an active Stripe subscription, cancel it in Stripe first, or the next webhook event will re-upgrade them automatically.

```sql
-- Step 1: Verify first
SELECT id, email, role, subscription_tier
FROM public.profiles
WHERE email = 'friend@example.com';

-- Step 2: Return to Explorer
-- If user has an active Stripe subscription: cancel in Stripe Dashboard first,
-- then run this. Otherwise Stripe will re-upgrade on next webhook.
-- service_role key required.
UPDATE public.profiles
SET
  role              = 'Explorer',
  subscription_tier = 'Explorer',
  updated_at        = NOW()
WHERE email = 'friend@example.com'
RETURNING id, email, role, subscription_tier, updated_at;
```

---

## 9. How to Check Active Trials

Trials live in the `subscriptions` table (`status = 'trialing'`), not the `profiles` table. Trial report usage is tracked in `usage_tracking` where `month_key = 'trial'`.

```sql
-- All active trials
SELECT
  p.email,
  s.trial_started_at,
  s.trial_ends_at,
  s.current_period_end,
  ut.count AS trial_reports_used,
  5         AS trial_limit
FROM public.subscriptions s
JOIN public.profiles p ON p.id = s.user_id
LEFT JOIN public.usage_tracking ut
  ON ut.user_id = s.user_id AND ut.month_key = 'trial' AND ut.report_type = 'standard'
WHERE s.status = 'trialing'
ORDER BY s.trial_ends_at ASC;

-- Trials ending in 7 days
SELECT
  p.email,
  s.trial_ends_at,
  s.current_period_end
FROM public.subscriptions s
JOIN public.profiles p ON p.id = s.user_id
WHERE s.status = 'trialing'
  AND s.trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
ORDER BY s.trial_ends_at ASC;
```

Also check Stripe → Subscriptions → filter by Status: "Trialing" for the authoritative Stripe view.

---

## 10. How to Check Paid Subscriptions

```sql
-- Active paid subscriptions
SELECT
  p.email,
  s.plan,
  s.status,
  s.current_period_end,
  s.cancel_at_period_end,
  s.stripe_customer_id,
  s.stripe_subscription_id
FROM public.subscriptions s
JOIN public.profiles p ON p.id = s.user_id
WHERE s.status = 'active'
ORDER BY s.current_period_end DESC;

-- Past-due subscriptions
SELECT
  p.email,
  s.plan,
  s.status,
  s.current_period_end,
  s.stripe_customer_id,
  s.stripe_subscription_id
FROM public.subscriptions s
JOIN public.profiles p ON p.id = s.user_id
WHERE s.status = 'past_due'
ORDER BY s.updated_at DESC;
```

Note: Stripe Dashboard → Subscriptions → filter by status is the authoritative view. The DB reflects the last successful webhook delivery and may lag by seconds.

---

## 11. How to Check Failed Payments

Two places to check:

1. **Stripe Dashboard → Payments → filter "Failed"** — lists individual charge failures.
2. **Stripe Dashboard → Subscriptions → filter "Past due"** — lists subscriptions with outstanding failed invoices.

Also check the database for accounts in a stuck past-due state:

```sql
SELECT
  p.email,
  s.plan,
  s.status,
  s.current_period_end,
  s.stripe_customer_id,
  s.stripe_subscription_id
FROM public.subscriptions s
JOIN public.profiles p ON p.id = s.user_id
WHERE s.status = 'past_due'
ORDER BY s.updated_at DESC;
```

Note: `past_due` users retain their plan access while Stripe retries payment. If the subscription is ultimately deleted, the webhook downgrades them to Explorer automatically.

---

## 12. How to Check Report Usage

```sql
-- Usage by user (current month)
SELECT
  p.email,
  ut.report_type,
  ut.month_key,
  ut.count
FROM public.usage_tracking ut
JOIN public.profiles p ON p.id = ut.user_id
WHERE ut.month_key = TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM')
ORDER BY ut.count DESC;

-- Usage by month (aggregate — all plans)
SELECT
  month_key,
  report_type,
  SUM(count)             AS total_reports,
  COUNT(DISTINCT user_id) AS unique_users
FROM public.usage_tracking
WHERE month_key != 'trial'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- Trial report usage (all users who have ever trialed)
SELECT
  p.email,
  ut.count AS trial_reports_used,
  5         AS trial_limit,
  s.trial_started_at,
  s.trial_ends_at,
  s.status
FROM public.usage_tracking ut
JOIN public.profiles p ON p.id = ut.user_id
JOIN public.subscriptions s ON s.user_id = ut.user_id
WHERE ut.month_key = 'trial'
  AND ut.report_type = 'standard'
ORDER BY ut.count DESC;
```

---

## 13. How to Check AI Costs

```sql
-- Recent AI usage logs (last 30 days)
SELECT
  user_email,
  plan,
  report_type,
  model,
  input_tokens,
  output_tokens,
  grounding_calls,
  estimated_cost_usd,
  within_hard_cap,
  business_type,
  location,
  generated_at
FROM public.usage_logs
WHERE generated_at > NOW() - INTERVAL '30 days'
ORDER BY generated_at DESC
LIMIT 50;

-- Cost summary by plan (last 30 days)
SELECT
  plan,
  COUNT(*)                      AS report_calls,
  SUM(estimated_cost_usd)       AS total_cost_usd,
  AVG(estimated_cost_usd)       AS avg_cost_usd
FROM public.usage_logs
WHERE generated_at > NOW() - INTERVAL '30 days'
GROUP BY plan
ORDER BY total_cost_usd DESC;

-- Hard-cap breaches (within_hard_cap = false means cost guard tripped)
SELECT
  user_email,
  plan,
  report_type,
  estimated_cost_usd,
  generated_at
FROM public.usage_logs
WHERE within_hard_cap = false
ORDER BY generated_at DESC
LIMIT 20;
```

---

## 14. How to Turn the Trial On or Off

The trial is controlled by two environment variables that must both be set:

| Variable | Layer | Effect |
|---|---|---|
| `VITE_PRO_TRIAL_ENABLED` | Client (build-time) | Shows "Start Free 7-Day Trial" CTA on pricing page and hero |
| `PRO_TRIAL_ENABLED` | Server (runtime) | Enables trial eligibility check at checkout |

Both must be `true` for the full trial experience. Changing only the client var shows the CTA but creates a normal paid subscription. Changing only the server var hides the CTA but still grants trials if checkout is called directly.

**To turn the trial ON:**

1. Go to Vercel → your project → Settings → Environment Variables.
2. Set `PRO_TRIAL_ENABLED = true` (Production scope).
3. Set `VITE_PRO_TRIAL_ENABLED = true` (Production scope).
4. Trigger a redeployment: go to Deployments → click the three-dot menu on the latest deployment → Redeploy.
5. Visit https://www.bizscope.app/?view=pricing and confirm the trial CTA appears.

**To turn the trial OFF:**

1. Go to Vercel → Settings → Environment Variables.
2. Set `PRO_TRIAL_ENABLED = false` (or remove it) — Production scope.
3. Set `VITE_PRO_TRIAL_ENABLED = false` (or remove it) — Production scope.
4. Redeploy.
5. Confirm the CTA is gone on the pricing page.

Existing trialing users are not retroactively affected — their trial continues until `trial_ends_at` regardless of these flags.

See [Deployment and Rollback](DEPLOYMENT_AND_ROLLBACK.md) for the full environment variable change procedure.

---

## 15. How to Check Stripe

Go to https://dashboard.stripe.com/.

**View all customers:**
- Left sidebar → Customers → lists all customers with subscription status.

**View subscriptions by status:**
- Left sidebar → Subscriptions → use the status filter (Active, Trialing, Past due, Canceled).

**View a specific customer's subscription:**
- Customers → search by email → click the customer → Subscriptions section shows active plan, billing period, and payment method.

**Check webhook delivery log:**
- Left sidebar → Developers → Webhooks → click your endpoint → Recent Deliveries.
- Each row shows the event type, delivery status, and response code.
- Click any row to see the full event payload and retry the delivery if it failed.

**Retry a failed webhook event:**
- In Recent Deliveries → click the failed event → click "Resend" button.

**Issue a refund:**
- Customers → [customer] → Payments → click the charge → Refund button.
- Stripe will credit the refund to the original payment method.

**Cancel a subscription:**
- Customers → [customer] → Subscriptions → click the subscription → Cancel.
- Choose "Cancel immediately" or "Cancel at period end."
- The webhook fires `customer.subscription.deleted` and downgrades the user to Explorer in the DB.

---

## 16. How to Check Supabase

Go to https://app.supabase.com/ and open your project.

**Open SQL Editor:**
- Left sidebar → SQL Editor → New Query.

**View auth users:**
- Left sidebar → Authentication → Users — lists all accounts with email and last sign-in.

**Check recent signups:**
- Authentication → Users → sort by "Created at" descending, or run the signups query from Section 4.

**Check RLS policies:**
- Left sidebar → Table Editor → click a table → Policies tab — lists all Row Level Security policies.
- All sensitive writes should have policies that restrict to `auth.uid() = user_id` or to `service_role` only.

**View migration history:**
- Left sidebar → Database → Migrations — shows all applied migration files with timestamps.

**View database logs:**
- Left sidebar → Logs → Postgres — real-time DB log stream.

---

## 17. How to Check Vercel

Go to https://vercel.com/omer-minhas-projects/bizscope-ai.

**Check current deployment status:**
- Left sidebar → Deployments — the top entry is the active Production deployment. A green checkmark means healthy.

**View recent deployment logs:**
- Deployments → click a deployment → Build Logs tab (for build errors) or Functions tab (for runtime errors).

**Check environment variables:**
- Left sidebar → Settings → Environment Variables — lists all vars by scope (Production / Preview / Development).

**View function logs:**
- Deployments → click the active deployment → Functions tab → filter by function name (e.g. `/api/stripe/webhook`) → click to see invocation logs.

**Confirm which commit is deployed:**
- Deployments → click the active Production deployment → "Git Commit" field shows the SHA.
- Or run `git log --oneline main | head -3` locally.

---

## 18. How to Check GA4

Go to https://analytics.google.com/ and open the BizScope property.

1. **Confirm events are flowing:** Reports → Realtime — if events appear within 30 seconds of a site visit, GA4 is working. If no events appear, check that `VITE_GA_MEASUREMENT_ID` is set in Vercel Production and a deployment has occurred.
2. **Check signups:** Reports → Engagement → Events → click `sign_up` — shows email signups over time.
3. **Check checkout starts:** Reports → Engagement → Events → click `begin_checkout` — shows checkout intent.
4. **Check page views:** Reports → Engagement → Pages and screens — shows views per page/view.
5. **Check traffic sources:** Reports → Acquisition → Traffic acquisition — shows channels (organic, paid, direct, referral).
6. **Note:** Standard GA4 reports have up to 24–48 hour data delay. Use Realtime for current traffic only.
7. **Debug mode:** Add `?debug=1` to the URL and check GA4 DebugView (Admin → DebugView) to see events in near-real-time.

---

## 19. How to Check Clarity

Go to https://clarity.microsoft.com/ and open the BizScope project.

1. **Session recordings:** Dashboard → Recordings — view individual user sessions.
2. **Privacy note:** Report content is masked with `data-clarity-mask="True"` on all report output components, auth screens, billing page, and account settings. Session recordings will not show AI-generated report text, user business information, or email addresses.
3. **Heatmaps:** Dashboard → Heatmaps — select the homepage (`/`) to see click and scroll patterns on the hero section.
4. **Rage clicks and dead clicks:** Dashboard → Dashboard tab — Clarity highlights rage clicks (fast repeated clicks in frustration) and dead clicks (clicks on non-interactive elements).
5. **Filter recordings:** Recordings → Filters — filter by date, device, or custom segment to focus on specific user behaviors.

---

## 20. How to Check Search Console

Go to https://search.google.com/search-console/ and open the BizScope property.

1. **Traffic performance:** Performance → Search results — shows clicks, impressions, CTR, and average position over time.
2. **Index coverage:** Index → Pages — shows indexed pages vs. pages with errors. Any "Error" status needs investigation.
3. **Sitemap status:** Sitemaps — confirm `https://www.bizscope.app/sitemap.xml` is submitted and shows no errors.
4. **Inspect a specific URL:** URL Inspection (top search bar) — paste any URL to check if Google has indexed it and see the last crawl date.
5. **Core Web Vitals:** Experience → Core Web Vitals — shows LCP, CLS, FID ratings per device. Poor ratings affect search ranking.

---

## 21. How to Deploy Safely

**Pre-deployment checklist:**

- [ ] All changes are committed on the `staging` branch
- [ ] `npm test` passes (`tsx tests/audit-regression.test.ts`)
- [ ] `npx tsc --noEmit` passes — no new TypeScript errors
- [ ] `npm run build` passes — Vite build succeeds
- [ ] No real API keys or credentials committed (run: `grep -rn "sk_live_\|whsec_\|supabase\.co" src/ api/`)
- [ ] Staging smoke test passed (see below)
- [ ] Database migrations applied to Production Supabase (if any) before merging

**Deployment steps:**

1. Push staging branch: `git push origin staging`
2. Verify staging deployment completes in Vercel (green checkmark).
3. Run staging smoke test at https://bizscope-ai-git-staging-omer-minhas-projects.vercel.app.
4. Merge staging to main: `git checkout main && git merge staging && git push origin main`
5. Vercel auto-deploys main to Production — wait for green checkmark in Deployments.
6. Run Production smoke test at https://www.bizscope.app.
7. Record the deployed commit SHA from Vercel → Deployments → active deployment.

**Production smoke test:**

- [ ] Site loads at https://www.bizscope.app
- [ ] Login works
- [ ] Hero page loads and report generation works
- [ ] Pricing page loads with correct plan details
- [ ] Billing page loads for a logged-in user
- [ ] Account settings loads

See [Deployment and Rollback](DEPLOYMENT_AND_ROLLBACK.md) for the full smoke test checklist including Stripe checkout and trial scenarios.

---

## 22. How to Roll Back

**Fastest rollback (no code changes needed, approximately 60 seconds):**

1. Open https://vercel.com/omer-minhas-projects/bizscope-ai.
2. Click **Deployments** in the left sidebar.
3. Find the last known-good deployment (before the problematic commit).
4. Click the three-dot menu on that deployment → **Redeploy**.
5. Wait for the rollback deployment to complete (green checkmark).
6. Confirm it is assigned to the Production domain.
7. Run the Production smoke test.

**Warning:** If the deployment included a database migration, rolling back the code does NOT undo the schema change. The new columns or tables remain in Supabase. Assess whether the old code is compatible with the current schema before rolling back. If not, you may need a repair migration or to leave the code as-is and fix forward.

After rollback:
- Do NOT re-merge the bad commit. Fix the issue in a new branch.
- Document what failed and the SHA that was rolled back.

See [Deployment and Rollback](DEPLOYMENT_AND_ROLLBACK.md) for the full rollback checklist.

---

## 23. What to Do If the Site Is Down

1. Check Vercel status: https://www.vercel-status.com/
2. Check Supabase status: https://status.supabase.com/
3. Open Vercel → Deployments → check the active Production deployment for a red error badge.
4. Open Vercel → Deployments → active deployment → Functions tab → check for high error rates on any function.
5. Open Vercel → Deployments → active deployment → Build Logs — look for a failed deployment.
6. **If a recent bad deployment caused it:** roll back immediately (Section 22).
7. **If Vercel infrastructure is down:** wait for Vercel status update; no action available on your end.
8. **If Supabase is down:** the site may load but logins and report saves will fail. Wait for Supabase status update. No DB changes needed — Supabase has its own recovery.
9. **If Stripe is down:** site should still load and users can still generate reports; only new checkouts will fail. Users with active subscriptions retain access.

Verify recovery: load https://www.bizscope.app and confirm the homepage renders.

See [Incident Response](INCIDENT_RESPONSE.md) for per-scenario runbooks.

---

## 24. What to Do If Payments Fail

1. Check Stripe → Payments → Failed for the failing charge.
2. Check Stripe → Subscriptions → Past due for accounts with outstanding invoices.
3. Check Stripe → Developers → Webhooks → your endpoint → Recent Deliveries for failed webhook events.
4. Check the database for accounts stuck in a past-due state:

```sql
SELECT
  p.email,
  s.plan,
  s.status,
  s.current_period_end,
  s.stripe_customer_id,
  s.stripe_subscription_id
FROM public.subscriptions s
JOIN public.profiles p ON p.id = s.user_id
WHERE s.status = 'past_due'
ORDER BY s.updated_at DESC;
```

5. Check for stuck webhook events:

```sql
SELECT event_id, event_type, state, attempt_count, last_attempted_at, last_error, created_at
FROM public.stripe_event_log
WHERE state IN ('processing', 'failed')
ORDER BY created_at DESC
LIMIT 10;
```

6. If a subscription exists in Stripe as active but the DB shows `past_due` or wrong plan: check the webhook log in Stripe and manually retry the failed delivery.
7. Stripe will auto-retry failed payments according to its Smart Retries schedule — no action usually required unless the subscription is deleted.

See [Incident Response](INCIDENT_RESPONSE.md) and [Billing and Trials](BILLING_AND_TRIALS.md).

---

## 25. What to Do If Users Have the Wrong Plan

1. Run the full user lookup to see both the DB state and the Stripe state:

```sql
SELECT
  p.email,
  p.role,
  p.subscription_tier,
  p.has_used_trial,
  s.plan             AS stripe_plan,
  s.status           AS stripe_status,
  s.stripe_customer_id,
  s.stripe_subscription_id,
  s.current_period_end
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id
WHERE p.email = 'friend@example.com';
```

2. Cross-reference with Stripe: Stripe Dashboard → Customers → search by email → check their active subscription and plan.
3. **If Stripe shows active Pro but DB shows Explorer:** the `checkout.session.completed` webhook may have failed. Go to Stripe → Webhooks → Recent Deliveries → find the event → Resend.
4. **If Stripe shows active Pro+ but DB shows Pro:** check that `STRIPE_PRICE_ID_PRO_PLUS` points to the correct Stripe price ID. A misconfigured price mapping in the webhook causes wrong plan assignment.
5. **If Stripe shows canceled but DB still shows Pro:** manually downgrade in DB (see Section 8). The `customer.subscription.deleted` webhook may have failed or been missed.
6. **Never manually set a `subscription_tier` that conflicts with what Stripe currently shows** — Stripe is authoritative for subscription state. The next webhook event will overwrite a conflicting manual change.

See [Incident Response](INCIDENT_RESPONSE.md) → "Users receiving wrong plan after payment."

---

## 26. Backup and Recovery Checklist

**What git backs up automatically:** all source code, migration SQL files, documentation, sitemap, robots.txt, `index.html`. Everything in the repository is safe.

**What you must back up separately:**

| Item | How to back up | Frequency |
|---|---|---|
| Supabase database rows | Supabase Dashboard → Project Settings → Database → Backups (automatic on paid plans). Also: `supabase db dump` via CLI. | Automatic daily (verify schedule); manual weekly recommended |
| Vercel environment variables | Copy all names and values to a secure password manager (Vercel does not export them) | After every env var change |
| Stripe products and prices | Document price IDs in a secure note (format: `price_...`) | After any pricing change |
| Domain and DNS configuration | Screenshot or export from registrar; store in secure vault | After any DNS change |
| GA4 property settings | Screenshot property ID, data stream ID, key event config | After major GA4 changes |
| Clarity project settings | Document project ID in secure vault | After configuration changes |
| AI chat context (Claude, ChatGPT) | Export from settings (Claude: Settings → Privacy → Export; ChatGPT: Settings → Data Controls → Export) | Monthly |

See [Disaster Recovery](DISASTER_RECOVERY.md) for the full fresh-start recovery procedure including Vercel, Supabase, Stripe, and third-party service reconnection.

---

## 27. Key Environment Variables

These are set in Vercel → your project → Settings → Environment Variables. Never commit real values to the repository. `VITE_` prefixed variables are baked into the browser bundle at build time — changing them requires a redeployment. Server-side variables (no `VITE_` prefix) take effect on the next function invocation.

| Variable | Purpose | Note |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project REST URL | Client-visible (public) |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key for client queries | Client-visible (public) |
| `SUPABASE_URL` | Same Supabase URL, used by serverless functions | Server-side; no rebuild needed to change |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB admin key; bypasses RLS | SECRET — never expose to client |
| `STRIPE_SECRET_KEY` | Stripe API access (`sk_live_...` in Production) | SECRET |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhook HMAC signatures (`whsec_...`) | SECRET |
| `STRIPE_PRICE_ID_PRO` | Stripe price ID for Pro monthly ($29) | From Stripe Dashboard → Products |
| `STRIPE_PRICE_ID_PRO_PLUS` | Stripe price ID for Pro+ monthly ($59) | From Stripe Dashboard → Products |
| `APP_URL` | Canonical app URL for Stripe redirect URLs | Set to `https://www.bizscope.app` in Production |
| `VITE_APP_URL` | App URL used as Supabase OAuth redirectTo | Set to `https://www.bizscope.app` in Production |
| `GEMINI_API_KEY` | Google Gemini AI report generation | SECRET — server-only, no VITE_ prefix |
| `RESEND_API_KEY` | Transactional email via Resend | SECRET |
| `CONTACT_TO_EMAIL` | Destination inbox for contact form submissions | Server-side; no rebuild needed |
| `VITE_GA_MEASUREMENT_ID` | GA4 Measurement ID (`G-XXXXXXXXXX`) | Client-visible; absent = GA4 disabled |
| `VITE_CLARITY_PROJECT_ID` | Microsoft Clarity project ID | Client-visible; absent = Clarity disabled |
| `VITE_PRO_TRIAL_ENABLED` | Shows trial CTA on pricing/hero pages | Build-time; redeploy required to change |
| `PRO_TRIAL_ENABLED` | Enables trial eligibility at server checkout | Runtime; takes effect on next function call |
| `VITE_DEMO_MODE` | Master demo switch; disables real Gemini and Stripe | Defaults to `false`; absent = safe |
| `VITE_BETA_FULL_ACCESS` | Grants all authenticated users effective Pro+ | Defaults to `false`; absent = safe |
| `VITE_BETA_CLOSED` | Blocks new signups with a "beta closed" message | Defaults to `false`; absent = safe |
| `ANONYMOUS_PREVIEW_ENABLED` | Controls anonymous preview reports | Set to `'false'` to disable; absent = enabled |
| `VITE_REAL_REPORTS_ENABLED` | Allows beta roles to use real Gemini in demo mode | Build-time flag for beta testing |

See [Environment Variables](ENVIRONMENT_VARIABLES.md) for the full reference including rotation notes.

---

## 28. Common Safe SQL Queries

All queries below are read-only SELECT statements. Run them in Supabase → SQL Editor. Replace placeholder emails with real values.

### Users

```sql
-- Total user count
SELECT COUNT(*) AS total_users FROM public.profiles;

-- Signups by day (last 30 days)
SELECT
  DATE(created_at AT TIME ZONE 'UTC') AS signup_date,
  COUNT(*) AS signups
FROM public.profiles
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1 DESC;

-- Find user by email
SELECT
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.subscription_tier,
  p.has_used_trial,
  p.created_at,
  s.plan        AS stripe_plan,
  s.status      AS stripe_status,
  s.trial_ends_at,
  s.current_period_end
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id
WHERE p.email = 'friend@example.com';

-- All users and their plan (most recent 50)
SELECT
  p.email,
  p.role,
  p.subscription_tier,
  p.has_used_trial,
  s.plan   AS stripe_plan,
  s.status AS stripe_status,
  p.created_at
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id
ORDER BY p.created_at DESC
LIMIT 50;
```

### Subscriptions and Trials

```sql
-- Active paid subscriptions
SELECT
  p.email,
  s.plan,
  s.status,
  s.current_period_end,
  s.cancel_at_period_end,
  s.stripe_customer_id
FROM public.subscriptions s
JOIN public.profiles p ON p.id = s.user_id
WHERE s.status = 'active'
ORDER BY s.current_period_end DESC;

-- Past-due subscriptions
SELECT
  p.email,
  s.plan,
  s.status,
  s.current_period_end,
  s.stripe_customer_id,
  s.stripe_subscription_id
FROM public.subscriptions s
JOIN public.profiles p ON p.id = s.user_id
WHERE s.status = 'past_due'
ORDER BY s.updated_at DESC;

-- Active trials
SELECT
  p.email,
  s.trial_started_at,
  s.trial_ends_at,
  s.current_period_end
FROM public.subscriptions s
JOIN public.profiles p ON p.id = s.user_id
WHERE s.status = 'trialing'
ORDER BY s.trial_ends_at ASC;

-- Trials ending in 7 days
SELECT
  p.email,
  s.trial_ends_at,
  s.current_period_end
FROM public.subscriptions s
JOIN public.profiles p ON p.id = s.user_id
WHERE s.status = 'trialing'
  AND s.trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
ORDER BY s.trial_ends_at ASC;

-- Complimentary grants (elevated plan, no Stripe subscription)
SELECT p.email, p.role, p.subscription_tier
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id
WHERE s.id IS NULL
  AND (p.subscription_tier != 'Explorer' OR p.role NOT IN ('Explorer', 'BetaTester', 'Admin'));
```

### Usage and Costs

```sql
-- Usage by user (current month)
SELECT
  p.email,
  ut.report_type,
  ut.month_key,
  ut.count
FROM public.usage_tracking ut
JOIN public.profiles p ON p.id = ut.user_id
WHERE ut.month_key = TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM')
ORDER BY ut.count DESC;

-- Trial report usage
SELECT
  p.email,
  ut.count AS trial_reports_used,
  5         AS trial_limit
FROM public.usage_tracking ut
JOIN public.profiles p ON p.id = ut.user_id
WHERE ut.month_key = 'trial'
  AND ut.report_type = 'standard'
ORDER BY ut.count DESC;

-- Recent AI cost logs
SELECT
  user_email,
  plan,
  report_type,
  model,
  input_tokens,
  output_tokens,
  estimated_cost_usd,
  within_hard_cap,
  generated_at
FROM public.usage_logs
WHERE generated_at > NOW() - INTERVAL '30 days'
ORDER BY generated_at DESC
LIMIT 50;

-- AI cost by plan (last 30 days)
SELECT
  plan,
  COUNT(*)                 AS report_calls,
  SUM(estimated_cost_usd)  AS total_cost_usd,
  AVG(estimated_cost_usd)  AS avg_cost_usd
FROM public.usage_logs
WHERE generated_at > NOW() - INTERVAL '30 days'
GROUP BY plan
ORDER BY total_cost_usd DESC;

-- Hard-cap breaches
SELECT user_email, plan, report_type, estimated_cost_usd, generated_at
FROM public.usage_logs
WHERE within_hard_cap = false
ORDER BY generated_at DESC
LIMIT 20;
```

### Report Activity

```sql
-- Recent errors
SELECT
  user_email,
  report_type,
  success,
  error_message,
  source,
  duration_ms,
  created_at
FROM public.report_activity_log
WHERE success = false
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 30;

-- Recent saved reports
SELECT
  sr.id,
  p.email,
  sr.business_type,
  sr.location,
  sr.report_type,
  sr.is_favorite,
  sr.date_saved
FROM public.saved_reports sr
JOIN public.profiles p ON p.id = sr.user_id
ORDER BY sr.date_saved DESC
LIMIT 50;
```

### Stripe Events

```sql
-- Recent webhook events
SELECT
  event_id,
  event_type,
  state,
  attempt_count,
  last_attempted_at,
  processed_at,
  last_error,
  created_at
FROM public.stripe_event_log
ORDER BY created_at DESC
LIMIT 50;

-- Stuck or failed webhook events
SELECT event_id, event_type, state, attempt_count, last_attempted_at, last_error, created_at
FROM public.stripe_event_log
WHERE state IN ('processing', 'failed')
ORDER BY created_at DESC
LIMIT 10;
```

### Cache

```sql
-- Recent cache entries
SELECT
  business_type,
  location,
  report_type,
  analysis_version,
  plan_tier,
  created_at
FROM public.report_cache
ORDER BY created_at DESC
LIMIT 30;
```

---

## 29. Things Never to Change Casually

1. **`subscription_tier` in the DB without checking Stripe first** — Stripe will overwrite it on the next webhook event. If Stripe shows an active subscription, any manual downgrade will be undone automatically.
2. **Migrations on Production without testing on staging first** — a broken migration can lock the database or corrupt data. Always apply to staging Supabase first, verify, then apply to Production.
3. **Stripe Price IDs (`STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_PRO_PLUS`)** — changing these to invalid or wrong IDs breaks the checkout flow. If a price is archived in Stripe, create a new one and update the env var before the old price is removed.
4. **Stripe webhook endpoint URL** — changing the webhook URL in Stripe without updating it back stops all subscription lifecycle events (checkout, payment, cancellation). If the URL changes, immediately update Stripe Dashboard → Webhooks.
5. **`SUPABASE_SERVICE_ROLE_KEY`** — rotating it requires updating Vercel immediately or all serverless functions (webhook, quota enforcement, checkout) will fail with auth errors. Do not rotate without a deployment ready to deploy.
6. **RLS policies** — weakening or removing Row Level Security policies could expose user data to other users or allow unauthorized writes. Any policy change requires a security review.
7. **The `trg_protect_profile_columns` trigger** — this is the security boundary preventing users from self-escalating their `role` or `subscription_tier` via the client anon key. Disabling or dropping this trigger opens a privilege escalation path.
8. **`has_used_trial` set to `false`** — this resets trial eligibility and allows a user to start a second free trial. Only do this for genuine support cases (e.g., trial payment failed before the user could access the product).
9. **Rows in `stripe_event_log`** — this table is the idempotency guard for webhook processing. Deleting rows means Stripe can re-deliver the same event and it will be processed again (duplicate subscription creation, duplicate profile upgrades).
10. **`VITE_GA_MEASUREMENT_ID`** — changing this to a different property ID breaks analytics data continuity. All historical events are tied to the original property. If you need a new property, create it in parallel and keep the original.

---

## 30. Monthly Maintenance Checklist

**Every month:**

- [ ] Review GA4 signups trend and checkout conversion rates (`begin_checkout` / `pricing_viewed`)
- [ ] Review Gemini AI costs via `usage_logs` — confirm costs are within expected range for active user count
- [ ] Run the past-due subscriptions query (Section 11) and review any stuck accounts
- [ ] Check Stripe Dashboard → Payments → Failed for recurring payment failures
- [ ] Check for trials that started but never converted: query `subscriptions WHERE status = 'cancelled'` and `has_used_trial = true` with no subsequent active subscription
- [ ] Check Vercel → Analytics → Functions error rates for sustained failures
- [ ] Verify Search Console → Index Coverage shows no new crawl errors
- [ ] Check Clarity for rage clicks, navigation confusion, or UX patterns worth addressing
- [ ] Review and update Vercel environment variables if any service credentials changed
- [ ] Rotate any secret that was accidentally logged or exposed since the last review
- [ ] Verify Supabase automatic database backups are running (Supabase → Project Settings → Database → Backups)
- [ ] Export AI chat context (Claude: Settings → Privacy → Export; ChatGPT: Settings → Data Controls → Export) if significant development sessions occurred this month

---

## Appendix A: One-Page Quick Reference

### Common Queries (run in Supabase SQL Editor)

| Task | SQL sketch |
|---|---|
| Count users | `SELECT COUNT(*) FROM public.profiles;` |
| Find user | `SELECT p.*, s.status, s.plan FROM profiles p LEFT JOIN subscriptions s ON s.user_id = p.id WHERE p.email = '...'` |
| Check active trials | `SELECT p.email, s.trial_ends_at FROM subscriptions s JOIN profiles p ON p.id = s.user_id WHERE s.status = 'trialing'` |
| Check paid subs | `SELECT p.email, s.plan FROM subscriptions s JOIN profiles p ON p.id = s.user_id WHERE s.status = 'active'` |
| Check past_due | `SELECT p.email, s.plan FROM subscriptions s JOIN profiles p ON p.id = s.user_id WHERE s.status = 'past_due'` |
| Grant Pro | `UPDATE profiles SET role='Pro', subscription_tier='Pro' WHERE email='...' RETURNING email, subscription_tier` |
| Grant Pro+ | `UPDATE profiles SET role='ProPlus', subscription_tier='ProPlus' WHERE email='...' RETURNING email, subscription_tier` |
| Return to Explorer | `UPDATE profiles SET role='Explorer', subscription_tier='Explorer' WHERE email='...' RETURNING email, subscription_tier` |
| Check AI costs | `SELECT plan, SUM(estimated_cost_usd) FROM usage_logs WHERE generated_at > NOW()-INTERVAL '30 days' GROUP BY plan` |
| Check stuck webhooks | `SELECT event_id, event_type, state FROM stripe_event_log WHERE state IN ('processing','failed') ORDER BY created_at DESC` |

### Emergency Actions

| Situation | First step |
|---|---|
| Rollback | Vercel → Deployments → prior deployment → three-dot menu → Redeploy |
| Site down | Check https://www.vercel-status.com/ then Vercel → Deployments for failed deployment |
| Payments failing | Stripe → Webhooks → Recent Deliveries → find failed event → Resend |
| User on wrong plan | Run find-user query (Section 5) → compare with Stripe → resend webhook or manual DB fix |
| Secret exposed | Rotate immediately in the relevant service dashboard → update Vercel env → redeploy |

### Important Links at a Glance

| Service | URL |
|---|---|
| Production | https://www.bizscope.app |
| Vercel | https://vercel.com/omer-minhas-projects/bizscope-ai |
| Supabase | https://app.supabase.com/ |
| Stripe | https://dashboard.stripe.com/ |
| Vercel status | https://www.vercel-status.com/ |
| Supabase status | https://status.supabase.com/ |

---

## Appendix B: Detailed Documentation Index

| Document | Purpose |
|---|---|
| [Owner Operations Manual](OWNER_OPERATIONS_MANUAL.md) | Full SQL library, feature flags, Stripe/Vercel navigation, secret rotation |
| [Developer Runbook](DEVELOPER_RUNBOOK.md) | Local setup, architecture quick-map, common change guides, known quirks |
| [Environment Variables](ENVIRONMENT_VARIABLES.md) | All env vars with scope, secret/public classification, and rotation notes |
| [Database Operations](DATABASE_OPERATIONS.md) | Table schemas, full SQL reference, security trigger documentation |
| [Billing and Trials](BILLING_AND_TRIALS.md) | Plan mechanics, trial eligibility rules, Stripe lifecycle, entitlement types |
| [Deployment and Rollback](DEPLOYMENT_AND_ROLLBACK.md) | Branch model, deployment checklist, smoke test checklist, rollback procedure |
| [Analytics and Marketing](ANALYTICS_AND_MARKETING.md) | GA4 events, Clarity masking, UTM attribution, SEO, sitemap |
| [Incident Response](INCIDENT_RESPONSE.md) | 17 per-scenario runbooks with Symptoms / Diagnostics / Safe Actions / Verification |
| [Disaster Recovery](DISASTER_RECOVERY.md) | Fresh-start infrastructure recovery procedure, external system backup checklist |
| [Architecture](ARCHITECTURE.md) | System diagrams, data flow, security boundaries |
| [Owner Changelog](CHANGELOG_OWNER.md) | Operational milestone history grouped by sprint |

---

**Last reviewed:** 2026-07-31
**Production commit:** be86cb5 (staging) / see Vercel dashboard for current Production SHA
