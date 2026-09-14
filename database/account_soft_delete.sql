-- Soft-delete accounts: keep in "Deleted" for 7 days, then purge forever.
-- Run in Supabase SQL Editor after admin_account_approvals.sql / users_signup_policies.sql

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.users.deleted_at IS
  'When set with account_status=deleted, account is hidden from normal use and purged after 7 days.';

-- Migrate legacy rejected → deleted (start the 7-day clock now)
UPDATE public.users
SET
  account_status = 'deleted',
  deleted_at = COALESCE(deleted_at, now())
WHERE account_status = 'rejected';

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_account_status_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_account_status_check
  CHECK (account_status IN ('pending', 'approved', 'deleted'));

COMMENT ON COLUMN public.users.account_status IS
  'pending = awaiting admin approval; approved = can use app; deleted = soft-deleted (purge after 7 days)';

-- ============================================================
-- Permanently remove an auth+public user (internal hard delete)
-- ============================================================
CREATE OR REPLACE FUNCTION public.hard_delete_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id text;
BEGIN
  SELECT school_id INTO v_school_id FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    -- Still try auth cleanup if profile already gone
    DELETE FROM auth.users WHERE id = p_user_id;
    RETURN;
  END IF;

  IF to_regclass('public.exams') IS NOT NULL THEN
    UPDATE public.exams SET created_by = NULL WHERE created_by = p_user_id;
  END IF;

  IF to_regclass('public.announcements') IS NOT NULL THEN
    UPDATE public.announcements SET created_by = NULL WHERE created_by = p_user_id;
  END IF;

  IF to_regclass('public.admin_announcements') IS NOT NULL THEN
    UPDATE public.admin_announcements SET created_by = NULL WHERE created_by = p_user_id;
  END IF;

  IF to_regclass('public.exam_retake_requests') IS NOT NULL THEN
    UPDATE public.exam_retake_requests SET reviewed_by = NULL WHERE reviewed_by = p_user_id;
  END IF;

  IF to_regclass('public.password_reset_requests') IS NOT NULL THEN
    UPDATE public.password_reset_requests SET resolved_by = NULL WHERE resolved_by = p_user_id;
    UPDATE public.password_reset_requests SET user_id = NULL WHERE user_id = p_user_id;
  END IF;

  IF v_school_id IS NOT NULL AND to_regclass('public.subjects') IS NOT NULL THEN
    UPDATE public.subjects SET teacher_school_id = NULL
    WHERE trim(teacher_school_id) = trim(v_school_id);
  END IF;

  DELETE FROM public.subject_students WHERE student_id = p_user_id;
  DELETE FROM public.exam_results WHERE student_id = p_user_id;

  IF to_regclass('public.student_answers') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.student_answers WHERE student_id = $1'
      USING p_user_id;
  END IF;

  IF to_regclass('public.exam_integrity_events') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.exam_integrity_events WHERE student_id = $1'
      USING p_user_id;
  END IF;

  IF to_regclass('public.exam_retake_requests') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.exam_retake_requests WHERE student_id = $1'
      USING p_user_id;
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.notifications WHERE user_id = $1'
      USING p_user_id;
  END IF;

  IF to_regclass('public.announcement_reactions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.announcement_reactions WHERE user_id = $1'
      USING p_user_id;
  END IF;

  IF to_regclass('public.announcement_comments') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.announcement_comments WHERE user_id = $1'
      USING p_user_id;
  END IF;

  IF to_regclass('public.push_devices') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.push_devices WHERE user_id = $1'
      USING p_user_id;
  END IF;

  DELETE FROM public.users WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- ============================================================
-- Purge soft-deleted accounts older than 7 days
-- ============================================================
CREATE OR REPLACE FUNCTION public.purge_expired_deleted_accounts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  purged integer := 0;
BEGIN
  FOR r IN
    SELECT id
    FROM public.users
    WHERE account_status = 'deleted'
      AND deleted_at IS NOT NULL
      AND deleted_at <= (now() - interval '7 days')
  LOOP
    PERFORM public.hard_delete_user_account(r.id);
    purged := purged + 1;
  END LOOP;

  RETURN purged;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_expired_deleted_accounts() TO authenticated;

-- ============================================================
-- Soft delete (admin or self): mark deleted for 7 days
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid DEFAULT auth.uid())
RETURNS void
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

  IF p_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can delete other users';
  END IF;

  SELECT * INTO profile FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF lower(trim(profile.role)) = 'admin' AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete another admin account';
  END IF;

  -- Sweep expired rows whenever someone deletes
  PERFORM public.purge_expired_deleted_accounts();

  UPDATE public.users
  SET
    account_status = 'deleted',
    deleted_at = now()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO authenticated;

-- ============================================================
-- Admin list: only show deleted within last 7 days; purge first
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_role text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS SETOF public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text := lower(trim(coalesce(p_status, '')));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  PERFORM public.purge_expired_deleted_accounts();

  IF v_status = 'rejected' THEN
    v_status := 'deleted';
  END IF;

  RETURN QUERY
    SELECT *
    FROM public.users u
    WHERE (p_role IS NULL OR trim(p_role) = '' OR u.role ILIKE trim(p_role))
      AND (
        CASE
          WHEN v_status = 'deleted' THEN
            (
              u.account_status IN ('deleted', 'rejected')
              AND (
                u.deleted_at IS NULL
                OR u.deleted_at > (now() - interval '7 days')
              )
            )
          WHEN v_status = '' THEN
            u.account_status IS DISTINCT FROM 'deleted'
            AND u.account_status IS DISTINCT FROM 'rejected'
          ELSE
            u.account_status = v_status
        END
      )
    ORDER BY
      CASE u.account_status
        WHEN 'pending' THEN 0
        WHEN 'deleted' THEN 1
        ELSE 2
      END,
      COALESCE(u.deleted_at, u.created_at) DESC NULLS LAST,
      u.last_name,
      u.first_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text) TO authenticated;

-- Admin review: approve only (reject removed — use soft delete)
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

  IF action = 'reject' THEN
    -- Backward compatible: treat reject as soft-delete
    PERFORM public.delete_user_account(p_user_id);
    SELECT * INTO profile FROM public.users WHERE id = p_user_id;
    RETURN profile;
  END IF;

  IF action <> 'approve' THEN
    RAISE EXCEPTION 'Action must be approve';
  END IF;

  SELECT * INTO profile FROM public.users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF lower(trim(profile.role)) = 'admin' THEN
    RAISE EXCEPTION 'Cannot change approval status of an admin account';
  END IF;

  IF profile.account_status = 'deleted' THEN
    RAISE EXCEPTION 'Cannot approve a deleted account';
  END IF;

  UPDATE public.users
  SET
    account_status = 'approved',
    deleted_at = NULL
  WHERE id = p_user_id
  RETURNING * INTO profile;

  RETURN profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_review_account(uuid, text) TO authenticated;

-- Signup upsert: no longer preserve rejected
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
      WHEN public.users.account_status = 'deleted' THEN 'deleted'
      ELSE public.default_account_status(EXCLUDED.role)
    END
  RETURNING * INTO profile;

  RETURN profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_signup_profile(
  text, text, text, text, text, text, text, text, text, integer, text
) TO authenticated;
