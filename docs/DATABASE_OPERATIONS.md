# Database Operations

Reference for all Supabase PostgreSQL tables, schemas, and SQL queries. All table and column names are verified from migration files.

> **Privilege note:** A `BEFORE UPDATE` trigger (`trg_protect_profile_columns`) blocks authenticated users (normal JWT) from directly modifying `profiles.role`, `profiles.subscription_tier`, `profiles.email`, `profiles.id`, `profiles.created_at`, and `profiles.has_used_trial`. Only the `service_role` key (used by the Stripe webhook handler and admin server operations) can write these columns. Any `UPDATE` that touches those columns while connecting with a user JWT will receive `SQLSTATE 42501 insufficient_privilege`.

---

## Table Schemas

### `profiles`

One row per `auth.users` row. Created automatically by the `handle_new_user` trigger on `auth.users`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | FK → `auth.users(id)` ON DELETE CASCADE |
| `email` | text | Mirrors `auth.users.email`; not user-editable |
| `full_name` | text | User-editable display name |
| `avatar_url` | text | User-editable profile picture URL |
| `role` | text NOT NULL | CHECK: `Explorer`, `Pro`, `ProPlus`, `Enterprise`, `BetaTester`, `Admin`. Default `Explorer`. Not user-editable. |
| `subscription_tier` | text NOT NULL | CHECK: same values as `role`. Default `Explorer`. Written by Stripe webhook only. `Pro+` in UI = `ProPlus` in DB. |
| `tos_accepted_at` | timestamptz | NULL until user accepts Terms of Service |
| `has_used_trial` | boolean NOT NULL | Set to `true` when a trial begins; prevents second trial. Not user-editable. Default `false`. |
| `created_at` | timestamptz NOT NULL | Immutable audit timestamp |
| `updated_at` | timestamptz NOT NULL | Managed by `trg_profiles_updated_at` trigger |

**RLS policies:** `profiles_select_own` (authenticated SELECT own), `profiles_insert_own` (authenticated INSERT own), `profiles_update_own` (authenticated UPDATE own — column restrictions enforced by trigger).

---

### `subscriptions`

One row per user. Written exclusively by the Stripe webhook handler using the `service_role` key.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Internal ID |
| `user_id` | uuid NOT NULL UNIQUE | FK → user; one subscription per user |
| `stripe_customer_id` | text UNIQUE | Stripe customer ID |
| `stripe_subscription_id` | text UNIQUE | Stripe subscription ID |
| `plan` | text NOT NULL | `Explorer`, `Pro`, `Pro+`. Note: UI display value, not DB tier. |
| `status` | text NOT NULL | `active`, `trialing`, `past_due`, `cancelled`, `inactive` |
| `current_period_start` | timestamptz | Billing period start |
| `current_period_end` | timestamptz | Billing period end |
| `cancel_at_period_end` | boolean NOT NULL | `true` if cancellation is scheduled |
| `cancel_at` | timestamptz | Absolute timestamp of scheduled cancellation (from Stripe `cancel_at`) |
| `trial_started_at` | timestamptz | NULL for non-trial subscriptions |
| `trial_ends_at` | timestamptz | NULL for non-trial subscriptions |
| `created_at` | timestamptz NOT NULL | — |
| `updated_at` | timestamptz NOT NULL | — |

**RLS policies:** `subscriptions: select own` (users can read own row). No user INSERT/UPDATE policy — all writes from `service_role`.

---

### `saved_reports`

User-saved viability and market gap reports.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Safe to expose in client responses |
| `user_id` | uuid NOT NULL | FK → `auth.users(id)` ON DELETE CASCADE |
| `business_type` | text NOT NULL | — |
| `location` | text NOT NULL | — |
| `is_favorite` | boolean NOT NULL | Default `false` |
| `report_type` | text NOT NULL | CHECK: `standard`, `regional`, `market_gap`. Default `standard`. |
| `date_saved` | timestamptz NOT NULL | Default `NOW()` |
| `report_data` | jsonb NOT NULL | Full report payload |
| `created_at` | timestamptz NOT NULL | — |

**Unique constraint:** `(user_id, lower(business_type), lower(location))` — one saved record per user+business+location combination.

**RLS policies:** CRUD own rows only (USING and WITH CHECK both `auth.uid() = user_id`).

