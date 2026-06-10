-- Admin platform: policies, catalog, broadcast announcements, RPCs
-- Run in Supabase SQL Editor after users_signup_policies.sql

-- ============================================================
-- SCHOOL CATALOG (departments, courses, section presets)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.school_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL CHECK (item_type IN ('department', 'course', 'section')),
  code text NOT NULL,
  label text NOT NULL,
  parent_code text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS school_catalog_unique_item_idx
  ON public.school_catalog (item_type, code, COALESCE(parent_code, ''));

ALTER TABLE public.school_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_catalog_select_all ON public.school_catalog;
CREATE POLICY school_catalog_select_all ON public.school_catalog
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS school_catalog_admin_write ON public.school_catalog;
CREATE POLICY school_catalog_admin_write ON public.school_catalog
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Seed defaults (matches src/utils/academicOptions.js)
INSERT INTO public.school_catalog (item_type, code, label, sort_order)
VALUES
  ('department', 'CCS', 'College of Computer Studies', 1),
  ('department', 'CCJE', 'College of Criminal Justice Education', 2),
  ('department', 'CBE', 'College of Business Education', 3)
ON CONFLICT DO NOTHING;

INSERT INTO public.school_catalog (item_type, code, label, parent_code, sort_order)
VALUES
  ('course', 'BSIT', 'Bachelor of Science in Information Technology (BSIT)', 'CCS', 1),
  ('course', 'BSA', 'Bachelor of Science in Accountancy (BSA)', 'CBE', 1),
  ('course', 'TM', 'Tourism Management (TM)', 'CBE', 2),
  ('course', 'FM', 'Financial Management (FM)', 'CBE', 3),
  ('course', 'HM', 'Hospitality Management (HM)', 'CBE', 4),
  ('course', 'BSCRIM', 'Bachelor of Science in Criminology (BSCRIM)', 'CCJE', 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.school_catalog (item_type, code, label, sort_order)
VALUES
  ('section', 'A', 'Section A', 1),
  ('section', 'B', 'Section B', 2),
  ('section', 'C', 'Section C', 3)
ON CONFLICT DO NOTHING;

-- ============================================================
-- ADMIN BROADCAST ANNOUNCEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  audience text NOT NULL DEFAULT 'all'
    CHECK (audience IN ('faculty', 'students', 'all')),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_announcements_created_idx
  ON public.admin_announcements (created_at DESC);

ALTER TABLE public.admin_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_announcements_select ON public.admin_announcements;
CREATE POLICY admin_announcements_select ON public.admin_announcements
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      audience IN ('all', 'students')
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role ILIKE 'student'
      )
    )
    OR (
      audience IN ('all', 'faculty')
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role ILIKE 'faculty'
      )
    )
  );

