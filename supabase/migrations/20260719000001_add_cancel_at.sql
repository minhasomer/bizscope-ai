-- ============================================================
-- Migration: add cancel_at to subscriptions
-- ============================================================
-- Stores the raw Stripe cancel_at Unix timestamp (as timestamptz)
-- so the application can derive cancellation-pending state from
-- the actual Stripe field rather than solely from the
-- cancel_at_period_end boolean.
--
-- Background: newer Stripe API versions (and the Customer Portal)
-- schedule end-of-period cancellations by setting cancel_at to an
-- absolute timestamp equal to current_period_end, while leaving
-- cancel_at_period_end=false.  Storing cancel_at directly lets
-- the API layer detect pending cancellation via:
--   cancel_at_period_end = true  OR  (cancel_at IS NOT NULL AND cancel_at > now())
-- ============================================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at timestamptz;