---

### `report_cache`

Global shared cache of generated Gemini reports. Cross-account, cross-device.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | — |
| `business_type` | text NOT NULL | — |
| `location` | text NOT NULL | — |
| `report_type` | text NOT NULL | — |
| `analysis_version` | text NOT NULL | Default `v1` |
| `plan_tier` | text | Metadata only; not part of unique key |
| `report` | jsonb NOT NULL | Full report payload |
| `created_at` | timestamptz NOT NULL | — |
| `updated_at` | timestamptz NOT NULL | — |

**Unique constraint:** `(business_type, location, report_type, analysis_version)`.

**RLS:** RLS enabled, **no user-facing policies**. Access via `service_role` only.

---

### `usage_tracking`

Per-user monthly report usage counters. Also used for trial quota (`month_key = 'trial'`).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | — |
| `user_id` | uuid NOT NULL | FK → `auth.users(id)` ON DELETE CASCADE |
| `report_type` | text | `standard` or `regional` |
| `usage_date` | date NOT NULL | Day of most recent increment |
| `month_key` | text | Format `YYYY-MM` for monthly; `trial` for trial quota |
| `count` | integer NOT NULL | Usage count for this (user, report_type, month_key) |
| `created_at` | timestamptz NOT NULL | — |
| `updated_at` | timestamptz NOT NULL | — |

**Unique constraint:** `(user_id, report_type, month_key)` — atomic upsert via `increment_usage_tracking()` RPC.

**RLS policies:** `usage_tracking: select own` (users can read own rows). Writes from `service_role` only via RPC.

---

### `usage_logs`

Canonical AI cost ledger. One row per real Gemini report generated.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | — |
| `user_id` | uuid | FK → `auth.users(id)` ON DELETE SET NULL |
| `user_email` | text NOT NULL | — |
| `user_role` | text NOT NULL | — |
| `plan` | text NOT NULL | — |
| `report_type` | text NOT NULL | Default `standard` |
| `model` | text NOT NULL | Gemini model used |
| `input_tokens` | integer | — |
| `output_tokens` | integer | — |
| `grounding_calls` | integer NOT NULL | Default 0 |
| `estimated_cost_usd` | numeric(10,6) | — |
| `within_hard_cap` | boolean NOT NULL | Default `true` |
| `business_type` | text NOT NULL | — |
| `location` | text NOT NULL | — |
| `generated_at` | timestamptz NOT NULL | — |

**RLS:** RLS enabled, no user-facing policies. `service_role` only.

---

### `report_activity_log`

Per-attempt log (success and failure) for all generation endpoints. Mirrors `estimated_ai_cost` from `usage_logs`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | — |
| `user_id` | uuid | — |
| `user_email` | text | — |
| `report_type` | text NOT NULL | — |
| `business_type` | text | — |
| `location` | text | — |
| `normalized_location` | text | — |
| `plan_tier` | text | — |
| `cache_status` | text | — |
| `force_regenerate` | boolean | Default `false` |
| `success` | boolean NOT NULL | Default `true` |
| `error_message` | text | — |
| `source` | text | — |
| `duration_ms` | integer | — |
| `metadata` | jsonb | — |
| `ai_model` | text | — |
| `input_tokens` | integer | — |
| `output_tokens` | integer | — |
| `total_tokens` | integer | — |
| `estimated_ai_cost` | numeric(10,6) | — |
| `created_at` | timestamptz NOT NULL | — |

**RLS:** `service_role` only.

---

### `stripe_event_log`

Idempotency log for Stripe webhook events. Prevents duplicate processing.

| Column | Type | Notes |
|---|---|---|
| `event_id` | text PK | Stripe event ID (`evt_...`) |
| `event_type` | text NOT NULL | e.g. `checkout.session.completed` |
| `state` | text NOT NULL | CHECK: `processing`, `processed`, `failed` |
| `attempt_count` | integer NOT NULL | Default 1 |
| `last_attempted_at` | timestamptz NOT NULL | — |
| `processed_at` | timestamptz | Set on success |
| `last_error` | text | Set on failure |
| `created_at` | timestamptz NOT NULL | — |

**RLS:** `service_role` only. RPCs: `begin_stripe_event()`, `complete_stripe_event()`, `fail_stripe_event()`.

