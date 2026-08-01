# Security Fixes

Security-relevant changes in BizScope AI, in reverse chronological order.

Use this file to understand the security posture history and to verify fixes are still in place.

---

## 2026-07-30: Profile Column Self-Escalation Prevention

**Commit:** `85661cd`  
**Severity:** High

**What was wrong:** The RLS UPDATE policy on `profiles` allowed any authenticated user to update their own row. This included sensitive columns (`role`, `subscription_tier`, `has_used_trial`, `email`). A malicious authenticated user could escalate their own plan to `Enterprise` via a direct Supabase client call.

**Fix:** Added the `trg_protect_profile_columns` BEFORE UPDATE trigger (migration `20260730000000_protect_profile_sensitive_columns.sql`). The trigger checks `current_setting('request.jwt.claims', true)` and raises an exception if the JWT role is `authenticated` (the anon key role) and any protected column is being changed. Only `service_role` connections (serverless functions) can update these columns.

**Verification:**
```sql
-- Confirm trigger exists
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'profiles' AND trigger_name = 'trg_protect_profile_columns';
-- Expected: 1 row, BEFORE UPDATE
```

---

## 2026-07-30: `saved_reports` UPDATE Policy Missing `WITH CHECK`

**Commit:** `8428ebe`  
**Severity:** Medium

**What was wrong:** The RLS UPDATE policy on `saved_reports` had a `USING` clause but was missing a `WITH CHECK` clause. In PostgreSQL RLS, `USING` controls which rows can be read for update selection, but `WITH CHECK` controls what the row looks like after the update. Without `WITH CHECK`, an authenticated user could potentially update the `user_id` column of their own row to point to another user (row-level ownership bypass).

**Fix:** Added `WITH CHECK (auth.uid() = user_id)` to the `saved_reports` UPDATE policy (migration `20260730000001_saved_reports_update_with_check.sql`).

**Verification:**
```sql
-- Confirm WITH CHECK is present
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'saved_reports' AND cmd = 'UPDATE';
-- Expected: with_check column contains uid() = user_id expression
```

---

## 2026-07-30: `.env*` Files Added to `.gitignore`

**Commit:** `fb0bec2`  
**Severity:** Medium (preventive)

**What changed:** `.env`, `.env.local`, `.env.production`, and `.env.*` patterns added to `.gitignore` to prevent temporary env files from being committed.

**Context:** During development, `.env.local` files containing real keys are commonly created and could be accidentally committed. The `.gitignore` change ensures they stay local.

---

## 2026-06-23: Terms Acceptance Gate After Authentication

**Commit:** `032964d`  
**Severity:** Low (compliance)

**What changed:** After authentication, users are required to accept the Terms of Service before accessing the application. Previously, authenticated users could access features without explicit terms acceptance.

---

## Webhook Signature Verification

**Status:** Active since Stripe integration (`2026-07-18`).

The webhook handler (`api/stripe/webhook.ts`) uses `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)` to verify the HMAC signature on every incoming request. Requests that fail verification return 400 immediately.

**Verification:** Check that `STRIPE_WEBHOOK_SECRET` is set in Vercel Production env. Do not confuse it with `STRIPE_SECRET_KEY`.

---

## JWT Verification on All Protected API Endpoints

**Status:** Active since Stripe integration (`2026-07-18`).

All serverless functions that access user data call `verifyAuth(req, res)` from `api/stripe/_shared.ts` before any Supabase or Stripe operation. This function validates the `Authorization: Bearer <token>` header against the Supabase JWT secret.

Endpoints that deliberately do not require auth: `/api/preview` (anonymous preview), `/api/contact` (public contact form).

---

## Known Absence: Rate Limiting

**Status:** Not implemented.

The anonymous preview endpoint (`/api/preview`) is publicly accessible with no rate limiting. A sustained abuse campaign could drive up Gemini API costs. The `ANONYMOUS_LIMITS` constant (1 lifetime preview per client) is enforced via `localStorage` on the client — this is trivially bypassed by clearing storage or using a different browser.

**Risk:** Moderate cost exposure from automated abuse. Mitigation options: Vercel Edge rate limiting, Cloudflare Workers WAF, or Supabase RLS-based rate limiting.

---

## Analytics Privacy

**Status:** Active.

GA4 parameters never include names, emails, Supabase user IDs, Stripe IDs, or report content. Only categorical enum values (plan name, error category enum) are sent. Microsoft Clarity has `data-clarity-mask="True"` on all components containing user-entered data or PII. See `docs/ANALYTICS_AND_MARKETING.md`.
