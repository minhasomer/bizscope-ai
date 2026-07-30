-- ============================================================
-- Migration: Pro 7-day free trial support
-- ============================================================
-- Schema additions:
--   profiles.has_used_trial         — permanent one-trial-per-user marker
--   subscriptions.trial_started_at  — when the trial began
--   subscriptions.trial_ends_at     — when the trial ends (matches Stripe trial_end)
--
-- Security: has_used_trial is added to the protect_profile_columns trigger
-- so authenticated users cannot flip it back to FALSE to re-claim a trial.
-- ============================================================

-- 1. Add has_used_trial to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Add trial date columns to subscriptions (nullable — non-trial rows stay null)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at    TIMESTAMPTZ;

-- 3. Extend the protect_profile_columns trigger to guard has_used_trial.
--    Recreating the full function is required because ALTER FUNCTION cannot
--    change the body without CREATE OR REPLACE.
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user = 'authenticated' THEN

    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'profiles: id is immutable' USING ERRCODE = '42501';
    END IF;

    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'profiles: email is not user-editable' USING ERRCODE = '42501';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'profiles: role is not user-editable' USING ERRCODE = '42501';
    END IF;

    IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
      RAISE EXCEPTION 'profiles: subscription_tier is not user-editable' USING ERRCODE = '42501';
    END IF;

    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'profiles: created_at is immutable' USING ERRCODE = '42501';
    END IF;

    IF NEW.has_used_trial IS DISTINCT FROM OLD.has_used_trial THEN
      RAISE EXCEPTION 'profiles: has_used_trial is not user-editable' USING ERRCODE = '42501';
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_profile_columns() IS
  'BEFORE UPDATE trigger: prevents authenticated users from self-escalating '
  'role, subscription_tier, email, id, created_at, or resetting has_used_trial. '
  'service_role retains full write access for Stripe webhook and admin operations.';

-- Trigger is already created; recreating in case function body changed.
DROP TRIGGER IF EXISTS trg_protect_profile_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_columns();