---

### `reports` (Legacy — do not use)

The original reports table, predating `saved_reports`. No longer referenced by application code. Present in the DB for historical audit purposes.

---

## Read-Only SQL Queries

### Count all users
```sql
-- 🔍 READ-ONLY
SELECT COUNT(*) AS total_users FROM public.profiles;
```

### Count signups by day (last 30 days)
```sql
-- 🔍 READ-ONLY
SELECT
  DATE(created_at AT TIME ZONE 'UTC') AS signup_date,
  COUNT(*) AS signups
FROM public.profiles
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1 DESC;
```

### Find user by email
```sql
-- 🔍 READ-ONLY
SELECT
  id,
  email,
  full_name,
  role,
  subscription_tier,
  has_used_trial,
  tos_accepted_at,
  created_at
FROM public.profiles
WHERE email = 'friend@example.com';
```

### View user plan / role / tier
```sql
-- 🔍 READ-ONLY
SELECT
  p.email,
  p.role,
  p.subscription_tier,
  p.has_used_trial,
  s.plan        AS stripe_plan,
  s.status      AS stripe_status,
  s.trial_started_at,
  s.trial_ends_at,
  s.cancel_at_period_end,
  s.current_period_end
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id
WHERE p.email = 'friend@example.com';
```

### List active trials
```sql
-- 🔍 READ-ONLY
SELECT
  p.email,
  p.role,
  s.plan,
  s.status,
  s.trial_started_at,
  s.trial_ends_at,
  s.current_period_end
FROM public.subscriptions s
JOIN public.profiles p ON p.id = s.user_id
WHERE s.status = 'trialing'
ORDER BY s.trial_started_at DESC;
```

### Trials ending in 7 days
```sql
-- 🔍 READ-ONLY
SELECT
  p.email,
  s.plan,
  s.trial_ends_at,
  s.current_period_end
FROM public.subscriptions s
JOIN public.profiles p ON p.id = s.user_id
WHERE s.status = 'trialing'
  AND s.trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
ORDER BY s.trial_ends_at ASC;
```

### Active paid subscriptions
```sql
-- 🔍 READ-ONLY
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
```

### Past-due subscriptions
```sql
-- 🔍 READ-ONLY
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

### Usage by user (current month)
```sql
-- 🔍 READ-ONLY
SELECT
  p.email,
  ut.report_type,
  ut.month_key,
  ut.count
FROM public.usage_tracking ut
JOIN public.profiles p ON p.id = ut.user_id
WHERE ut.month_key = TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM')
ORDER BY ut.count DESC;
```

### Usage by month (aggregate)
```sql
-- 🔍 READ-ONLY
SELECT
  month_key,
  report_type,
  SUM(count) AS total_reports,
  COUNT(DISTINCT user_id) AS unique_users
FROM public.usage_tracking
WHERE month_key != 'trial'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;
```

### Trial report usage
```sql
-- 🔍 READ-ONLY
SELECT
  p.email,
  ut.count AS trial_reports_used,
  5 AS trial_limit,
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

### Recent AI cost logs
```sql
-- 🔍 READ-ONLY
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
ORDER BY generated_at DESC
LIMIT 50;
```

### Recent Stripe webhook events
```sql
-- 🔍 READ-ONLY
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
```

### Recent saved reports
```sql
-- 🔍 READ-ONLY
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

---

## Administrative Write SQL

> **Before running any write:** Always run the SELECT verification query first. Replace `friend@example.com` with the actual user's email. Verify the SELECT result matches your intent before running the UPDATE.

---

### Grant complimentary Pro

```sql
-- Verify first
SELECT id, email, role, subscription_tier FROM public.profiles WHERE email = 'friend@example.com';

-- ⚠️ ADMINISTRATIVE WRITE — VERIFY BEFORE RUNNING
-- Replace friend@example.com with the actual email.
-- This bypasses Stripe and grants Pro access at the DB level (complimentary access).
-- Does NOT create a Stripe subscription row.
-- service_role key required.
UPDATE public.profiles
SET
  role = 'Pro',
  subscription_tier = 'Pro',
  updated_at = NOW()
WHERE email = 'friend@example.com'
RETURNING id, email, role, subscription_tier, updated_at;
```

---

### Grant complimentary Pro+

```sql
-- Verify first
SELECT id, email, role, subscription_tier FROM public.profiles WHERE email = 'friend@example.com';

