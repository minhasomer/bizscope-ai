# Environment Variables

Complete reference for all environment variables used by BizScope AI.

> **Security warning:** `VITE_` prefixed variables are embedded in the browser JavaScript bundle at build time and are visible to any user who inspects the bundle. Never put secrets in `VITE_` variables.

---

## Supabase

| Variable | Purpose | Client/Server | Secret/Public | Used in Files | Effect When Absent | Rotation Notes |
|---|---|---|---|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project REST URL (e.g. `https://xxxx.supabase.co`) | Client (VITE_) | Public | `services/supabaseClient.ts` | App runs in demo/sandbox auth mode; real sign-in unavailable | Update in Vercel env + redeploy |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous (public) key for client queries | Client (VITE_) | Public | `services/supabaseClient.ts` | App runs in demo/sandbox auth mode | Update in Vercel env + redeploy |
| `SUPABASE_URL` | Same Supabase URL as above, used by server-side API functions | Server | Public | `api/stripe/_shared.ts`, all `api/*.ts` | Server API cannot connect to Supabase; all API calls fail | Update in Vercel env; no rebuild needed |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key; bypasses RLS; used by webhook and admin operations | Server | **Secret** | `api/stripe/_shared.ts`, all `api/*.ts` | Server API cannot read or write Supabase; webhook fails | Rotate in Supabase Dashboard → API; update Vercel immediately |

---

## Stripe

| Variable | Purpose | Client/Server | Secret/Public | Used in Files | Effect When Absent | Rotation Notes |
|---|---|---|---|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...` or `sk_test_...`) | Server | **Secret** | `api/stripe/_shared.ts` | Checkout and portal creation fail; webhook signature validation fails | Rotate in Stripe Dashboard → API Keys; update Vercel immediately |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_...`) from Stripe webhook endpoint | Server | **Secret** | `api/stripe/webhook.ts` | All webhook events rejected (403); subscriptions never update after payment | Re-issue from Stripe Dashboard → Webhooks; update Vercel |
| `STRIPE_PRICE_ID_PRO` | Stripe recurring price ID for the Pro plan (`price_...`) | Server | Public | `api/stripe/_shared.ts` | Checkout for Pro plan returns 400; Pro subscriptions cannot be created | Update if price is archived and replaced |
| `STRIPE_PRICE_ID_PRO_PLUS` | Stripe recurring price ID for the Pro+ plan (`price_...`) | Server | Public | `api/stripe/_shared.ts` | Checkout for Pro+ plan returns 400 | Update if price is archived and replaced |
| `APP_URL` | Canonical app URL used in Stripe redirect URLs (no trailing slash) | Server | Public | `api/stripe/[...path].ts` | Stripe redirects after checkout/portal land on empty string URL | Set to `https://www.bizscope.app` for Production |

---

## Gemini AI

| Variable | Purpose | Client/Server | Secret/Public | Used in Files | Effect When Absent | Rotation Notes |
|---|---|---|---|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for AI report generation | Server | **Secret** | `api/analyze.ts`, `api/preview.ts`, `api/opportunities.ts`, `api/opportunity-dossier.ts`, `api/regional-analysis.ts` | All report generation returns 500 error; reports cannot be generated | Rotate in Google AI Studio; update Vercel immediately |

---

## Resend (Email)

| Variable | Purpose | Client/Server | Secret/Public | Used in Files | Effect When Absent | Rotation Notes |
|---|---|---|---|---|---|---|
| `RESEND_API_KEY` | Resend API key for transactional email | Server | **Secret** | `api/contact.ts` | Contact form submissions silently fail to send email; API returns 500 | Rotate in Resend Dashboard; update Vercel |
| `CONTACT_TO_EMAIL` | Destination email address for contact form submissions | Server | Public | `api/contact.ts` | Contact form returns 500; no email sent | Update in Vercel env |
| `CONTACT_FROM_ADDRESS` | Sender display address for contact form emails | Server | Public | `api/contact.ts` | Defaults to `BizScope Contact <contact@bizscope.ai>` | Update in Vercel env |

---

## Application Feature Flags

