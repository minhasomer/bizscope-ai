-- ============================================================
-- Migration: production indexes not captured in earlier migrations
-- ============================================================
-- report_activity_log: three indexes existed in production
-- beyond what 20260619000001 created.
-- usage_tracking: two indexes existed beyond what 20260619000002
-- created.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_report_activity_log_created_at
  ON public.report_activity_log (created_at);

CREATE INDEX IF NOT EXISTS idx_report_activity_log_report_type
  ON public.report_activity_log (report_type, created_at);

CREATE INDEX IF NOT EXISTS idx_report_activity_log_user_id
  ON public.report_activity_log (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_usage_month_key
  ON public.usage_tracking (month_key);

CREATE INDEX IF NOT EXISTS idx_usage_user_id
  ON public.usage_tracking (user_id);