DROP POLICY IF EXISTS admin_announcements_write ON public.admin_announcements;
CREATE POLICY admin_announcements_write ON public.admin_announcements
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- ADMIN RLS EXTENSIONS
-- ============================================================
DROP POLICY IF EXISTS users_update_admin ON public.users;
CREATE POLICY users_update_admin ON public.users
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS subjects_admin_all ON public.subjects;
CREATE POLICY subjects_admin_all ON public.subjects
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS exams_admin_select ON public.exams;
CREATE POLICY exams_admin_select ON public.exams
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS exams_admin_write ON public.exams;
CREATE POLICY exams_admin_write ON public.exams
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS exam_results_admin_select ON public.exam_results;
CREATE POLICY exam_results_admin_select ON public.exam_results
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS exam_integrity_admin_select ON public.exam_integrity_events;
CREATE POLICY exam_integrity_admin_select ON public.exam_integrity_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS announcements_admin_all ON public.announcements;
CREATE POLICY announcements_admin_all ON public.announcements
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- RPC: admin dashboard stats
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
    'subjects', (SELECT count(*) FROM public.subjects),
    'assessments', (SELECT count(*) FROM public.exams),
    'results', (SELECT count(*) FROM public.exam_results),
    'integrity_events', (
      SELECT count(*) FROM public.exam_integrity_events
      WHERE to_regclass('public.exam_integrity_events') IS NOT NULL
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_stats() TO authenticated;

-- ============================================================
-- RPC: list / update users
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_list_users(p_role text DEFAULT NULL)
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

  IF p_role IS NULL OR trim(p_role) = '' THEN
    RETURN QUERY
      SELECT * FROM public.users
      ORDER BY role, last_name, first_name;
  ELSE
    RETURN QUERY
      SELECT * FROM public.users
      WHERE role ILIKE trim(p_role)
      ORDER BY last_name, first_name;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users(text) TO authenticated;

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
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.users
  SET
    role = COALESCE(NULLIF(trim(p_role), ''), role),
    department = COALESCE(NULLIF(trim(p_department), ''), department),
    course = COALESCE(NULLIF(trim(p_course), ''), course),
    year_level = COALESCE(NULLIF(trim(p_year_level), ''), year_level),
    first_name = COALESCE(NULLIF(trim(p_first_name), ''), first_name),
    last_name = COALESCE(NULLIF(trim(p_last_name), ''), last_name)
  WHERE id = p_user_id
  RETURNING * INTO profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user(uuid, text, text, text, text, text, text) TO authenticated;

-- ============================================================
-- RPC: subjects + faculty assignment
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_list_subjects_with_faculty()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
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
      )
      ORDER BY s.name
    ),
    '[]'::jsonb
  )
  FROM public.subjects s
  LEFT JOIN LATERAL (
    SELECT first_name, last_name, email
    FROM public.users u
    WHERE u.school_id = s.teacher_school_id
      AND u.role ILIKE 'faculty'
    LIMIT 1
  ) f ON true
  WHERE public.is_admin();
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_subjects_with_faculty() TO authenticated;

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
    WHERE school_id = p_faculty_school_id AND role ILIKE 'faculty'
  ) THEN
    RAISE EXCEPTION 'Faculty not found for school ID';
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

