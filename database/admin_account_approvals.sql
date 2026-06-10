-- Account approval workflow + promote admin
-- Run in Supabase SQL Editor AFTER users_signup_policies.sql and admin_platform.sql

-- ============================================================
-- ACCOUNT STATUS on users
-- ============================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_account_status_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_account_status_check
  CHECK (account_status IN ('pending', 'approved', 'rejected'));

COMMENT ON COLUMN public.users.account_status IS
  'pending = awaiting admin approval; approved = can use app; rejected = denied';

-- Existing accounts stay usable (one-time backfill when enabling approvals)
UPDATE public.users
SET account_status = 'approved'
WHERE account_status = 'pending';

-- Case-insensitive admin check (used by all admin RPCs / RLS)
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
      AND lower(trim(role)) = 'admin'
      AND account_status = 'approved'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.default_account_status(p_role text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(trim(coalesce(p_role, ''))) = 'admin' THEN 'approved'
    ELSE 'pending'
  END;
$$;

-- ============================================================
-- Signup profile helpers — new Student/Faculty start as pending
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
  v_role text := COALESCE(NULLIF(TRIM(COALESCE(meta->>'role', '')), ''), 'Student');
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
    avatar_url,
    account_status
  )
  VALUES (
    p_auth_user.id,
    p_auth_user.email,
    NULLIF(TRIM(COALESCE(meta->>'first_name', '')), ''),
    NULLIF(TRIM(COALESCE(meta->>'last_name', '')), ''),
    NULLIF(TRIM(COALESCE(meta->>'school_id', '')), ''),
    v_role,
    NULLIF(TRIM(COALESCE(meta->>'gender', '')), ''),
    NULLIF(TRIM(COALESCE(meta->>'department', '')), ''),
    NULLIF(TRIM(COALESCE(meta->>'course', '')), ''),
    NULLIF(TRIM(COALESCE(meta->>'year_level', '')), ''),
    CASE
      WHEN COALESCE(meta->>'age', '') ~ '^\d+$'
        THEN (meta->>'age')::integer
      ELSE NULL
    END,
    COALESCE(NULLIF(TRIM(COALESCE(meta->>'avatar_url', '')), ''), '/default-avatar.svg'),
    public.default_account_status(v_role)
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
    END,
    account_status = CASE
      WHEN lower(trim(public.users.role)) = 'admin' THEN public.users.account_status
      WHEN public.users.account_status = 'approved' THEN 'approved'
      ELSE COALESCE(public.users.account_status, public.default_account_status(EXCLUDED.role))
    END
  RETURNING * INTO profile;

  RETURN profile;
END;
$$;

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
  v_role text := COALESCE(NULLIF(TRIM(p_role), ''), 'Student');
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
    avatar_url,
    account_status
  )
  VALUES (
    auth.uid(),
    p_email,
    NULLIF(TRIM(p_first_name), ''),
    NULLIF(TRIM(p_last_name), ''),
    NULLIF(TRIM(p_school_id), ''),
    v_role,
    NULLIF(TRIM(p_gender), ''),
    NULLIF(TRIM(p_department), ''),
    NULLIF(TRIM(p_course), ''),
    NULLIF(TRIM(p_year_level), ''),
    p_age,
    COALESCE(NULLIF(TRIM(p_avatar_url), ''), '/default-avatar.svg'),
    public.default_account_status(v_role)
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
    END,
    account_status = CASE
      WHEN lower(trim(public.users.role)) = 'admin' THEN public.users.account_status
      WHEN public.users.account_status = 'approved' THEN 'approved'
      WHEN public.users.account_status = 'rejected' THEN 'rejected'
      ELSE public.default_account_status(EXCLUDED.role)
    END
  RETURNING * INTO profile;

  RETURN profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_signup_profile(
  text, text, text, text, text, text, text, text, text, integer, text
) TO authenticated;

-- ============================================================
-- Promote an existing user to Admin (run once for your admin)
-- Replace the email below, then run this block.
-- ============================================================
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(p_email text)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile public.users%ROWTYPE;
BEGIN
  UPDATE public.users
  SET
    role = 'Admin',
    account_status = 'approved'
  WHERE lower(trim(email)) = lower(trim(p_email))
  RETURNING * INTO profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No user found with email %', p_email;
  END IF;

  RETURN profile;
END;
$$;

-- Run promote_user_to_admin only in SQL Editor (do not grant to app clients)

-- Example: promote your admin (change email, run once, then comment out)
-- SELECT public.promote_user_to_admin('your-admin@email.com');

-- ============================================================
-- Admin review pending accounts
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_review_account(
  p_user_id uuid,
  p_action text
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile public.users%ROWTYPE;
  action text := lower(trim(coalesce(p_action, '')));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Action must be approve or reject';
  END IF;

  SELECT * INTO profile FROM public.users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF lower(trim(profile.role)) = 'admin' THEN
    RAISE EXCEPTION 'Cannot change approval status of an admin account';
  END IF;

  UPDATE public.users
  SET account_status = CASE WHEN action = 'approve' THEN 'approved' ELSE 'rejected' END
  WHERE id = p_user_id
  RETURNING * INTO profile;

  RETURN profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_review_account(uuid, text) TO authenticated;

-- ============================================================
-- Updated admin user list (status filter + pending first)
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_list_users(text);

CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_role text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS SETOF public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
    SELECT *
    FROM public.users u
    WHERE (p_role IS NULL OR trim(p_role) = '' OR u.role ILIKE trim(p_role))
      AND (
        p_status IS NULL
        OR trim(p_status) = ''
        OR u.account_status = lower(trim(p_status))
      )
    ORDER BY
      CASE u.account_status
        WHEN 'pending' THEN 0
        WHEN 'rejected' THEN 1
        ELSE 2
      END,
      u.created_at DESC NULLS LAST,
      u.last_name,
      u.first_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text) TO authenticated;

-- Add created_at if missing (for ordering new signups)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- ============================================================
-- Dashboard stats include pending count
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN jsonb_build_object(
    'users', (SELECT count(*) FROM public.users),
    'students', (SELECT count(*) FROM public.users WHERE role ILIKE 'student'),
    'faculty', (SELECT count(*) FROM public.users WHERE role ILIKE 'faculty'),
    'pending_requests', (
      SELECT count(*) FROM public.users
      WHERE account_status = 'pending'
        AND role ILIKE ANY (ARRAY['student', 'faculty'])
    ),
    'subjects', (SELECT count(*) FROM public.subjects),
    'assessments', (SELECT count(*) FROM public.exams),
    'results', (SELECT count(*) FROM public.exam_results),
    'integrity_events', (
      SELECT count(*)
      FROM public.exam_integrity_events
      WHERE to_regclass('public.exam_integrity_events') IS NOT NULL
    )
  );
END;
$$;

-- ============================================================
-- Approved faculty only (subject assignment)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_list_faculty()
RETURNS SETOF public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
    SELECT *
    FROM public.users
    WHERE role ILIKE 'faculty'
      AND account_status = 'approved'
    ORDER BY last_name, first_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_subject_faculty(
  p_subject_id uuid,
  p_faculty_school_id text
)
RETURNS public.subjects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  subject_row public.subjects%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE school_id = trim(p_faculty_school_id)
      AND role ILIKE 'faculty'
      AND account_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Approved faculty not found for that school ID';
  END IF;

  UPDATE public.subjects
  SET teacher_school_id = trim(p_faculty_school_id)
  WHERE id = p_subject_id
  RETURNING * INTO subject_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subject not found';
  END IF;

  RETURN subject_row;
END;
$$;

-- Fix subjects list RPC (proper admin guard + correct exam count)
DROP FUNCTION IF EXISTS public.admin_list_subjects_with_faculty();

CREATE OR REPLACE FUNCTION public.admin_list_subjects_with_faculty()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_data ORDER BY subject_name)
      FROM (
        SELECT
          jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'invite_code', s.invite_code,
            'teacher_school_id', s.teacher_school_id,
            'year_level', s.year_level,
            'section_count', s.section_count,
            'subject_type', s.subject_type,
            'faculty_first_name', f.first_name,
            'faculty_last_name', f.last_name,
            'faculty_email', f.email,
            'enrolled_count', (
              SELECT count(*) FROM public.subject_students ss WHERE ss.subject_id = s.id
            ),
            'assessment_count', (
              SELECT count(*) FROM public.exams e WHERE e.subject_id = s.id
            )
          ) AS row_data,
          s.name AS subject_name
        FROM public.subjects s
        LEFT JOIN LATERAL (
          SELECT first_name, last_name, email
          FROM public.users u
          WHERE u.school_id = s.teacher_school_id
            AND u.role ILIKE 'faculty'
          LIMIT 1
        ) f ON true
      ) q
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_subjects_with_faculty() TO authenticated;
