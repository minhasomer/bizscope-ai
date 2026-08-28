-- ============================================================
-- Migration: decision_pass_entitlements
-- ============================================================
-- Stores one-time Decision Pass entitlements purchased via Stripe.
-- Each row = one verified Stripe checkout payment.
--
-- The Decision Pass grants:
--   viability_total    = 3 (Business Viability reports)
--   market_gap_total   = 1 (Market Gap Discovery reports)
--
-- Each entitlement type is tracked separately so a user cannot
-- spend viability balance on a Market Gap report or vice versa.
--
-- Idempotency:
--   stripe_checkout_session_id UNIQUE — prevents double-grant if
--   the webhook delivers the same event twice.
--
-- Concurrency:
--   Decrement RPCs use SELECT FOR UPDATE SKIP LOCKED so concurrent
--   requests cannot simultaneously claim the same row.
--
-- Durability:
--   Entitlements survive subscription cancellations and plan changes.
--   No expiration for initial launch.
--
-- Access:
--   All writes are via service_role (bypasses RLS). Balance is
--   surfaced to clients through /api/stripe/subscription-status.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.decision_pass_entitlements (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_checkout_session_id  TEXT        NOT NULL UNIQUE,
  viability_total             INT         NOT NULL DEFAULT 3 CHECK (viability_total > 0),
  viability_remaining         INT         NOT NULL CHECK (viability_remaining >= 0 AND viability_remaining <= viability_total),
  market_gap_total            INT         NOT NULL DEFAULT 1 CHECK (market_gap_total >= 0),
  market_gap_remaining        INT         NOT NULL CHECK (market_gap_remaining >= 0 AND market_gap_remaining <= market_gap_total),
  purchased_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS decision_pass_entitlements_user_id_idx
  ON public.decision_pass_entitlements (user_id);

ALTER TABLE public.decision_pass_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_pass_entitlements FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON TABLE public.decision_pass_entitlements TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ── decrement_decision_pass_viability ────────────────────────
-- Atomically decrements viability_remaining on the oldest pass
-- that still has viability balance. Returns the row UUID, or
-- NULL if no passes have viability balance remaining.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decrement_decision_pass_viability(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM public.decision_pass_entitlements
  WHERE user_id = p_user_id AND viability_remaining > 0
  ORDER BY purchased_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.decision_pass_entitlements
  SET viability_remaining = viability_remaining - 1
  WHERE id = v_id;

  RETURN v_id;
END;
$$;

-- ── restore_decision_pass_viability ─────────────────────────
-- Restores one viability credit on a specific pass row.
-- Called when report generation fails after a pre-decrement.
-- CHECK constraint (viability_remaining <= viability_total) guards
-- against inflation beyond the original purchased quantity.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.restore_decision_pass_viability(p_pass_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.decision_pass_entitlements
  SET viability_remaining = LEAST(viability_remaining + 1, viability_total)
  WHERE id = p_pass_id;
END;
$$;

-- ── decrement_decision_pass_market_gap ──────────────────────
-- Atomically decrements market_gap_remaining on the oldest pass
-- that still has market_gap balance. Returns the row UUID, or
-- NULL if no passes have market_gap balance remaining.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decrement_decision_pass_market_gap(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM public.decision_pass_entitlements
  WHERE user_id = p_user_id AND market_gap_remaining > 0
  ORDER BY purchased_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.decision_pass_entitlements
  SET market_gap_remaining = market_gap_remaining - 1
  WHERE id = v_id;

  RETURN v_id;
END;
$$;

-- ── restore_decision_pass_market_gap ────────────────────────
-- Restores one market_gap credit on a specific pass row.
-- LEAST guards against inflation beyond original quantity.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.restore_decision_pass_market_gap(p_pass_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.decision_pass_entitlements
  SET market_gap_remaining = LEAST(market_gap_remaining + 1, market_gap_total)
  WHERE id = p_pass_id;
END;
$$;

-- SECURITY DEFINER functions are callable by PUBLIC by default in PostgreSQL.
-- Revoke all public access before granting only to service_role.
REVOKE ALL ON FUNCTION public.decrement_decision_pass_viability(uuid)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_decision_pass_viability(uuid)     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrement_decision_pass_market_gap(uuid)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_decision_pass_market_gap(uuid)    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.decrement_decision_pass_viability(uuid)  TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_decision_pass_viability(uuid)     TO service_role;
GRANT EXECUTE ON FUNCTION public.decrement_decision_pass_market_gap(uuid)  TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_decision_pass_market_gap(uuid)    TO service_role;

NOTIFY pgrst, 'reload schema';
