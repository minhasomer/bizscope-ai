-- ============================================================
-- Migration: subscriptions table constraints and cancel column
-- ============================================================
-- Adds production-safe uniqueness protection and the column
-- needed to distinguish scheduled cancellation from actual end.
--
-- PREFLIGHT — run these queries and verify all return zero rows
-- before applying this migration to staging or production:
--
--   SELECT user_id, count(*) FROM public.subscriptions
--   GROUP BY user_id HAVING count(*) > 1;
--
--   SELECT stripe_customer_id, count(*) FROM public.subscriptions
--   WHERE stripe_customer_id IS NOT NULL
--   GROUP BY stripe_customer_id HAVING count(*) > 1;
--
--   SELECT stripe_subscription_id, count(*) FROM public.subscriptions
--   WHERE stripe_subscription_id IS NOT NULL
--   GROUP BY stripe_subscription_id HAVING count(*) > 1;
-- ============================================================

-- One subscription record per user.
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);

-- Prevent two users from being assigned the same Stripe customer.
-- NULL values are excluded so rows without a customer yet are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_subscriptions_customer_id
  ON public.subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Prevent two users from being assigned the same Stripe subscription.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_subscriptions_subscription_id
  ON public.subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Distinguishes "subscription scheduled to cancel at period end" from
-- "subscription has actually ended". The webhook handler sets this to
-- true on subscription.updated with cancel_at_period_end=true, and
-- back to false once the subscription is deleted or reactivated.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;
