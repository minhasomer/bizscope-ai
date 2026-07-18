-- ============================================================
-- Migration: profiles table
-- ============================================================
-- Captures the profiles table created directly in production.
-- One row per auth.users row; created by the handle_new_user
-- trigger (see 20260604000002) or by ensureProfileExists() as
-- a fallback for OAuth redirects.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             text,
  full_name         text,
  avatar_url        text,
  role              text NOT NULL DEFAULT 'Explorer'
                      CHECK (role = ANY (ARRAY[
                        'Explorer','Pro','ProPlus','Enterprise','BetaTester','Admin'
                      ])),
  subscription_tier text NOT NULL DEFAULT 'Explorer'
                      CHECK (subscription_tier = ANY (ARRAY[
                        'Explorer','Pro','ProPlus','Enterprise','BetaTester','Admin'
                      ])),
  tos_accepted_at   timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY profiles_select_own ON public.profiles
      FOR SELECT TO authenticated USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_insert_own'
  ) THEN
    CREATE POLICY profiles_insert_own ON public.profiles
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY profiles_update_own ON public.profiles
      FOR UPDATE TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
