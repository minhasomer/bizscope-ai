-- ============================================================
-- Migration: subscriptions table
-- ============================================================
-- Captures the subscriptions table created directly in
-- production. Stores Stripe subscription state per user.
-- Users have SELECT access only; writes come exclusively from
-- the service-role Stripe webhook handler.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  plan                    text NOT NULL DEFAULT 'Explorer',
  status                  text NOT NULL DEFAULT 'inactive',
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'subscriptions' AND policyname = 'subscriptions: select own'
  ) THEN
    CREATE POLICY "subscriptions: select own" ON public.subscriptions
      FOR SELECT TO public USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
