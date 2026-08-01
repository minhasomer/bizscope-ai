# Project Timeline

Key milestones for BizScope AI, in chronological order.

---

| Date | Milestone | Notes |
|---|---|---|
| 2026-06-04 | Database schema foundation | `profiles`, `saved_reports`, `report_cache`, auth trigger migrations applied to Supabase |
| 2026-06-08 | `report_cache` added | Gemini response deduplication enabled |
| 2026-06-18 | Pre-beta audit sprint complete | ~60 regression tests added; AI cost accounting live; scoreless UX enforced |
| 2026-06-19 | `usage_logs` table live | Per-report cost tracking and hard-cap budget guard enabled |
| 2026-06-23 | Analysis timeouts hardened | `maxDuration` set for Vercel functions; long-wait messaging improved |
| 2026-06-23 | Production main SHA: `5dc6133` | Stable baseline before beta launch |
| 2026-06-29 | LinkedIn beta announcement | Public soft launch; closed beta gate active |
| 2026-07-01 | Decision framework UX complete | Action-oriented recommendation labels deployed |
| 2026-07-18 | Stripe integration complete | Full checkout → webhook → subscription lifecycle validated on staging |
| 2026-07-24 | Billing page live | Active subscriber portal access, correct plan display |
| 2026-07-29 | Regional analysis (`gemini-3.1-pro-preview`) | Pro+ market gap reports operational; quota on cache hits fixed |
| 2026-07-30 | Security hardening | `protect_profile_columns` trigger; `WITH CHECK` on saved_reports UPDATE |
| 2026-07-30 | 7-day Pro trial complete | Full trial lifecycle validated on staging; feature toggle wired |
| 2026-07-31 | Analytics baseline | GA4 Strategy B, Clarity masking, UTM attribution, sitemap, Search Console |
| 2026-07-31 | Trial CTA on homepage | Hero CTA added; Privacy Policy analytics section corrected |

---

## Pending Milestones

| Target | Milestone |
|---|---|
| TBD | Activate GA4 + Clarity on Production |
| TBD | Activate Pro trial on Production |
| TBD | Open beta to the public (remove VITE_BETA_CLOSED gate) |
| TBD | First paid subscriber |
| TBD | First 100 users |
| TBD | Measurement Protocol events for server-side Stripe lifecycle (trial_started, subscription_activated, etc.) |