| Variable | Purpose | Client/Server | Secret/Public | Used in Files | Effect When Absent | Rotation Notes |
|---|---|---|---|---|---|---|
| `VITE_DEMO_MODE` | Master mock switch; when `true`, disables real Gemini/Stripe calls | Client (VITE_) | Public | `src/config/appConfig.ts`, `vite.config.ts` | **Defaults to `false`** (safe production default); real services are used | Build-time flag; redeploy required to change |
| `PRO_TRIAL_ENABLED` | Server-side flag controlling 7-day Pro trial eligibility at checkout | Server | Public | `api/stripe/[...path].ts` | Trial is disabled; checkout always creates paid subscriptions | Update in Vercel env; no rebuild needed |
| `VITE_PRO_TRIAL_ENABLED` | Client-side display flag; shows "Start Free 7-Day Trial" CTA when `true` | Client (VITE_) | Public | `src/config/appConfig.ts`, `vite.config.ts` | Trial CTA hidden; "Get Pro" shown instead (safe default) | Build-time flag; redeploy required |
| `VITE_REAL_REPORTS_ENABLED` | When `true`, allows beta roles to call real Gemini even in demo mode | Client (VITE_) | Public | `src/config/appConfig.ts`, `vite.config.ts` | Beta role real-report path disabled | Build-time flag; redeploy required |
| `VITE_BETA_ROLES` | Comma-separated list of roles that can generate real reports (`Admin,BetaTester`) | Client (VITE_) | Public | `src/config/appConfig.ts`, `vite.config.ts` | No roles can use real reports in demo mode | Build-time flag; redeploy required |
| `VITE_BETA_FULL_ACCESS` | When `true`, all authenticated non-Admin users receive effective Pro+ access | Client (VITE_) | Public | `src/config/appConfig.ts`, `vite.config.ts` | **Defaults to `false`** (safe); normal plan gates apply | Build-time flag; redeploy required to disable |
| `VITE_BETA_CLOSED` | When `true`, public signup is hidden; only sign-in is available | Client (VITE_) | Public | `src/config/appConfig.ts`, `vite.config.ts` | **Defaults to `false`**; signup is publicly available | Build-time flag; redeploy required |

---

## Analytics

| Variable | Purpose | Client/Server | Secret/Public | Used in Files | Effect When Absent | Rotation Notes |
|---|---|---|---|---|---|---|
| `VITE_GA_MEASUREMENT_ID` | GA4 Measurement ID (format `G-XXXXXXXXXX`) | Client (VITE_) | Public | `src/utils/analytics.ts`, `vite.config.ts` | GA4 completely disabled; no events tracked | Update in Vercel env + redeploy; safe to leave blank locally |
| `VITE_CLARITY_PROJECT_ID` | Microsoft Clarity project ID (alphanumeric, ~10 chars) | Client (VITE_) | Public | `src/utils/analytics.ts`, `vite.config.ts` | Clarity completely disabled; no session recordings | Update in Vercel env + redeploy; safe to leave blank locally |

---

## URLs

| Variable | Purpose | Client/Server | Secret/Public | Used in Files | Effect When Absent | Rotation Notes |
|---|---|---|---|---|---|---|
| `VITE_APP_URL` | Public app URL used as Supabase OAuth `redirectTo` | Client (VITE_) | Public | `.env.example` | Falls back to `window.location.origin` (fine for local dev) | Set to `https://www.bizscope.app` in Production Vercel env |

---

## Complete Variable Quick Reference

```
# Required for production
GEMINI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_PRO=
STRIPE_PRICE_ID_PRO_PLUS=
APP_URL=https://www.bizscope.app
VITE_APP_URL=https://www.bizscope.app
RESEND_API_KEY=
CONTACT_TO_EMAIL=

# Analytics (set in Vercel Production only after privacy review)
VITE_GA_MEASUREMENT_ID=
VITE_CLARITY_PROJECT_ID=

# Feature flags (safe to omit — all default to 'false')
VITE_DEMO_MODE=false
PRO_TRIAL_ENABLED=false
VITE_PRO_TRIAL_ENABLED=false
VITE_REAL_REPORTS_ENABLED=false
VITE_BETA_ROLES=
VITE_BETA_FULL_ACCESS=false
VITE_BETA_CLOSED=false

# Optional
CONTACT_FROM_ADDRESS=BizScope Contact <contact@bizscope.ai>
```

---

## Notes on Variable Pairing

- `SUPABASE_URL` and `VITE_SUPABASE_URL` must point to the **same** Supabase project. They are kept separate only to maintain the boundary between server-side and client-side reads.
- `PRO_TRIAL_ENABLED` (server) and `VITE_PRO_TRIAL_ENABLED` (client) must both be `true` for the full trial experience. If only the client flag is set, users see the CTA but checkout creates a normal paid session. If only the server flag is set, the CTA is hidden but the server will still grant a trial when requested directly.
- `VITE_DEMO_MODE=false` is the correct production value. The vite.config.ts `define` block defaults it to `false` when absent, so omitting it in production is equivalent.
