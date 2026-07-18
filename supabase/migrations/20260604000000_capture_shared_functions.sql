-- ============================================================
-- Migration: shared trigger functions
-- ============================================================
-- Captures set_updated_at(), which was created directly in
-- production and referenced by triggers on profiles, reports,
-- subscriptions, and usage_tracking. Must run before any
-- migration that creates those triggers.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
