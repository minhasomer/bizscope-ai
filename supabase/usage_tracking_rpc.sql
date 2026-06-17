-- BizScope AI — server-side quota tracking
-- Run this in the Supabase SQL Editor before deploying the quota-enforcement code.

-- 1. Enforce one row per (user, report_type, month) so the RPC below can upsert atomically.
ALTER TABLE public.usage_tracking
  ADD CONSTRAINT usage_tracking_user_report_month_key UNIQUE (user_id, report_type, month_key);

-- 2. Atomic increment RPC — avoids read-then-write races under concurrent requests.
CREATE OR REPLACE FUNCTION public.increment_usage_tracking(
  p_user_id uuid,
  p_report_type text,
  p_month_key text
) RETURNS public.usage_tracking
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.usage_tracking;
BEGIN
  INSERT INTO public.usage_tracking (user_id, report_type, usage_date, month_key, count)
  VALUES (p_user_id, p_report_type, CURRENT_DATE, p_month_key, 1)
  ON CONFLICT (user_id, report_type, month_key)
  DO UPDATE SET count = public.usage_tracking.count + 1, updated_at = now()
  RETURNING * INTO result;
  RETURN result;
END;
$$;

-- 3. Grants — same pattern as the report_activity_log fix earlier this project:
--    service_role must have explicit table + sequence + function grants, or every
--    insert/select/RPC call silently fails with "permission denied".
GRANT SELECT, INSERT, UPDATE ON TABLE public.usage_tracking TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_usage_tracking(uuid, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
