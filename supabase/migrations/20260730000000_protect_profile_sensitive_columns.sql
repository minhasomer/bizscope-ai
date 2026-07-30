-- ============================================================
-- Migration: protect profile sensitive columns from client writes
-- ============================================================
-- The profiles_update_own RLS policy (profiles_select/insert/
-- update_own) lets authenticated users UPDATE their own row, but
-- imposes no column-level restriction. This allows a user to set
-- role='Admin', subscription_tier='ProPlus', email='attacker@…',
-- etc. with nothing more than their own JWT.
--
-- Fix: add a BEFORE UPDATE trigger that inspects current_user.
-- When called by the 'authenticated' role (all REST API requests
-- using a user JWT), changes to any of the protected columns are
-- rejected with SQLSTATE 42501 (insufficient_privilege).
--
-- service_role (Stripe webhook, admin server operations) is NOT
-- 'authenticated', so it retains unrestricted write access to
-- subscription_tier, role, and all other columns.
--
-- Protected columns (user must not self-edit):
--   id               — primary key / identity
--   email            — must mirror auth.users; not client-settable
--   role             — authorization tier (controls feature access)
--   subscription_tier — billing tier (controls feature access)
--   created_at       — immutable audit timestamp
--
-- User-editable columns (unchanged by this migration):
--   full_name        — display name
--   avatar_url       — profile picture URL
--   tos_accepted_at  — ToS acceptance timestamp
--   updated_at       — managed by trg_profiles_updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER          -- runs as caller; current_user reflects Supabase auth role
SET search_path = ''      -- prevent search_path-based injection
AS $$
BEGIN
  -- Allow service_role, postgres, and any superuser to modify any column.
  -- Only the 'authenticated' role (normal user JWT via REST API) is restricted.
  IF current_user = 'authenticated' THEN

    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'profiles: id is immutable'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'profiles: email is not user-editable'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'profiles: role is not user-editable'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
      RAISE EXCEPTION 'profiles: subscription_tier is not user-editable'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'profiles: created_at is immutable'
        USING ERRCODE = '42501';
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_profile_columns() IS
  'BEFORE UPDATE trigger: prevents authenticated users from self-escalating '
  'role, subscription_tier, email, id, or created_at. '
  'service_role retains full write access for Stripe webhook and admin operations.';

-- Drop and recreate to ensure the trigger uses the latest function body.
DROP TRIGGER IF EXISTS trg_protect_profile_columns ON public.profiles;

CREATE TRIGGER trg_protect_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_columns();
