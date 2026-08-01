# Owner Operations Manual

Quick-reference for the most common administrative tasks. Audience: technical owner with access to Vercel, Supabase, and Stripe dashboards.

---

## Most Common Owner Tasks

| Task | Jump To |
|---|---|
| Check what plan a user is on | [Check User Plan](#check-user-plan) |
| Manually give a user a free/complimentary plan | [Grant Complimentary Access](#grant-complimentary-access) |
| Downgrade or remove a user's access | [Downgrade a User](#downgrade-a-user) |
| Reset a user's quota (stuck or bugged) | [Reset Usage Quota](#reset-usage-quota) |
| Allow a user a second trial | [Allow a Second Trial](#allow-a-second-trial) |
| Turn the 7-day trial on or off | [Trial Toggle](#trial-toggle) |
| Check overall usage / top users | [Usage Overview](#usage-overview) |
| Check for errors or failures | [Health Checks](#health-checks) |
| Deploy a code change | [Deploying Changes](#deploying-changes) |
| Rotate a compromised API key | [Rotating Secrets](#rotating-secrets) |
| Add or change feature flags | [Feature Flags](#feature-flags) |

All SQL queries use the Supabase Dashboard → SQL Editor (connected with `service_role` key — no direct DB credentials are used in this document).

---

## Check User Plan

```sql
-- Replace with the actual email address
SELECT
  p.email,
  p.role,
  p.subscription_tier,
  p.has_used_trial,
  s.plan       AS stripe_plan,
  s.status     AS stripe_status,
  s.trial_ends_at,
  s.cancel_at,
  s.current_period_end
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id
WHERE p.email = 'friend@example.com';
```

**Reading the result:**

- `subscription_tier` is the field that drives feature access. Values: `Explorer`, `Pro`, `ProPlus`, `Enterprise`.
- `role` overrides tier for special access: `BetaTester` → effective Pro+; `Admin` → effective Enterprise.
- `stripe_status` values: `active`, `trialing`, `past_due`, `cancelled`. A `past_due` user still has access while Stripe retries.
- If `s.*` columns are all NULL, the user has no Stripe subscription (either Explorer or a complimentary DB grant).

---

## Grant Complimentary Access

Use this to give a user free access without a Stripe subscription (beta tester, investor demo, customer goodwill).

**Step 1: Confirm the current state** (run the Check User Plan query above first).

**Step 2: Grant access**

```sql
-- Grant Pro access (READ this block before running)
-- Change 'Pro' to 'ProPlus' or 'Enterprise' as needed
-- IMPORTANT: DB enum for Pro+ is 'ProPlus' (not 'Pro+')
BEGIN;

UPDATE public.profiles
SET
  subscription_tier = 'Pro',
  updated_at = NOW()
WHERE email = 'friend@example.com'
RETURNING id, email, subscription_tier, role;

COMMIT;
```

**Step 3: Verify** by re-running the Check User Plan query.

**What this does NOT do:**
- It does not create a Stripe subscription (no billing occurs).
- The Stripe Customer Portal button will not appear for this user.
- This access persists until explicitly revoked — there is no expiry.

**To grant BetaTester role instead:**

```sql
BEGIN;

UPDATE public.profiles
SET
  role = 'BetaTester',
  updated_at = NOW()
WHERE email = 'friend@example.com'
RETURNING id, email, role;

COMMIT;
```

`BetaTester` role grants effective Pro+ via `getEffectivePlan()` regardless of `subscription_tier`.

---

## Downgrade a User

Use to revoke complimentary access or enforce a policy violation.

```sql
-- Downgrade profile to Explorer and reset role
-- Does NOT cancel a Stripe subscription — cancel that in Stripe Dashboard separately if needed
BEGIN;

UPDATE public.profiles
SET
  subscription_tier = 'Explorer',
  role              = 'Explorer',
  updated_at        = NOW()
WHERE email = 'friend@example.com'
RETURNING id, email, subscription_tier, role;

COMMIT;
```

**Important:** If the user has an active Stripe subscription, downgrading the DB tier will be overwritten by the next webhook event. To permanently downgrade a paid subscriber:

1. Cancel their subscription in Stripe Dashboard → Customers → [customer] → Subscriptions → Cancel immediately.
2. Wait for the `customer.subscription.deleted` webhook to fire (or run the DB update above after confirming no active subscription).

---

## Reset Usage Quota

Use when a user reports a quota error that seems incorrect, or when you've extended their access and their counter needs resetting.

```sql
-- Reset this month's standard report count for a user
-- Replace YYYY-MM with the current month (e.g. '2026-07')
BEGIN;

UPDATE public.usage_tracking
SET count = 0, updated_at = NOW()
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'friend@example.com')
  AND month_key = '2026-07'
  AND report_type = 'standard';

COMMIT;
```

**To also reset the trial quota:**

```sql
BEGIN;

UPDATE public.usage_tracking
SET count = 0, updated_at = NOW()
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'friend@example.com')
  AND month_key = 'trial';

COMMIT;
```

**Check the current quota before resetting:**

```sql
SELECT report_type, month_key, count
FROM public.usage_tracking
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'friend@example.com')
ORDER BY month_key DESC, report_type;
```

---

## Allow a Second Trial

A user used their trial, then canceled and wants another. This is a support decision — only do this intentionally.

```sql
-- Step 1: Confirm they have a cancelled subscription (not an active one)
SELECT p.email, p.has_used_trial, s.status, s.plan
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id
WHERE p.email = 'friend@example.com';

-- Step 2: Reset the trial flag (only run if Step 1 shows status = 'cancelled' or NULL)
BEGIN;

UPDATE public.profiles
SET has_used_trial = false, updated_at = NOW()
WHERE email = 'friend@example.com'
RETURNING id, email, has_used_trial;

COMMIT;

-- Step 3: Reset the trial usage counter
BEGIN;

UPDATE public.usage_tracking
SET count = 0, updated_at = NOW()
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'friend@example.com')
  AND month_key = 'trial';

COMMIT;
```

The user will now be eligible for a trial on their next checkout if they meet all other eligibility rules (no active subscription, etc.).

---

## Trial Toggle

See also: `docs/BILLING_AND_TRIALS.md` for full mechanics.

**Turn trial ON:**
1. Vercel Dashboard → Project → Settings → Environment Variables
2. Set `PRO_TRIAL_ENABLED = true` (Production scope)
3. Set `VITE_PRO_TRIAL_ENABLED = true` (Production scope)
4. Vercel Dashboard → Project → Deployments → Redeploy latest Production deployment
5. Visit `https://www.bizscope.app/?view=pricing` and confirm the trial CTA appears

**Turn trial OFF:**
1. Vercel Dashboard → Settings → Environment Variables
2. Set `PRO_TRIAL_ENABLED = false` or remove it (Production scope)
3. Set `VITE_PRO_TRIAL_ENABLED = false` or remove it (Production scope)
4. Redeploy
5. Confirm the CTA is gone on pricing page
6. Existing trialing users are unaffected — their trial continues until `trial_ends_at`

---

## Usage Overview

**All users and their plan:**

```sql
SELECT
  p.email,
  p.role,
  p.subscription_tier,
  s.status AS stripe_status,
  s.plan   AS stripe_plan
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id
ORDER BY p.created_at DESC
LIMIT 50;
```

**Active (paying) subscribers:**

```sql
SELECT p.email, s.plan, s.status, s.current_period_end
FROM public.subscriptions s
JOIN public.profiles p ON p.id = s.user_id
WHERE s.status IN ('active', 'trialing', 'past_due')
ORDER BY s.created_at DESC;
```

**Report generation counts this month:**

```sql
-- Replace YYYY-MM with current month
SELECT
  p.email,
  ut.report_type,
  ut.count
FROM public.usage_tracking ut
JOIN public.profiles p ON p.id = ut.user_id
WHERE ut.month_key = '2026-07'
ORDER BY ut.count DESC
LIMIT 30;
```

**Top report generators all time:**

```sql
SELECT
  p.email,
  COUNT(*) AS total_reports
FROM public.usage_logs ul
JOIN public.profiles p ON p.id = ul.user_id
GROUP BY p.email
ORDER BY total_reports DESC
LIMIT 20;
```

**Users currently trialing:**

```sql
SELECT p.email, s.trial_started_at, s.trial_ends_at, ut.count AS trial_reports_used
FROM public.subscriptions s
JOIN public.profiles p ON p.id = s.user_id
LEFT JOIN public.usage_tracking ut ON ut.user_id = s.user_id AND ut.month_key = 'trial'
WHERE s.status = 'trialing';
```

---

## Health Checks

Run these periodically or when something seems wrong.

**Stuck Stripe webhook events (processing > 5 min):**

```sql
SELECT stripe_event_id, event_type, state, created_at, updated_at
FROM public.stripe_event_log
WHERE state IN ('processing', 'failed')
ORDER BY created_at DESC
LIMIT 10;
```

If events are stuck in `processing` for more than 10 minutes, check Vercel function logs for `/api/stripe/webhook`. Stripe will retry failed events automatically (check Stripe Dashboard → Webhooks → Recent Deliveries).

**Users with elevated plan but no Stripe subscription (complimentary grants):**

```sql
SELECT p.email, p.role, p.subscription_tier
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id
WHERE s.id IS NULL
  AND (p.subscription_tier != 'Explorer' OR p.role NOT IN ('Explorer', 'BetaTester', 'Admin'));
```

**Recent hard-cap breaches (cost guard tripped):**

```sql
SELECT ul.user_id, p.email, ul.report_type, ul.generated_at, ul.plan_at_time
FROM public.usage_logs ul
JOIN public.profiles p ON p.id = ul.user_id
WHERE ul.within_hard_cap = false
ORDER BY ul.generated_at DESC
LIMIT 20;
```

**Recent errors (report_activity_log):**

```sql
SELECT ral.action, ral.report_id, ral.created_at, p.email
FROM public.report_activity_log ral
JOIN public.profiles p ON p.id = ral.user_id
WHERE ral.created_at > NOW() - INTERVAL '24 hours'
ORDER BY ral.created_at DESC
LIMIT 30;
```

**External dashboards to check:**
- Vercel: `https://vercel.com/` → Project → Analytics / Logs
- Supabase: `https://app.supabase.com/` → Project → Logs → Edge Functions
- Stripe: `https://dashboard.stripe.com/` → Webhooks → Recent Deliveries
- GA4: `https://analytics.google.com/` → Real-time (if analytics is enabled)

---

## Deploying Changes

For full deploy procedure, see `docs/DEPLOYMENT_AND_ROLLBACK.md`.

**Standard deploy (staging → main):**

```bash
git checkout staging
# Make changes, commit
git push origin staging
# Verify staging works: https://bizscope-ai-git-staging-omer-minhas-projects.vercel.app

git checkout main
git merge staging
git push origin main
# Verify production: https://www.bizscope.app
```

**Check the live SHA:**
- Vercel Dashboard → Deployments → click active Production deployment → Git Commit field

**Emergency rollback:**
- Vercel Dashboard → Deployments → click a previous healthy deployment → "..." menu → Redeploy

---

## Rotating Secrets

If a key is exposed or suspected compromised, rotate it before doing anything else.

**Supabase Service Role Key:**
1. Supabase Dashboard → Project Settings → API → Service Role → Regenerate
2. Copy the new key
3. Vercel → Settings → Environment Variables → update `SUPABASE_SERVICE_ROLE_KEY`
4. Vercel → Redeploy (server-side vars take effect on next invocation, but redeploy ensures all functions pick up the change)

**Stripe Secret Key:**
1. Stripe Dashboard → API Keys → Secret Key → Roll
2. Copy the new `sk_live_...` key
3. Vercel → update `STRIPE_SECRET_KEY`
4. Redeploy

**Stripe Webhook Secret:**
1. Stripe Dashboard → Webhooks → your endpoint → Signing Secret → Roll secret
2. Copy the new `whsec_...` value
3. Vercel → update `STRIPE_WEBHOOK_SECRET`
4. Redeploy immediately — webhook delivery will fail until the new secret is live

**Gemini API Key:**
1. Google AI Studio → API Keys → delete old key, create new
2. Vercel → update `GEMINI_API_KEY`
3. Redeploy

**Resend API Key:**
1. Resend Dashboard → API Keys → delete old, create new
2. Vercel → update `RESEND_API_KEY`
3. Redeploy

After any rotation, submit a contact form and generate a test report on staging to confirm all services are working.

---

## Feature Flags

All flags are environment variables in Vercel. `VITE_*` flags are baked into the client bundle at build time (require redeploy to change). Server-side flags take effect on next function invocation.

| Flag | Type | Effect When `true` |
|---|---|---|
| `VITE_DEMO_MODE` | Client (build-time) | Disables real Gemini + Stripe; shows demo content. Emergency fallback only. |
| `VITE_BETA_FULL_ACCESS` | Client (build-time) | All authenticated users get effective Pro+ regardless of DB tier. |
| `VITE_BETA_CLOSED` | Client (build-time) | Blocks new signups with a "beta is closed" message. |
| `VITE_PRO_TRIAL_ENABLED` | Client (build-time) | Shows trial CTA on pricing page and hero. |
| `PRO_TRIAL_ENABLED` | Server (runtime) | Enables trial eligibility check at checkout. |
| `VITE_BETA_ROLE_ENABLED` | Client (build-time) | Enables the BetaTester role-based access path in the client. |
| `VITE_GA_MEASUREMENT_ID` | Client (build-time) | Enables GA4. Absent = GA4 disabled. |
| `VITE_CLARITY_PROJECT_ID` | Client (build-time) | Enables Microsoft Clarity. Absent = Clarity disabled. |

**Recommended Production state:**
- `VITE_DEMO_MODE`: absent or `false`
- `VITE_BETA_FULL_ACCESS`: absent or `false`
- `VITE_BETA_CLOSED`: absent or `false`
- `VITE_PRO_TRIAL_ENABLED` and `PRO_TRIAL_ENABLED`: set to your current trial campaign state

To change a client flag: update in Vercel → Environment Variables → trigger a redeploy (push a commit, or use "Redeploy" in Vercel Dashboard).

---

## Supabase Direct Access (Read-Only Inspection)

For quick inspection without SQL, Supabase Dashboard → Table Editor lets you browse rows directly. Use it to:
- Verify a user's `subscription_tier` and `role` in `profiles`
- Inspect `subscriptions` rows
- Check `stripe_event_log` for webhook delivery states

For writes, always use SQL Editor with explicit `BEGIN/COMMIT` and a `RETURNING` clause so you can verify the change before it's permanent.

---

## Contacts and Accounts

| System | URL |
|---|---|
| Vercel | `https://vercel.com/omer-minhas-projects/bizscope-ai` |
| Supabase | `https://app.supabase.com/` |
| Stripe | `https://dashboard.stripe.com/` |
| Google AI Studio | `https://aistudio.google.com/` |
| Resend | `https://resend.com/` |
| GitHub | `https://github.com/minhasomer/bizscope-ai` |
| GA4 | `https://analytics.google.com/` |
| Microsoft Clarity | `https://clarity.microsoft.com/` |
| Google Search Console | `https://search.google.com/search-console/` |