-- ⚠️ ADMINISTRATIVE WRITE — VERIFY BEFORE RUNNING
-- Replace friend@example.com with the actual email.
-- Note: subscription_tier must be 'ProPlus' (not 'Pro+') — this is the DB enum value.
-- role can also be set to 'ProPlus' to make the grant visible in both fields.
-- service_role key required.
UPDATE public.profiles
SET
  role = 'ProPlus',
  subscription_tier = 'ProPlus',
  updated_at = NOW()
WHERE email = 'friend@example.com'
RETURNING id, email, role, subscription_tier, updated_at;
```

---

### Restore user to Explorer

```sql
-- Verify first
SELECT id, email, role, subscription_tier FROM public.profiles WHERE email = 'friend@example.com';

-- ⚠️ ADMINISTRATIVE WRITE — VERIFY BEFORE RUNNING
-- Replace friend@example.com with the actual email.
-- Use this to downgrade a complimentary grant or reset a test account.
-- Does NOT cancel a Stripe subscription — cancel in Stripe Dashboard first.
-- service_role key required.
UPDATE public.profiles
SET
  role = 'Explorer',
  subscription_tier = 'Explorer',
  updated_at = NOW()
WHERE email = 'friend@example.com'
RETURNING id, email, role, subscription_tier, updated_at;
```

---

### Grant BetaTester role

```sql
-- Verify first
SELECT id, email, role, subscription_tier FROM public.profiles WHERE email = 'friend@example.com';

-- ⚠️ ADMINISTRATIVE WRITE — VERIFY BEFORE RUNNING
-- BetaTester role grants effective Pro+ access via getEffectivePlan() priority order.
-- subscription_tier stays Explorer (no Stripe subscription created).
-- service_role key required.
UPDATE public.profiles
SET
  role = 'BetaTester',
  updated_at = NOW()
WHERE email = 'friend@example.com'
RETURNING id, email, role, subscription_tier, updated_at;
```

---

### Grant Admin role

```sql
-- Verify first
SELECT id, email, role, subscription_tier FROM public.profiles WHERE email = 'friend@example.com';

-- ⚠️ ADMINISTRATIVE WRITE — VERIFY BEFORE RUNNING
-- WARNING: Admin grants Enterprise-level access AND shows the DevAdminPanel in the UI.
-- Admin users can trigger real Gemini calls in any mode.
-- Use only for yourself or trusted internal users.
-- service_role key required.
UPDATE public.profiles
SET
  role = 'Admin',
  updated_at = NOW()
WHERE email = 'friend@example.com'
RETURNING id, email, role, subscription_tier, updated_at;
```

---

### Reset has_used_trial (reinstate trial eligibility)

```sql
-- Verify first — confirm the user actually had a trial before resetting
SELECT id, email, has_used_trial, role, subscription_tier FROM public.profiles WHERE email = 'friend@example.com';
SELECT status, trial_started_at, trial_ends_at FROM public.subscriptions WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'friend@example.com');

-- ⚠️ ADMINISTRATIVE WRITE — VERIFY BEFORE RUNNING
-- Only use this for genuine support cases (e.g. trial payment failed, user never got access).
-- Resetting this allows the user to start another 7-day trial.
-- service_role key required.
UPDATE public.profiles
SET
  has_used_trial = false,
  updated_at = NOW()
WHERE email = 'friend@example.com'
RETURNING id, email, has_used_trial, updated_at;
```

---

## Protect Profile Columns Trigger

The trigger `trg_protect_profile_columns` (function `protect_profile_columns()`) fires `BEFORE UPDATE` on `public.profiles`. When the caller's `current_user` is `authenticated` (any request via a user JWT), changes to the following columns are rejected with `SQLSTATE 42501`:

- `id` (immutable primary key)
- `email` (must mirror auth.users)
- `role` (authorization tier)
- `subscription_tier` (billing tier)
- `created_at` (immutable audit timestamp)
- `has_used_trial` (trial one-use marker)

The `service_role` key (used by the Stripe webhook, admin functions, and the SQL queries above) is **not** `authenticated` and retains unrestricted write access. All administrative SQL above requires the `service_role` key.
