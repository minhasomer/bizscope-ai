# Billing and Trials

How plans, Stripe subscriptions, and the 7-day Pro trial work.

---

## Plan Tiers

All plan names and limits are sourced from `src/config/plans.ts` and `src/config/usageTracking.ts`.

| Plan | Price | Standard Reports/Month | Regional Reports/Month | Full Financials | PDF Export | Save Reports | Compare Reports |
|---|---|---|---|---|---|---|---|
| Explorer | Free | 3 | 0 (locked) | No | No | No | No |
| Pro | $29/month | 20 | 0 (locked) | Yes | Yes | Yes | Yes |
| Pro+ | $59/month | 50 | 10 | Yes | Yes | Yes | Yes |
| Enterprise | Custom | Unlimited | Unlimited | Yes | Yes | Yes | Yes |

**Anonymous visitors** (not signed in): 1 lifetime preview report, never resets.

---

## DB Tier Enum Values

The `profiles` table uses `CHECK` constraints. The UI name and DB enum value differ for Pro+:

| UI Display Name | DB `role` / `subscription_tier` value |
|---|---|
| Explorer | `Explorer` |
| Pro | `Pro` |
| Pro+ | `ProPlus` |
| Enterprise | `Enterprise` |
| BetaTester | `BetaTester` |
| Admin | `Admin` |

The Stripe webhook `PLAN_TO_DB_TIER` mapping (`api/stripe/_shared.ts`) translates `'Pro+'` → `'ProPlus'` before writing to `profiles.subscription_tier`. Bypassing this mapping (e.g. writing `'Pro+'` directly to the DB) will violate the CHECK constraint.

---

## 7-Day Pro Trial

### Mechanics

- Trial is available on the Pro plan only. Pro+ cannot be trialed.
- Trial duration: **7 days** (set as `trial_period_days: 7` in the Stripe Checkout session).
- Trial report cap: **5 reports total** (not monthly). Stored in `usage_tracking` with `month_key = 'trial'`.
- Payment method is required at Checkout (Stripe collects it before trial begins).
- After 7 days, Stripe automatically charges the first monthly fee unless canceled.
- One trial per user, enforced server-side via `profiles.has_used_trial`.

### Trial Eligibility Rules (server-enforced)

All of the following must be true for a user to receive a trial:

1. `PRO_TRIAL_ENABLED=true` on the server
2. `plan = 'Pro'` (not Pro+)
3. `profiles.has_used_trial = false` (no prior trial)
4. No active, trialing, or past_due subscription row
5. No historical Pro or Pro+ subscription (i.e. `subscriptions.plan` not in `['Pro', 'Pro+']`)
6. `profiles.subscription_tier` not elevated to Pro or ProPlus
7. `profiles.role` not Admin or BetaTester (already have elevated access)

The server defaults `has_used_trial = true` on any DB read error, so a transient database outage cannot accidentally grant a second trial.

### Trial Lifecycle

1. User clicks "Start Free 7-Day Trial" → `handleCheckout('Pro')` in `App.tsx`
2. `StripeService.startCheckout('Pro')` → POST `/api/stripe/create-checkout-session`
3. Server verifies all eligibility rules; creates Stripe Checkout session with `trial_period_days: 7`
4. User enters payment details on Stripe-hosted page; trial begins
5. Webhook fires `checkout.session.completed` with `sub.status = 'trialing'`
6. Webhook sets `subscriptions.status = 'trialing'`, `profiles.subscription_tier = 'Pro'`, `profiles.has_used_trial = true`
7. User can generate up to 5 standard reports during trial (enforced by `checkTrialQuota()` in `api/analyze.ts`)
8. At trial end: Stripe charges → `customer.subscription.updated` → status becomes `active`
9. If canceled before end: `customer.subscription.deleted` → status `cancelled`, tier → `Explorer`

### Trial CTA Display Toggle

- `VITE_PRO_TRIAL_ENABLED=true` (client build-time): shows "Start Free 7-Day Trial" CTA on pricing page and hero
- `PRO_TRIAL_ENABLED=true` (server runtime): enables trial at checkout

Setting only the client flag shows the CTA but creates a normal paid subscription. This is intentional — it lets you test the UI before enabling the server flag.

Turning off the client flag (`VITE_PRO_TRIAL_ENABLED=false` + redeploy) hides the CTA for new visitors. Existing trialing users are unaffected — their trial status is read from the DB, not from the flag.

---

## Entitlement Types

There are four distinct ways a user can receive elevated access:

### 1. Complimentary DB Grant (no Stripe subscription)
Direct `UPDATE` to `profiles.role` and/or `profiles.subscription_tier` using the `service_role` key. No Stripe subscription exists. No billing. No Stripe portal button appears. Useful for beta testers, internal users, or customer goodwill.

### 2. Real Stripe Subscription (paid)
Created via Stripe Checkout. Webhook writes `subscriptions.status = 'active'` and syncs `profiles.subscription_tier`. Stripe Customer Portal is available.

### 3. Active Trial
Stripe subscription with `status = 'trialing'`. Trial report cap of 5. Webhook writes `has_used_trial = true` at start.

