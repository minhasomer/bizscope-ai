# Launch History

Commercial and public launch milestones for BizScope AI.

---

## 2026-06-29: LinkedIn Beta Announcement

**Type:** Soft launch / closed beta  
**Channel:** LinkedIn post by Omer Minhas  
**Access model:** Closed beta — `VITE_BETA_CLOSED=true` gate active. Interested users must sign up to request access; owner manually grants beta access.

**What was live at launch:**
- Full viability report generation (standard reports, Explorer plan)
- Google OAuth and email/password authentication
- Anonymous single-use preview (no signup required)
- Pricing page (plans visible; checkout not yet wired)
- Saved reports (Venture Hub)
- Market Gap Explorer (Pro+ feature; accessible via complimentary DB grant for beta testers)
- Contact form (via Resend)
- Terms of Service and Privacy Policy

**What was NOT yet live:**
- Stripe subscriptions (live checkout not enabled)
- Pro trial
- Analytics (GA4 / Clarity)

**Beta access control:** Managed via Supabase SQL (`profiles.role = 'BetaTester'` or `profiles.subscription_tier = 'Pro'` via direct DB grant). No self-serve upgrade path for beta users.

---

## 2026-07-18–24: Stripe Integration Complete (Staging)

**Type:** Internal milestone — not publicly announced  
**Status:** Validated on staging; Production activation pending

Full Stripe checkout, subscription lifecycle, and Customer Portal wired up and validated on staging environment. Stripe test-mode checkout confirmed working with test card `4242 4242 4242 4242`.

---

## 2026-07-30: Security Hardening Complete

**Type:** Internal milestone  
**Status:** Applied to staging; pending Production deployment

`protect_profile_columns` trigger and `saved_reports WITH CHECK` policy deployed to staging Supabase. Both should be applied to Production before any paid launch.

---

## 2026-07-31: Analytics and Trial CTA Ready

**Type:** Internal milestone  
**Status:** Staged; pending Production activation

- GA4 + Clarity fully implemented with privacy-preserving masking
- Pro trial implementation validated end-to-end
- Trial CTA staged on homepage

---

## Pending Launch Events

| Event | Prerequisite |
|---|---|
| Open beta (remove VITE_BETA_CLOSED gate) | Stripe Production live; security hardening applied to Production |
| First paid subscribers | Stripe Production live; pricing page pointing to live checkout |
| GA4 / Clarity activation | Privacy Policy analytics section verified live; no PII leaks confirmed via DebugView |
| Pro trial promotion | `PRO_TRIAL_ENABLED=true` in Vercel Production; `VITE_PRO_TRIAL_ENABLED=true` in Vercel Production + redeploy |
| Public launch announcement | All above + smoke test checklist passed on Production |
