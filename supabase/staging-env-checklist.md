# Vercel Staging Environment Variable Checklist

## Source: Staging Supabase dashboard → Project Settings → API

| Variable | Where to find it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL | `https://ebfbudzfdezekplbatlr.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → anon/public key | Safe to expose client-side |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → service_role key | Never expose client-side |

## Source: Your AI provider (same keys as production are acceptable for staging)

| Variable | Notes |
|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Can reuse production key; staging traffic is low |

## Source: Stripe (DO NOT configure yet — Stripe phase not started)

| Variable | Notes |
|---|---|
| `STRIPE_SECRET_KEY` | Use Stripe test-mode key when ready |
| `STRIPE_WEBHOOK_SECRET` | Staging webhook secret from Stripe dashboard |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Use Stripe test-mode key when ready |

## Vercel target
- Set these on the Preview environment (not Production)
- In Vercel: Project → Settings → Environment Variables → select "Preview"

## Never
- Use production Supabase keys in staging Vercel environment
- Set Stripe live-mode keys on staging