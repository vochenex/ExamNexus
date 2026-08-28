-- Harden profile name writes so repair/upsert paths cannot silently rename users.
-- Context: students reported their name "changed" when an old Android APK showed
-- multi-account push banners titled "For <OtherAccount>: …". Push handlers never
-- wrote profiles; a separate risk was upsert_signup_profile preferring incoming
-- first_name/last_name over existing DB values during avatar/school-id repairs.
--
-- Run in Supabase SQL Editor, then Project Settings → API → Reload schema.

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
  p_age text DEFAULT NULL,
  p_avatar_url text DEFAULT '/default-avatar.svg'
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile public.users%ROWTYPE;
  v_age integer := public.safe_text_to_int(p_age);
  v_incoming_first text := NULLIF(TRIM(p_first_name), '');
  v_incoming_last text := NULLIF(TRIM(p_last_name), '');
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
    v_incoming_first,
    v_incoming_last,
    NULLIF(TRIM(p_school_id), ''),
    COALESCE(NULLIF(TRIM(p_role), ''), 'Student'),
    NULLIF(TRIM(p_gender), ''),
    NULLIF(TRIM(p_department), ''),
    NULLIF(TRIM(p_course), ''),
    NULLIF(TRIM(p_year_level), ''),
    v_age,
    COALESCE(NULLIF(TRIM(p_avatar_url), ''), '/default-avatar.svg')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    -- Keep an existing non-empty name. Only fill blanks from the payload.
    -- Intentional renames must use update_user_editable_profile.
    first_name = COALESCE(
      NULLIF(TRIM(public.users.first_name), ''),
      EXCLUDED.first_name
    ),
    last_name = COALESCE(
      NULLIF(TRIM(public.users.last_name), ''),
      EXCLUDED.last_name
    ),
    school_id = COALESCE(NULLIF(TRIM(EXCLUDED.school_id), ''), public.users.school_id),
    role = CASE
      WHEN lower(trim(coalesce(public.users.role, ''))) IN ('admin', 'faculty')
        THEN public.users.role
      ELSE EXCLUDED.role
    END,
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
  text, text, text, text, text, text, text, text, text, text, text
) TO authenticated;

NOTIFY pgrst, 'reload schema';
