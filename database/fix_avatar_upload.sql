-- Run in Supabase Dashboard → SQL Editor
-- Fixes avatar save + profile edit restrictions

CREATE OR REPLACE FUNCTION public.update_user_avatar(p_avatar_url text)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile public.users%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NULLIF(TRIM(p_avatar_url), '') IS NULL THEN
    RAISE EXCEPTION 'Avatar URL is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()) THEN
    PERFORM public.ensure_user_profile();
  END IF;

  UPDATE public.users
  SET avatar_url = TRIM(p_avatar_url)
  WHERE id = auth.uid()
  RETURNING * INTO profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_avatar(text) TO authenticated;

DROP FUNCTION IF EXISTS public.update_user_editable_profile(
  text, text, text, text, text, text, integer, text
);
DROP FUNCTION IF EXISTS public.update_user_editable_profile(
  text, text, text, text, text, text, text, text
);

CREATE OR REPLACE FUNCTION public.update_user_editable_profile(
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_department text DEFAULT NULL,
  p_course text DEFAULT NULL,
  p_year_level text DEFAULT NULL,
  p_age integer DEFAULT NULL,
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
    age = COALESCE(p_age, age),
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
  text, text, text, text, text, text, integer, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_signup_profile(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_school_id text,
  p_role text DEFAULT 'Student',
  p_gender text DEFAULT NULL,
  p_department text DEFAULT NULL,
  p_course text DEFAULT NULL,
  p_year_level text DEFAULT NULL,
  p_age integer DEFAULT NULL,
  p_avatar_url text DEFAULT '/default-avatar.svg'
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile public.users%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.users (
    id,
    email,
    first_name,
    last_name,
    school_id,
    role,
    gender,
    department,
    course,
    year_level,
    age,
    avatar_url
  )
  VALUES (
    auth.uid(),
    p_email,
    NULLIF(TRIM(p_first_name), ''),
    NULLIF(TRIM(p_last_name), ''),
    NULLIF(TRIM(p_school_id), ''),
    COALESCE(NULLIF(TRIM(p_role), ''), 'Student'),
    NULLIF(TRIM(p_gender), ''),
    NULLIF(TRIM(p_department), ''),
    NULLIF(TRIM(p_course), ''),
    NULLIF(TRIM(p_year_level), ''),
    p_age,
    COALESCE(NULLIF(TRIM(p_avatar_url), ''), '/default-avatar.svg')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, public.users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.users.last_name),
    school_id = COALESCE(NULLIF(TRIM(EXCLUDED.school_id), ''), public.users.school_id),
    role = COALESCE(EXCLUDED.role, public.users.role),
    gender = COALESCE(EXCLUDED.gender, public.users.gender),
    department = COALESCE(EXCLUDED.department, public.users.department),
    course = COALESCE(EXCLUDED.course, public.users.course),
    year_level = COALESCE(EXCLUDED.year_level, public.users.year_level),
    age = COALESCE(EXCLUDED.age, public.users.age),
    avatar_url = CASE
      WHEN NULLIF(TRIM(EXCLUDED.avatar_url), '') LIKE 'http%'
        OR NULLIF(TRIM(EXCLUDED.avatar_url), '') LIKE '//%'
      THEN EXCLUDED.avatar_url
      ELSE COALESCE(NULLIF(TRIM(public.users.avatar_url), ''), EXCLUDED.avatar_url)
    END
  RETURNING * INTO profile;

  RETURN profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_signup_profile(
  text, text, text, text, text, text, text, text, text, integer, text
) TO authenticated;

NOTIFY pgrst, 'reload schema';
