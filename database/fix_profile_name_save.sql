-- Safe profile-name save migration (no RLS / policy / trigger changes).
--
-- Use this INSTEAD of running the full database/users_signup_policies.sql while
-- ExamNexus is live. The full script drops/recreates RLS policies on public.users
-- and can deadlock against active app sessions calling ensure_user_profile().
--
-- Run in Supabase Dashboard → SQL Editor (one shot), then:
-- Project Settings → API → Reload schema (or wait for auto-reload).
--
-- Tip: if you still see a deadlock, close extra ExamNexus tabs, wait ~30s, retry.

CREATE OR REPLACE FUNCTION public.safe_text_to_int(p_value text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN NULLIF(TRIM(COALESCE(p_value, '')), '') ~ '^\d+$'
      THEN NULLIF(TRIM(p_value), '')::integer
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.patch_user_profile_from_auth_metadata(
  p_auth_user auth.users
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile public.users%ROWTYPE;
  meta jsonb := COALESCE(p_auth_user.raw_user_meta_data, '{}'::jsonb);
  meta_first_name text := NULLIF(TRIM(COALESCE(meta->>'first_name', '')), '');
  meta_last_name text := NULLIF(TRIM(COALESCE(meta->>'last_name', '')), '');
  meta_school_id text := NULLIF(TRIM(COALESCE(meta->>'school_id', '')), '');
  meta_role text := NULLIF(TRIM(COALESCE(meta->>'role', '')), '');
  meta_gender text := NULLIF(TRIM(COALESCE(meta->>'gender', '')), '');
  meta_department text := NULLIF(TRIM(COALESCE(meta->>'department', '')), '');
  meta_course text := NULLIF(TRIM(COALESCE(meta->>'course', '')), '');
  meta_year_level text := NULLIF(TRIM(COALESCE(meta->>'year_level', '')), '');
  meta_avatar_url text := NULLIF(TRIM(COALESCE(meta->>'avatar_url', '')), '');
  meta_age integer;
BEGIN
  IF COALESCE(meta->>'age', '') ~ '^\d+$' THEN
    meta_age := (meta->>'age')::integer;
  END IF;

  SELECT * INTO profile FROM public.users WHERE id = p_auth_user.id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.users
  SET
    email = COALESCE(p_auth_user.email, users.email),
    first_name = COALESCE(NULLIF(TRIM(users.first_name), ''), meta_first_name),
    last_name = COALESCE(NULLIF(TRIM(users.last_name), ''), meta_last_name),
    school_id = CASE
      WHEN meta_school_id IS NOT NULL
        AND meta_school_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND (
          NULLIF(TRIM(users.school_id), '') IS NULL
          OR users.school_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        )
      THEN meta_school_id
      ELSE users.school_id
    END,
    role = CASE
      WHEN lower(trim(coalesce(users.role, ''))) = 'admin' THEN users.role
      WHEN lower(trim(coalesce(users.role, ''))) = 'faculty' THEN users.role
      WHEN meta_role IS NOT NULL AND trim(meta_role) <> '' THEN meta_role
      ELSE COALESCE(users.role, 'Student')
    END,
    gender = COALESCE(NULLIF(TRIM(users.gender), ''), meta_gender),
    department = COALESCE(NULLIF(TRIM(users.department), ''), meta_department),
    course = COALESCE(NULLIF(TRIM(users.course), ''), meta_course),
    year_level = COALESCE(NULLIF(TRIM(users.year_level), ''), meta_year_level),
    age = COALESCE(users.age, meta_age),
    avatar_url = CASE
      WHEN meta_avatar_url IS NOT NULL
        AND (
          NULLIF(TRIM(users.avatar_url), '') IS NULL
          OR users.avatar_url = '/default-avatar.svg'
        )
      THEN meta_avatar_url
      ELSE COALESCE(NULLIF(TRIM(users.avatar_url), ''), meta_avatar_url, '/default-avatar.svg')
    END
  WHERE id = p_auth_user.id
  RETURNING * INTO profile;

  RETURN profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auth_user auth.users%ROWTYPE;
  profile public.users%ROWTYPE;
BEGIN
  SELECT * INTO auth_user FROM auth.users WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO profile FROM public.users WHERE id = auth.uid();

  IF FOUND THEN
    profile := public.patch_user_profile_from_auth_metadata(auth_user);
    RETURN profile;
  END IF;

  profile := public.insert_user_profile_from_auth_metadata(auth_user);
  RETURN profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.update_user_editable_profile(
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_department text DEFAULT NULL,
  p_course text DEFAULT NULL,
  p_year_level text DEFAULT NULL,
  p_age text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile public.users%ROWTYPE;
  auth_user auth.users%ROWTYPE;
  v_first_name text;
  v_last_name text;
  v_age integer := public.safe_text_to_int(p_age);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()) THEN
    PERFORM public.ensure_user_profile();
  END IF;

  SELECT * INTO profile FROM public.users WHERE id = auth.uid();
  SELECT * INTO auth_user FROM auth.users WHERE id = auth.uid();

  v_first_name := COALESCE(
    NULLIF(TRIM(p_first_name), ''),
    NULLIF(TRIM(profile.first_name), ''),
    NULLIF(TRIM(auth_user.raw_user_meta_data->>'first_name'), ''),
    NULL
  );
  v_last_name := COALESCE(
    NULLIF(TRIM(p_last_name), ''),
    NULLIF(TRIM(profile.last_name), ''),
    NULLIF(TRIM(auth_user.raw_user_meta_data->>'last_name'), ''),
    NULL
  );

  UPDATE public.users
  SET
    first_name = v_first_name,
    last_name = v_last_name,
    gender = COALESCE(NULLIF(TRIM(p_gender), ''), gender),
    department = COALESCE(NULLIF(TRIM(p_department), ''), department),
    course = COALESCE(NULLIF(TRIM(p_course), ''), course),
    year_level = COALESCE(NULLIF(TRIM(p_year_level), ''), year_level),
    age = COALESCE(v_age, age),
    avatar_url = CASE
      WHEN NULLIF(TRIM(p_avatar_url), '') LIKE 'http%'
        OR NULLIF(TRIM(p_avatar_url), '') LIKE '//%'
      THEN TRIM(p_avatar_url)
      WHEN NULLIF(TRIM(p_avatar_url), '') IS NOT NULL
      THEN TRIM(p_avatar_url)
      ELSE avatar_url
    END
  WHERE id = auth.uid()
  RETURNING * INTO profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_editable_profile(
  text, text, text, text, text, text, text, text
) TO authenticated;

NOTIFY pgrst, 'reload schema';
