-- Multi-account push on one device: keep the same FCM token bound to every
-- saved account that has logged in on this phone (do not steal the token).
-- Run in Supabase SQL Editor (safe to re-run).

ALTER TABLE public.push_devices
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Drop the old "one owner per token" uniqueness if present.
DO $$
DECLARE
  v_con text;
BEGIN
  SELECT c.conname INTO v_con
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'push_devices'
    AND c.contype = 'u'
    AND pg_get_constraintdef(c.oid) ILIKE '%(token)%'
    AND pg_get_constraintdef(c.oid) NOT ILIKE '%user_id%';

  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.push_devices DROP CONSTRAINT %I', v_con);
  END IF;
END $$;

DROP INDEX IF EXISTS public.push_devices_token_key;
DROP INDEX IF EXISTS public.push_devices_token_uidx;
DROP INDEX IF EXISTS public.push_devices_user_token_uidx;

-- Prefer a named UNIQUE constraint so ON CONFLICT (user_id, token) is reliable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'push_devices'
      AND c.conname = 'push_devices_user_token_key'
  ) THEN
    ALTER TABLE public.push_devices
      ADD CONSTRAINT push_devices_user_token_key UNIQUE (user_id, token);
  END IF;
EXCEPTION
  WHEN duplicate_table OR duplicate_object OR unique_violation THEN
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS push_devices_token_idx
  ON public.push_devices (token);

-- Bind current user to this device token WITHOUT removing other accounts.
CREATE OR REPLACE FUNCTION public.upsert_push_device(
  p_token text,
  p_platform text DEFAULT 'unknown'
)
RETURNS public.push_devices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.push_devices;
  v_platform text := lower(coalesce(nullif(trim(p_platform), ''), 'unknown'));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NULLIF(trim(p_token), '') IS NULL THEN
    RAISE EXCEPTION 'Push token is required';
  END IF;

  IF v_platform NOT IN ('ios', 'android', 'web', 'unknown') THEN
    v_platform := 'unknown';
  END IF;

  INSERT INTO public.push_devices (user_id, token, platform, updated_at)
  VALUES (v_user_id, trim(p_token), v_platform, now())
  ON CONFLICT (user_id, token) DO UPDATE
    SET platform = EXCLUDED.platform,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_push_device(text, text) TO authenticated;

-- Remove only the signed-in user's binding for this token.
CREATE OR REPLACE FUNCTION public.remove_push_device(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.push_devices
  WHERE user_id = auth.uid()
    AND token = trim(p_token);
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_push_device(text) TO authenticated;

-- Remove another saved account's binding from THIS device (proved by token).
-- Caller must already have a row for the same token (they own the phone).
CREATE OR REPLACE FUNCTION public.remove_push_device_binding(
  p_token text,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_token text := trim(p_token);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NULLIF(v_token, '') IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Token and user id are required';
  END IF;

  IF p_user_id = v_uid THEN
    DELETE FROM public.push_devices
    WHERE user_id = v_uid
      AND token = v_token;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.push_devices
    WHERE token = v_token
      AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'This device is not registered for the current user';
  END IF;

  DELETE FROM public.push_devices
  WHERE token = v_token
    AND user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_push_device_binding(text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
