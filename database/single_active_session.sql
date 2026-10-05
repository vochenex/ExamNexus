-- One active login per account.
-- Run in Supabase SQL Editor (no other script required first). Safe to re-run.
--
-- The app calls claim_active_session() right after a successful password check and
-- then every ~30 s while a dashboard is open (heartbeat). A login is refused when the
-- account's current session is on a different browser/device, still exists in
-- auth.sessions, and sent a heartbeat within the last 2 minutes. Closing a browser
-- without logging out frees the account after those 2 minutes.

CREATE TABLE IF NOT EXISTS public.active_sessions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  device_id text,
  device_label text,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only reachable through the SECURITY DEFINER functions below.
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.active_sessions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_active_session(
  p_device_id text DEFAULT NULL,
  p_device_label text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sid text := nullif(auth.jwt() ->> 'session_id', '');
  v_device text := nullif(trim(p_device_id), '');
  v_label text := left(nullif(trim(p_device_label), ''), 120);
  v_ttl interval := interval '2 minutes';
  v_row public.active_sessions;
  v_other_alive boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Tokens without a session id cannot be tracked; never lock those users out.
  IF v_sid IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'tracked', false);
  END IF;

  -- Serialise concurrent logins for the same account.
  PERFORM pg_advisory_xact_lock(hashtext('active_session:' || v_uid::text));

  SELECT * INTO v_row FROM public.active_sessions WHERE user_id = v_uid;

  IF FOUND
     AND v_row.session_id <> v_sid
     AND NOT (v_device IS NOT NULL AND v_row.device_id = v_device)
     AND v_row.last_seen > now() - v_ttl
  THEN
    BEGIN
      SELECT EXISTS (
        SELECT 1 FROM auth.sessions s WHERE s.id::text = v_row.session_id
      ) INTO v_other_alive;
    EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
      v_other_alive := true;
    END;

    IF v_other_alive THEN
      RETURN jsonb_build_object(
        'ok', false,
        'device_label', coalesce(v_row.device_label, 'another device'),
        'last_seen', v_row.last_seen,
        'seconds_ago', greatest(0, floor(extract(epoch FROM now() - v_row.last_seen)))::int
      );
    END IF;
  END IF;

  INSERT INTO public.active_sessions (user_id, session_id, device_id, device_label, last_seen, created_at)
  VALUES (v_uid, v_sid, v_device, v_label, now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET session_id = EXCLUDED.session_id,
        device_id = EXCLUDED.device_id,
        device_label = coalesce(EXCLUDED.device_label, public.active_sessions.device_label),
        last_seen = now(),
        created_at = CASE
          WHEN public.active_sessions.session_id = EXCLUDED.session_id THEN public.active_sessions.created_at
          ELSE now()
        END;

  RETURN jsonb_build_object('ok', true, 'tracked', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_active_session(text, text) TO authenticated;

-- Called on logout so the account is free immediately (instead of after 2 minutes).
CREATE OR REPLACE FUNCTION public.release_active_session()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sid text := nullif(auth.jwt() ->> 'session_id', '');
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.active_sessions
  WHERE user_id = v_uid
    AND (v_sid IS NULL OR session_id = v_sid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_active_session() TO authenticated;

NOTIFY pgrst, 'reload schema';