### 4. Role Elevation (BetaTester / Admin)
`profiles.role = 'BetaTester'` grants effective Pro+ access. `profiles.role = 'Admin'` grants effective Enterprise access. These are set manually in Supabase (see DATABASE_OPERATIONS.md). No Stripe subscription required.

---

## Effective Plan Resolution

The priority order used by `getEffectivePlan()` in `src/utils/planUtils.ts`:

1. Demo plan override (only in VITE_DEMO_MODE — not relevant in production)
2. `Admin` role → `Enterprise`
3. `VITE_BETA_FULL_ACCESS=true` + authenticated → `Pro+`
4. `BetaTester` role → `Pro+`
5. `profiles.subscription_tier` (DB value mapped to UI plan)
6. Default: `Explorer`

---

## Stripe as Source of Truth for Subscription Status

- The `subscriptions` table in Supabase reflects the last successful Stripe webhook delivery.
- Never infer subscription status from `profiles.subscription_tier` alone — the subscription row may have lapsed while the tier was not yet downgraded.
- The `/api/stripe/subscription-status` endpoint reads from both `subscriptions` and `profiles` to derive the user's current effective state.

## Supabase as Source of Truth for Entitlement

- `profiles.subscription_tier` drives feature gating (via `getEffectivePlan()`).
- `profiles.role` drives access for complimentary and admin grants.
- The webhook updates both `subscriptions.*` and `profiles.subscription_tier` on every lifecycle event.

---

## past_due Behavior

When a payment fails, Stripe sets `status = 'past_due'`. The webhook writes `past_due` to `subscriptions.status` but does **not** downgrade `profiles.subscription_tier`. The user retains access while Stripe retries payment. If the subscription is ultimately deleted (`customer.subscription.deleted`), the webhook then downgrades the profile to `Explorer`.

---

## Stripe Webhook Events Handled

All events in `api/stripe/webhook.ts`:

| Event | Action |
|---|---|
| `checkout.session.completed` | Upsert `subscriptions`; set `profiles.subscription_tier`; set `has_used_trial=true` if trialing |
| `customer.subscription.updated` | Update `subscriptions`; sync `profiles.subscription_tier` for active/trialing/cancelled |
| `customer.subscription.deleted` | Set `status=cancelled`, `plan=Explorer`; downgrade `profiles.subscription_tier` to `Explorer` |
| `invoice.payment_failed` | Set `subscriptions.status = 'past_due'` |
| `invoice.payment_succeeded` | Set `subscriptions.status = 'active'`; sync profile tier (guards against overwriting a newer subscription) |

---

## Webhook Idempotency

Every webhook event is claimed via `begin_stripe_event()` RPC before processing. A Stripe event in state `processing` for more than 120 seconds (hung Vercel function) is eligible for reclaim. Processed events (state `processed`) are immediately returned 200 without re-processing. Failed events (state `failed`) are eligible for Stripe retry.

---

## Stripe Customer Portal

Users with an active, trialing, or past_due subscription can open the Stripe Customer Portal via the Billing page or the Pricing page. In the portal, users can:
- View and download invoices
- Update their payment method
- Cancel their subscription (end of period)
- Reactivate a canceled subscription (before period end)
- Switch between Pro and Pro+ (if configured in Stripe portal settings)

Portal return URL: `{APP_URL}/billing`

---

## Risks of Directly Editing Subscription Fields in the DB

- Writing to `subscriptions` directly (via Supabase SQL Editor or API with `service_role`) bypasses Stripe. The DB may no longer match Stripe's records, causing unexpected behavior on the next webhook delivery.
- Writing `'Pro+'` to `profiles.subscription_tier` directly violates the CHECK constraint (the DB enum is `'ProPlus'`). Always use `PLAN_TO_DB_TIER` mapping or the verified SQL in DATABASE_OPERATIONS.md.
- Resetting `has_used_trial = false` allows a second trial — do this only for genuine support cases.

---

## How to Turn Trial On / Off

**Turn ON:**
1. Set `PRO_TRIAL_ENABLED=true` in Vercel Environment Variables (Production or Staging as needed)
2. Set `VITE_PRO_TRIAL_ENABLED=true` in Vercel Environment Variables for the same scope
3. Trigger a Vercel redeployment (push a commit or use "Redeploy" in Vercel dashboard)
4. Verify CTA appears on pricing page

**Turn OFF:**
1. Set `PRO_TRIAL_ENABLED=false` (or remove it) in Vercel Environment Variables
2. Set `VITE_PRO_TRIAL_ENABLED=false` (or remove it)
3. Redeploy
4. Existing trialing users are unaffected — their trial continues until `trial_ends_at`

---

## How to Find Trial Users

**In Supabase:**
```sql
-- Active trials
SELECT p.email, s.trial_started_at, s.trial_ends_at, ut.count AS reports_used
FROM public.subscriptions s
JOIN public.profiles p ON p.id = s.user_id
LEFT JOIN public.usage_tracking ut ON ut.user_id = s.user_id AND ut.month_key = 'trial'
WHERE s.status = 'trialing';
```

**In Stripe:**
Stripe Dashboard → Subscriptions → filter by Status: "Trialing"
