-- Push notification device tokens for ExamNexus native mobile app.
-- Run in Supabase SQL Editor after notifications_and_announcement_social.sql.

CREATE TABLE IF NOT EXISTS public.push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'unknown'
    CHECK (platform IN ('ios', 'android', 'web', 'unknown')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS push_devices_user_idx
  ON public.push_devices (user_id);

ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_devices_select_own ON public.push_devices;
DROP POLICY IF EXISTS push_devices_insert_own ON public.push_devices;
DROP POLICY IF EXISTS push_devices_update_own ON public.push_devices;
DROP POLICY IF EXISTS push_devices_delete_own ON public.push_devices;

CREATE POLICY push_devices_select_own
  ON public.push_devices FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY push_devices_insert_own
  ON public.push_devices FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY push_devices_update_own
  ON public.push_devices FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY push_devices_delete_own
  ON public.push_devices FOR DELETE TO authenticated
  USING (user_id = auth.uid());

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
  ON CONFLICT (token) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_push_device(text, text) TO authenticated;

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

-- Helper: student user ids who should receive a subject-section announcement.
CREATE OR REPLACE FUNCTION public.get_announcement_recipient_ids(
  p_subject_id uuid,
  p_target_sections text[] DEFAULT NULL
)
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT coalesce(array_agg(DISTINCT ss.student_id), ARRAY[]::uuid[])
  FROM public.subject_students ss
  WHERE ss.subject_id = p_subject_id
    AND (
      p_target_sections IS NULL
      OR cardinality(p_target_sections) = 0
      OR public.sections_overlap(ss.section, p_target_sections)
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_announcement_recipient_ids(uuid, text[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
