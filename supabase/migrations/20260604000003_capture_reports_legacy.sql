-- ============================================================
-- Migration: reports table (legacy)
-- ============================================================
-- Captures the reports table created directly in production.
-- This table predates saved_reports and is no longer referenced
-- by application code. Captured here to make the repo
-- authoritative; no application changes required.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  business_type   text,
  location        text,
  report_type     text,
  viability_score integer,
  report_data     jsonb,
  is_favorite     boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reports' AND policyname = 'reports: select own'
  ) THEN
    CREATE POLICY "reports: select own" ON public.reports
      FOR SELECT TO public USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reports' AND policyname = 'reports: insert own'
  ) THEN
    CREATE POLICY "reports: insert own" ON public.reports
      FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reports' AND policyname = 'reports: update own'
  ) THEN
    CREATE POLICY "reports: update own" ON public.reports
      FOR UPDATE TO public
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reports' AND policyname = 'reports: delete own'
  ) THEN
    CREATE POLICY "reports: delete own" ON public.reports
      FOR DELETE TO public USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_reports_updated_at ON public.reports;
CREATE TRIGGER trg_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