GRANT EXECUTE ON FUNCTION public.admin_assign_subject_faculty(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_faculty()
RETURNS SETOF public.users
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT *
  FROM public.users
  WHERE role ILIKE 'faculty'
    AND public.is_admin()
  ORDER BY last_name, first_name;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_faculty() TO authenticated;

-- ============================================================
-- RPC: school catalog CRUD
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_catalog()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
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
    ),
    '[]'::jsonb
  )
  FROM public.school_catalog c
  WHERE public.is_admin() OR true;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_catalog() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_catalog_item(
  p_id uuid DEFAULT NULL,
  p_item_type text DEFAULT 'department',
  p_code text DEFAULT '',
  p_label text DEFAULT '',
  p_parent_code text DEFAULT NULL,
  p_sort_order integer DEFAULT 0,
  p_is_active boolean DEFAULT true
)
RETURNS public.school_catalog
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.school_catalog%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_id IS NOT NULL THEN
    UPDATE public.school_catalog
    SET
      item_type = COALESCE(NULLIF(trim(p_item_type), ''), item_type),
      code = COALESCE(NULLIF(trim(p_code), ''), code),
      label = COALESCE(NULLIF(trim(p_label), ''), label),
      parent_code = NULLIF(trim(p_parent_code), ''),
      sort_order = COALESCE(p_sort_order, sort_order),
      is_active = COALESCE(p_is_active, is_active),
      updated_at = now()
    WHERE id = p_id
    RETURNING * INTO row;
  ELSE
    INSERT INTO public.school_catalog (
      item_type, code, label, parent_code, sort_order, is_active
    )
    VALUES (
      trim(p_item_type),
      upper(trim(p_code)),
      trim(p_label),
      NULLIF(trim(p_parent_code), ''),
      COALESCE(p_sort_order, 0),
      COALESCE(p_is_active, true)
    )
    RETURNING * INTO row;
  END IF;

  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_catalog_item(uuid, text, text, text, text, integer, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_catalog_item(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  DELETE FROM public.school_catalog WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_catalog_item(uuid) TO authenticated;

-- ============================================================
-- RPC: admin broadcast announcements
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_create_broadcast(
  p_title text,
  p_body text,
  p_audience text DEFAULT 'all'
)
RETURNS public.admin_announcements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.admin_announcements%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  INSERT INTO public.admin_announcements (title, body, audience, created_by)
  VALUES (
    trim(p_title),
    coalesce(trim(p_body), ''),
    coalesce(nullif(trim(p_audience), ''), 'all'),
    auth.uid()
  )
  RETURNING * INTO row;

  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_broadcast(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_broadcasts()
RETURNS SETOF public.admin_announcements
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT *
  FROM public.admin_announcements
  WHERE public.is_admin()
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_broadcasts() TO authenticated;

-- ============================================================
-- RPC: assessments, exam logs, exports
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_list_assessments()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
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
      )
      ORDER BY e.start_datetime DESC NULLS LAST
    ),
    '[]'::jsonb
  )
  FROM public.exams e
  JOIN public.subjects s ON s.id = e.subject_id
  WHERE public.is_admin();
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_assessments() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_exam_logs(p_limit integer DEFAULT 200)
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

  IF to_regclass('public.exam_integrity_events') IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_data ORDER BY created_at DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', ev.id,
          'exam_id', ev.exam_id,
          'exam_title', ex.title,
          'subject_name', sub.name,
          'student_id', ev.student_id,
          'student_name', trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')),
          'event_type', ev.event_type,
          'description', ev.description,
          'metadata', ev.metadata,
          'created_at', ev.created_at
        ) AS row_data,
        ev.created_at
        FROM public.exam_integrity_events ev
        JOIN public.exams ex ON ex.id = ev.exam_id
        JOIN public.subjects sub ON sub.id = ex.subject_id
        LEFT JOIN public.users u ON u.id = ev.student_id
        ORDER BY ev.created_at DESC
        LIMIT greatest(1, least(coalesce(p_limit, 200), 1000))
      ) q
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_exam_logs(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_export_assessments()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
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
        'submissions', (SELECT count(*) FROM public.exam_results er WHERE er.exam_id = e.id)
      )
      ORDER BY e.start_datetime DESC NULLS LAST
    ),
    '[]'::jsonb
  )
  FROM public.exams e
  JOIN public.subjects s ON s.id = e.subject_id
  WHERE public.is_admin();
$$;

GRANT EXECUTE ON FUNCTION public.admin_export_assessments() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_export_results(p_exam_id uuid DEFAULT NULL)
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
      SELECT jsonb_agg(row_data ORDER BY exam_title, student_name)
      FROM (
        SELECT jsonb_build_object(
          'exam_id', e.id,
          'exam_title', e.title,
          'subject', s.name,
          'student_id', er.student_id,
          'student_name', trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')),
          'student_email', u.email,
          'school_id', u.school_id,
          'score', er.score,
          'total', er.total,
          'percentage', CASE
            WHEN er.total > 0 THEN round((er.score::numeric / er.total::numeric) * 100, 2)
            ELSE NULL
          END,
          'submitted_at', er.created_at
        ) AS row_data,
        e.title AS exam_title,
        trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')) AS student_name
        FROM public.exam_results er
        JOIN public.exams e ON e.id = er.exam_id
        JOIN public.subjects s ON s.id = e.subject_id
        JOIN public.users u ON u.id = er.student_id
        WHERE p_exam_id IS NULL OR er.exam_id = p_exam_id
        ORDER BY e.title, u.last_name, u.first_name
      ) q
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_export_results(uuid) TO authenticated;
