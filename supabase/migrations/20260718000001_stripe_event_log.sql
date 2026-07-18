-- ============================================================
-- Migration: stripe_event_log table and processing RPCs
-- ============================================================
-- Guarantees exactly-once processing of Stripe webhook events.
--
-- States:
--   processing — event claimed; writes in progress.
--   processed  — all writes completed successfully.
--   failed     — at least one write failed; Stripe will retry.
--
-- Two concurrent deliveries of the same event are safe:
--   · Only one INSERT can win (event_id PRIMARY KEY).
--   · The reclaim UPDATE uses a single conditional WHERE clause
--     so only one concurrent execution can get FOUND = true.
--
-- Hung processing rows (last_attempted_at > 120s) are eligible
-- for re-claim so a killed Vercel execution does not block
-- forever. 120s exceeds the max function timeout in this project.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stripe_event_log (
  event_id          text        PRIMARY KEY,
  event_type        text        NOT NULL,
  state             text        NOT NULL DEFAULT 'processing'
                                CHECK (state IN ('processing', 'processed', 'failed')),
  attempt_count     integer     NOT NULL DEFAULT 1,
  last_attempted_at timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  last_error        text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Service-role only. No user may read or write this table.
ALTER TABLE public.stripe_event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_event_log FORCE ROW LEVEL SECURITY;

-- ── begin_stripe_event ────────────────────────────────────────
-- Called at the start of every webhook handler, before any writes.
-- Returns one of:
--   'proceed'      — this execution owns the event.
--   'already_done' — fully processed in a prior delivery; return 200.
--   'in_progress'  — a live execution holds this event; return 200
--                    and allow Stripe to retry if that execution fails.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.begin_stripe_event(
  p_event_id   text,
  p_event_type text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_state text;
BEGIN
  -- Fast path: try to claim a new event.
  INSERT INTO public.stripe_event_log (event_id, event_type, state, attempt_count, last_attempted_at)
  VALUES (p_event_id, p_event_type, 'processing', 1, now())
  ON CONFLICT (event_id) DO NOTHING;

  IF FOUND THEN
    RETURN 'proceed';
  END IF;

  -- Event already exists. Try to reclaim it with a single atomic UPDATE.
  -- Eligible for reclaim when:
  --   · state = 'failed'  (previous attempt errored out)
  --   · state = 'processing' AND last_attempted_at is > 120s old (hung execution)
  -- Only one concurrent UPDATE can match; the other gets FOUND = false.
  UPDATE public.stripe_event_log
  SET
    state             = 'processing',
    attempt_count     = attempt_count + 1,
    last_attempted_at = now(),
    last_error        = NULL
  WHERE event_id = p_event_id
    AND (
      state = 'failed'
      OR (state = 'processing' AND (now() - last_attempted_at) >= interval '120 seconds')
    );

  IF FOUND THEN
    RETURN 'proceed';
  END IF;

  -- Could not reclaim. Determine why.
  SELECT state INTO v_state
  FROM public.stripe_event_log
  WHERE event_id = p_event_id;

  IF v_state = 'processed' THEN
    RETURN 'already_done';
  END IF;

  -- state = 'processing' and recent — another live execution has this event.
  RETURN 'in_progress';
END;
$$;

-- ── complete_stripe_event ────────────────────────────────────
-- Called after all writes for an event succeed.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_stripe_event(p_event_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.stripe_event_log
  SET state = 'processed', processed_at = now(), last_error = NULL
  WHERE event_id = p_event_id;
END;
$$;

-- ── fail_stripe_event ────────────────────────────────────────
-- Called when any write fails. Marks the event for Stripe retry.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fail_stripe_event(
  p_event_id  text,
  p_error_msg text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.stripe_event_log
  SET state = 'failed', last_error = p_error_msg
  WHERE event_id = p_event_id;
END;
$$;
