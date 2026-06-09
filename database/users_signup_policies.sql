-- Run once in Supabase Dashboard → SQL Editor
-- Signup + login profile sync + user RLS policies for public.users

-- ============================================================
-- HELPER: check if the logged-in user is an Admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role = 'Admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- USER RLS POLICIES (run this block if a policy is missing)
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_insert_own ON public.users;
CREATE POLICY users_insert_own ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS users_delete_own ON public.users;
CREATE POLICY users_delete_own ON public.users
  FOR DELETE TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS users_delete_admin ON public.users;
CREATE POLICY users_delete_admin ON public.users
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS users_select_admin ON public.users;
CREATE POLICY users_select_admin ON public.users
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================================
-- RPC: delete a user account (profile + auth + related rows)
-- Admin can delete any user; non-admin can only delete themselves
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid DEFAULT auth.uid())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can delete other users';
  END IF;

  DELETE FROM public.subject_students WHERE student_id = p_user_id;
  DELETE FROM public.exam_results WHERE student_id = p_user_id;

  IF to_regclass('public.student_answers') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.student_answers WHERE student_id = $1'
      USING p_user_id;
  END IF;

  DELETE FROM public.users WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO authenticated;

-- ============================================================
-- FUNCTION: refresh profile from signup metadata on login
-- ============================================================
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
    first_name = COALESCE(meta_first_name, users.first_name),
    last_name = COALESCE(meta_last_name, users.last_name),
    school_id = CASE
      WHEN meta_school_id IS NOT NULL
        AND meta_school_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN meta_school_id
      WHEN users.school_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND meta_school_id IS NOT NULL
      THEN meta_school_id
      ELSE users.school_id
    END,
    role = COALESCE(meta_role, users.role, 'Student'),
    gender = COALESCE(meta_gender, users.gender),
    department = COALESCE(meta_department, users.department),
    course = COALESCE(meta_course, users.course),
    year_level = COALESCE(meta_year_level, users.year_level),
    age = COALESCE(meta_age, users.age),
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

-- ============================================================
-- FUNCTION: create profile row from signup metadata
-- ============================================================
CREATE OR REPLACE FUNCTION public.insert_user_profile_from_auth_metadata(
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
BEGIN
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
    p_auth_user.id,
    p_auth_user.email,
    NULLIF(TRIM(COALESCE(meta->>'first_name', '')), ''),
    NULLIF(TRIM(COALESCE(meta->>'last_name', '')), ''),
    NULLIF(TRIM(COALESCE(meta->>'school_id', '')), ''),
    COALESCE(NULLIF(TRIM(COALESCE(meta->>'role', '')), ''), 'Student'),
    NULLIF(TRIM(COALESCE(meta->>'gender', '')), ''),
    NULLIF(TRIM(COALESCE(meta->>'department', '')), ''),
    NULLIF(TRIM(COALESCE(meta->>'course', '')), ''),
    NULLIF(TRIM(COALESCE(meta->>'year_level', '')), ''),
    CASE
      WHEN COALESCE(meta->>'age', '') ~ '^\d+$'
        THEN (meta->>'age')::integer
      ELSE NULL
    END,
    COALESCE(NULLIF(TRIM(COALESCE(meta->>'avatar_url', '')), ''), '/default-avatar.svg')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, public.users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.users.last_name),
    school_id = CASE
      WHEN EXCLUDED.school_id IS NOT NULL
        AND EXCLUDED.school_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN EXCLUDED.school_id
      WHEN public.users.school_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND EXCLUDED.school_id IS NOT NULL
      THEN EXCLUDED.school_id
      ELSE public.users.school_id
    END,
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

-- ============================================================
-- TRIGGER: auto-create profile when auth account is created
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.insert_user_profile_from_auth_metadata(NEW);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================
-- RPC: called by the app on every login
-- ============================================================
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

-- ============================================================
-- RPC: save editable profile fields (bypasses RLS issues)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_user_editable_profile(
  p_first_name text,
  p_last_name text,
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

-- ============================================================
-- RPC: save avatar URL only (for profile photo upload)
-- ============================================================
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

-- ============================================================
-- RPC: repair school_id from signup metadata
-- ============================================================
CREATE OR REPLACE FUNCTION public.repair_profile_school_id()
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auth_user auth.users%ROWTYPE;
  profile public.users%ROWTYPE;
  meta_school_id text;
BEGIN
  SELECT * INTO auth_user FROM auth.users WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  meta_school_id := NULLIF(TRIM(COALESCE(auth_user.raw_user_meta_data->>'school_id', '')), '');

  IF meta_school_id IS NULL THEN
    SELECT * INTO profile FROM public.users WHERE id = auth.uid();
    RETURN profile;
  END IF;

  UPDATE public.users
  SET school_id = meta_school_id
  WHERE id = auth.uid()
    AND (
      NULLIF(TRIM(school_id), '') IS NULL
      OR school_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
  RETURNING * INTO profile;

  IF NOT FOUND THEN
    SELECT * INTO profile FROM public.users WHERE id = auth.uid();
  END IF;

  RETURN profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_profile_school_id() TO authenticated;

-- ============================================================
-- RPC: upsert full signup profile
-- ============================================================
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
    role = EXCLUDED.role,
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

