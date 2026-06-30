-- Admin platform bug fixes — run after admin_platform.sql and admin_account_approvals.sql

-- ============================================================
-- Assign / unassign faculty on subjects
-- ============================================================
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
  v_school_id text := NULLIF(trim(coalesce(p_faculty_school_id, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF v_school_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE school_id = v_school_id
      AND role ILIKE 'faculty'
      AND (
        NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'account_status'
        )
        OR account_status = 'approved'
      )
  ) THEN
    RAISE EXCEPTION 'Approved faculty not found for that school ID';
  END IF;

  UPDATE public.subjects
  SET teacher_school_id = v_school_id
  WHERE id = p_subject_id
  RETURNING * INTO subject_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subject not found';
  END IF;

  RETURN subject_row;
END;
$$;

-- ============================================================
-- Faculty list (approved only when account_status exists)
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
      AND (
        NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'account_status'
        )
        OR account_status = 'approved'
      )
    ORDER BY last_name, first_name;
END;
$$;

-- ============================================================
-- Subjects with faculty (proper admin guard)
-- ============================================================
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

-- ============================================================
-- Assessments list (proper admin guard)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_list_assessments()
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
      SELECT jsonb_agg(row_data ORDER BY sort_start DESC NULLS LAST)
      FROM (
        SELECT
          jsonb_build_object(
            'id', e.id,
            'title', e.title,
            'exam_type', e.exam_type,
            'assessment_category', e.assessment_category,
            'subject_id', e.subject_id,
            'subject_name', s.name,
            'teacher_school_id', s.teacher_school_id,
            'start_datetime', e.start_datetime,
            'end_datetime', e.end_datetime,
            'result_count', (
              SELECT count(*) FROM public.exam_results er WHERE er.exam_id = e.id
            )
          ) AS row_data,
          e.start_datetime AS sort_start
        FROM public.exams e
        JOIN public.subjects s ON s.id = e.subject_id
      ) q
    ),
    '[]'::jsonb
  );
END;
$$;

-- ============================================================
-- Export assessments (proper admin guard)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_export_assessments()
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
      SELECT jsonb_agg(row_data ORDER BY sort_start DESC NULLS LAST)
      FROM (
        SELECT
          jsonb_build_object(
            'assessment_id', e.id,
            'title', e.title,
            'type', e.exam_type,
            'category', e.assessment_category,
            'subject', s.name,
            'faculty_school_id', s.teacher_school_id,
            'start', e.start_datetime,
            'end', e.end_datetime,
            'target_sections', e.target_sections,
            'submissions', (
              SELECT count(*) FROM public.exam_results er WHERE er.exam_id = e.id
            )
          ) AS row_data,
          e.start_datetime AS sort_start
        FROM public.exams e
        JOIN public.subjects s ON s.id = e.subject_id
      ) q
    ),
    '[]'::jsonb
  );
END;
$$;

-- ============================================================
-- Catalog (admin-only RPC)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_catalog()
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
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'item_type', c.item_type,
          'code', c.code,
          'label', c.label,
          'parent_code', c.parent_code,
          'sort_order', c.sort_order,
          'is_active', c.is_active
        )
        ORDER BY c.item_type, c.sort_order, c.label
      )
      FROM public.school_catalog c
    ),
    '[]'::jsonb
  );
END;
$$;

-- ============================================================
-- Broadcast list (proper admin guard)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_list_broadcasts()
RETURNS SETOF public.admin_announcements
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
    FROM public.admin_announcements
    ORDER BY created_at DESC;
END;
$$;

-- ============================================================
-- Dashboard stats — integrity count + optional pending requests
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_has_account_status boolean;
  v_has_integrity boolean;
  v_pending bigint := 0;
  v_integrity bigint := 0;
  v_password_resets bigint := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'account_status'
  ) INTO v_has_account_status;

  IF v_has_account_status THEN
    SELECT count(*) INTO v_pending
    FROM public.users
    WHERE account_status = 'pending'
      AND role ILIKE ANY (ARRAY['student', 'faculty']);
  END IF;

  v_has_integrity := to_regclass('public.exam_integrity_events') IS NOT NULL;
  IF v_has_integrity THEN
    SELECT count(*) INTO v_integrity FROM public.exam_integrity_events;
  END IF;

  IF to_regclass('public.password_reset_requests') IS NOT NULL THEN
    SELECT count(*) INTO v_password_resets
    FROM public.password_reset_requests
    WHERE status = 'pending';
  END IF;

  RETURN jsonb_build_object(
    'users', (SELECT count(*) FROM public.users),
    'students', (SELECT count(*) FROM public.users WHERE role ILIKE 'student'),
    'faculty', (SELECT count(*) FROM public.users WHERE role ILIKE 'faculty'),
    'pending_requests', v_pending,
    'pending_password_resets', v_password_resets,
    'subjects', (SELECT count(*) FROM public.subjects),
    'assessments', (SELECT count(*) FROM public.exams),
    'results', (SELECT count(*) FROM public.exam_results),
    'integrity_events', v_integrity
  );
END;
$$;

