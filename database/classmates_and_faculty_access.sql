-- Run in Supabase Dashboard → SQL Editor
-- Fixes: students/faculty only see themselves in class lists
--
-- After running, verify enrollments (replace subject UUID):
--   SELECT ss.student_id, ss.section, u.first_name, u.last_name, u.email
--   FROM public.subject_students ss
--   LEFT JOIN public.users u ON u.id = ss.student_id
--   WHERE ss.subject_id = 'YOUR-SUBJECT-UUID';

-- ============================================================
-- SECURITY DEFINER helpers (no RLS recursion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_enrolled_in_subject(p_subject_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subject_students
    WHERE subject_id = p_subject_id
      AND student_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_teaches_subject(p_subject_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subjects s
    JOIN public.users u ON u.id = auth.uid()
    WHERE s.id = p_subject_id
      AND u.school_id = s.teacher_school_id
      AND u.role ILIKE 'faculty'
  );
$$;

CREATE OR REPLACE FUNCTION public.users_share_subject(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subject_students mine
    JOIN public.subject_students peer
      ON peer.subject_id = mine.subject_id
     AND upper(trim(coalesce(peer.section, 'A')))
       = upper(trim(coalesce(mine.section, 'A')))
    WHERE mine.student_id = auth.uid()
      AND peer.student_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.faculty_teaches_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subject_students ss
    JOIN public.subjects s ON s.id = ss.subject_id
    JOIN public.users faculty ON faculty.id = auth.uid()
    WHERE ss.student_id = p_student_id
      AND faculty.school_id = s.teacher_school_id
      AND faculty.role ILIKE 'faculty'
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_enrolled_in_subject(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_teaches_subject(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.users_share_subject(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.faculty_teaches_student(uuid) TO authenticated;

-- ============================================================
-- RLS: subject_students — drop ALL old SELECT policies, then one shared policy
-- ============================================================
ALTER TABLE public.subject_students ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_section_in_subject(p_subject_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_section text;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  SELECT upper(trim(coalesce(section, 'A')))
  INTO v_section
  FROM public.subject_students
  WHERE student_id = auth.uid()
    AND subject_id = p_subject_id
  LIMIT 1;

  RETURN v_section;
END;
$$;

CREATE OR REPLACE FUNCTION public.student_can_view_peer_enrollment(
  p_subject_id uuid,
  p_peer_section text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    public.user_enrolled_in_subject(p_subject_id)
    AND upper(trim(coalesce(p_peer_section, 'A')))
      = coalesce(public.user_section_in_subject(p_subject_id), 'A');
$$;

GRANT EXECUTE ON FUNCTION public.user_section_in_subject(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_can_view_peer_enrollment(uuid, text) TO authenticated;

DROP POLICY IF EXISTS students_select_own_enrollment ON public.subject_students;
DROP POLICY IF EXISTS students_select_shared_subject_enrollments ON public.subject_students;
DROP POLICY IF EXISTS faculty_select_subject_enrollments ON public.subject_students;
DROP POLICY IF EXISTS subject_students_select_shared ON public.subject_students;
DROP POLICY IF EXISTS subject_students_select ON public.subject_students;

CREATE POLICY subject_students_select_shared ON public.subject_students
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.user_teaches_subject(subject_id)
    OR public.student_can_view_peer_enrollment(subject_id, section)
  );

DROP POLICY IF EXISTS students_delete_own_enrollment ON public.subject_students;

CREATE POLICY students_delete_own_enrollment ON public.subject_students
  FOR DELETE TO authenticated
  USING (student_id = auth.uid());

-- ============================================================
-- RLS: users — classmates + faculty can read peer profiles
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS students_select_subject_classmates ON public.users;
DROP POLICY IF EXISTS faculty_select_their_students ON public.users;

CREATE POLICY students_select_subject_classmates ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.users_share_subject(id)
    OR public.faculty_teaches_student(id)
  );

-- ============================================================
-- RPC: classmates for a subject (section-scoped for students)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_subject_classmates(p_subject_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_faculty boolean := false;
  v_my_section text;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_enrolled_in_subject(p_subject_id)
     AND NOT public.user_teaches_subject(p_subject_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_is_faculty := public.user_teaches_subject(p_subject_id);

  IF NOT v_is_faculty THEN
    SELECT upper(trim(coalesce(section, 'A')))
    INTO v_my_section
    FROM public.subject_students
    WHERE student_id = v_user_id
      AND subject_id = p_subject_id;

    v_my_section := coalesce(v_my_section, 'A');
  END IF;

  PERFORM set_config('row_security', 'off', true);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', ss.student_id,
        'first_name', COALESCE(u.first_name, 'Student'),
        'last_name', COALESCE(u.last_name, ''),
        'avatar_url', u.avatar_url,
        'school_id', u.school_id,
        'section', COALESCE(NULLIF(trim(ss.section), ''), 'A'),
        'is_you', ss.student_id = v_user_id
      )
      ORDER BY u.last_name, u.first_name
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM public.subject_students ss
  LEFT JOIN public.users u ON u.id = ss.student_id
  WHERE ss.subject_id = p_subject_id
    AND (
      v_is_faculty
      OR upper(trim(coalesce(ss.section, 'A'))) = v_my_section
    );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.unenroll_student_from_subject(p_subject_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid := auth.uid();
  v_subject_name text;
  v_deleted integer := 0;
BEGIN
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT s.name
  INTO v_subject_name
  FROM public.subjects s
  WHERE s.id = p_subject_id;

  IF v_subject_name IS NULL THEN
    RAISE EXCEPTION 'Subject not found';
  END IF;

  DELETE FROM public.subject_students
  WHERE student_id = v_student_id
    AND subject_id = p_subject_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RAISE EXCEPTION 'You are not enrolled in this subject';
  END IF;

  RETURN jsonb_build_object(
    'subject_id', p_subject_id,
    'subject_name', v_subject_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.unenroll_student_from_subject(uuid) TO authenticated;

ALTER FUNCTION public.get_subject_classmates(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_subject_classmates(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_subject_classmates(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
