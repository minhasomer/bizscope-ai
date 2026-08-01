-- supabase/migrations/20260801000000_create_chat_usage_daily.sql
--
-- Chat usage daily tracking for the BizScope Assistant.
-- Tracks per-user/per-anon daily message limits, cost, and blocked requests.
--
-- SCOPE: Apply to staging only. Do NOT apply to production.
-- The chatbot is not deployed to production.

CREATE TABLE IF NOT EXISTS public.chat_usage_daily (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_type  TEXT           NOT NULL CHECK (identity_type IN ('user', 'anon')),
  identity_key   TEXT           NOT NULL,   -- user_id for auth, sha256(ip) for anon
  user_id        UUID           REFERENCES auth.users(id) ON DELETE SET NULL,
  usage_date     DATE           NOT NULL DEFAULT CURRENT_DATE,
  message_count  INTEGER        NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  blocked_count  INTEGER        NOT NULL DEFAULT 0 CHECK (blocked_count >= 0),
  input_tokens   INTEGER        NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens  INTEGER        NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  estimated_cost NUMERIC(10, 6) NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (identity_type, identity_key, usage_date)
);

CREATE INDEX IF NOT EXISTS chat_usage_daily_date_idx
  ON public.chat_usage_daily (usage_date, identity_type, identity_key);

CREATE INDEX IF NOT EXISTS chat_usage_daily_user_date_idx
  ON public.chat_usage_daily (user_id, usage_date)
  WHERE user_id IS NOT NULL;

-- RLS: deny all direct client access — server-side service role only
ALTER TABLE public.chat_usage_daily ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chat_usage_daily' AND policyname = 'no_client_read'
  ) THEN
    CREATE POLICY no_client_read  ON public.chat_usage_daily FOR SELECT USING (false);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chat_usage_daily' AND policyname = 'no_client_write'
  ) THEN
    CREATE POLICY no_client_write ON public.chat_usage_daily FOR ALL    USING (false);
  END IF;
END;
$$;

GRANT ALL ON public.chat_usage_daily TO service_role;

-- ── chat_check_and_increment ─────────────────────────────────────────────────
--
-- Atomically checks the daily limit and increments if allowed.
-- Returns {allowed: boolean, count: integer} as JSONB.
-- Race-safe: uses a single conditional UPDATE — no SELECT-then-UPDATE gap.

CREATE OR REPLACE FUNCTION public.chat_check_and_increment(
  p_identity_type TEXT,
  p_identity_key  TEXT,
  p_user_id       UUID,
  p_usage_date    DATE,
  p_daily_limit   INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.chat_usage_daily
    (identity_type, identity_key, user_id, usage_date, message_count)
  VALUES
    (p_identity_type, p_identity_key, p_user_id, p_usage_date, 0)
  ON CONFLICT (identity_type, identity_key, usage_date)
  DO NOTHING;

  UPDATE public.chat_usage_daily
  SET
    message_count = message_count + 1,
    updated_at    = NOW()
  WHERE
    identity_type = p_identity_type AND
    identity_key  = p_identity_key  AND
    usage_date    = p_usage_date    AND
    message_count < p_daily_limit
  RETURNING message_count INTO v_count;

  IF v_count IS NOT NULL THEN
    RETURN jsonb_build_object('allowed', true, 'count', v_count);
  END IF;

  SELECT message_count INTO v_count
  FROM   public.chat_usage_daily
  WHERE  identity_type = p_identity_type AND
         identity_key  = p_identity_key  AND
         usage_date    = p_usage_date;

  RETURN jsonb_build_object('allowed', false, 'count', COALESCE(v_count, 0));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.chat_check_and_increment(TEXT, TEXT, UUID, DATE, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_check_and_increment TO service_role;

-- ── chat_log_cost ────────────────────────────────────────────────────────────
--
-- Additively updates token and cost totals after a successful Gemini response.
-- Call exactly once per successful response.

CREATE OR REPLACE FUNCTION public.chat_log_cost(
  p_identity_type  TEXT,
  p_identity_key   TEXT,
  p_usage_date     DATE,
  p_input_tokens   INTEGER,
  p_output_tokens  INTEGER,
  p_estimated_cost NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_usage_daily
  SET
    input_tokens   = input_tokens   + p_input_tokens,
    output_tokens  = output_tokens  + p_output_tokens,
    estimated_cost = estimated_cost + p_estimated_cost,
    updated_at     = NOW()
  WHERE
    identity_type = p_identity_type AND
    identity_key  = p_identity_key  AND
    usage_date    = p_usage_date;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.chat_log_cost(TEXT, TEXT, DATE, INTEGER, INTEGER, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chat_log_cost TO service_role;