-- ============================================================
-- User list with optional status filter (safe if run twice)
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
        OR (
          EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'users'
              AND column_name = 'account_status'
          )
          AND u.account_status = lower(trim(p_status))
        )
        OR (
          NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'users'
              AND column_name = 'account_status'
          )
          AND lower(trim(p_status)) = 'approved'
        )
      )
    ORDER BY
      CASE
        WHEN EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'account_status'
        ) THEN
          CASE u.account_status
            WHEN 'pending' THEN 0
            WHEN 'rejected' THEN 1
            ELSE 2
          END
        ELSE 2
      END,
      u.created_at DESC NULLS LAST,
      u.last_name,
      u.first_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text) TO authenticated;

-- Promote to Admin always keeps account approved
CREATE OR REPLACE FUNCTION public.admin_update_user(
  p_user_id uuid,
  p_role text DEFAULT NULL,
  p_department text DEFAULT NULL,
  p_course text DEFAULT NULL,
  p_year_level text DEFAULT NULL,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile public.users%ROWTYPE;
  v_role text;
  v_has_account_status boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'account_status'
  ) INTO v_has_account_status;

  UPDATE public.users
  SET
    role = COALESCE(NULLIF(trim(p_role), ''), role),
    department = COALESCE(NULLIF(trim(p_department), ''), department),
    course = COALESCE(NULLIF(trim(p_course), ''), course),
    year_level = COALESCE(NULLIF(trim(p_year_level), ''), year_level),
    first_name = COALESCE(NULLIF(trim(p_first_name), ''), first_name),
    last_name = COALESCE(NULLIF(trim(p_last_name), ''), last_name),
    account_status = CASE
      WHEN NOT v_has_account_status THEN account_status
      WHEN lower(trim(COALESCE(NULLIF(trim(p_role), ''), role))) = 'admin' THEN 'approved'
      ELSE account_status
    END
  WHERE id = p_user_id
  RETURNING * INTO profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN profile;
END;
$$;

-- ============================================================
-- PASSWORD RESET REQUESTS (forgot password → admin reset)
-- Safe to re-run; also in database/password_reset_requests.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  school_id text NOT NULL,
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS password_reset_requests_status_idx
  ON public.password_reset_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS password_reset_requests_user_pending_idx
  ON public.password_reset_requests (user_id)
  WHERE status = 'pending';

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS password_reset_requests_deny_all ON public.password_reset_requests;
CREATE POLICY password_reset_requests_deny_all ON public.password_reset_requests
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS password_reset_requests_admin_select ON public.password_reset_requests;
CREATE POLICY password_reset_requests_admin_select ON public.password_reset_requests
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.submit_password_reset_request(
  p_email text,
  p_school_id text,
  p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_school_id text := trim(coalesce(p_school_id, ''));
  v_user public.users%ROWTYPE;
  v_request public.password_reset_requests%ROWTYPE;
BEGIN
  IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'A valid email address is required';
  END IF;

  IF v_school_id = '' THEN
    RAISE EXCEPTION 'School ID is required';
  END IF;

  SELECT *
  INTO v_user
  FROM public.users
  WHERE lower(trim(email)) = v_email
    AND trim(school_id) = v_school_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'If an account matches that email and school ID, an administrator will review your request.'
    );
  END IF;

  IF lower(trim(coalesce(v_user.role, ''))) = 'admin' THEN
    RAISE EXCEPTION 'Admin accounts must reset passwords through another administrator.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.password_reset_requests
    WHERE user_id = v_user.id
      AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'You already have a pending password reset request. An administrator will contact you soon.'
    );
  END IF;

  INSERT INTO public.password_reset_requests (
    user_id, email, school_id, message, status
  )
  VALUES (
    v_user.id, v_user.email, v_user.school_id,
    coalesce(trim(p_message), ''), 'pending'
  )
  RETURNING * INTO v_request;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Your password reset request was sent to an administrator. You will be notified once your password has been reset.',
    'request_id', v_request.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_password_reset_request(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_password_reset_request(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_password_reset_requests(
  p_status text DEFAULT NULL
)
RETURNS SETOF public.password_reset_requests
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
    SELECT r.*
    FROM public.password_reset_requests r
    WHERE p_status IS NULL
      OR trim(p_status) = ''
      OR r.status = lower(trim(p_status))
    ORDER BY
      CASE r.status WHEN 'pending' THEN 0 ELSE 1 END,
      r.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_password_reset_requests(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reject_password_reset_request(
  p_request_id uuid,
  p_admin_notes text DEFAULT NULL
)
RETURNS public.password_reset_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.password_reset_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.password_reset_requests
  SET
    status = 'rejected',
    admin_notes = NULLIF(trim(coalesce(p_admin_notes, '')), ''),
    resolved_at = now(),
    resolved_by = auth.uid()
  WHERE id = p_request_id
    AND status = 'pending'
  RETURNING * INTO row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending request not found';
  END IF;

  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reject_password_reset_request(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_complete_password_reset_request(
  p_request_id uuid,
  p_admin_notes text DEFAULT NULL
)
RETURNS public.password_reset_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.password_reset_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.password_reset_requests
  SET
    status = 'completed',
    admin_notes = NULLIF(trim(coalesce(p_admin_notes, '')), ''),
    resolved_at = now(),
    resolved_by = auth.uid()
  WHERE id = p_request_id
    AND status IN ('pending', 'approved')
  RETURNING * INTO row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already resolved';
  END IF;

  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_complete_password_reset_request(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
