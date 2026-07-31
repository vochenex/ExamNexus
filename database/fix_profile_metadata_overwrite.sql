-- Fix: profile edits (department/course/year_level/etc.) were reverted on reload
-- because patch_user_profile_from_auth_metadata preferred stale signup metadata.
-- Prefer existing public.users values; only fill from auth metadata when empty.
--
-- Run in Supabase SQL Editor, then Project Settings → API → Reload schema.

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
