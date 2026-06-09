-- Run in Supabase Dashboard → SQL Editor
-- Fixes: "Could not find the function public.get_student_enrolled_subjects"
-- Also adds student read policies if missing.

-- Student read policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subject_students'
      AND policyname = 'students_select_own_enrollment'
  ) THEN
    CREATE POLICY students_select_own_enrollment
      ON public.subject_students FOR SELECT TO authenticated
      USING (auth.uid() = student_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subjects'
      AND policyname = 'students_select_enrolled_subjects'
  ) THEN
    CREATE POLICY students_select_enrolled_subjects
      ON public.subjects FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.subject_students ss
          WHERE ss.subject_id = subjects.id AND ss.student_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exams'
      AND policyname = 'students_select_enrolled_exams'
  ) THEN
    CREATE POLICY students_select_enrolled_exams
      ON public.exams FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.subject_students ss
          WHERE ss.subject_id = exams.subject_id AND ss.student_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exam_results'
      AND policyname = 'students_select_own_results'
  ) THEN
    CREATE POLICY students_select_own_results
      ON public.exam_results FOR SELECT TO authenticated
      USING (student_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users'
      AND policyname = 'students_select_subject_faculty'
  ) THEN
    CREATE POLICY students_select_subject_faculty
      ON public.users FOR SELECT TO authenticated
      USING (
        role ILIKE 'faculty'
        AND EXISTS (
          SELECT 1
          FROM public.subjects s
          JOIN public.subject_students ss ON ss.subject_id = s.id
          WHERE s.teacher_school_id = users.school_id
            AND ss.student_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_student_enrolled_subjects()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', row.id,
        'name', row.name,
        'invite_code', row.invite_code,
        'teacher_school_id', row.teacher_school_id,
        'faculty_first_name', row.faculty_first_name,
        'faculty_last_name', row.faculty_last_name,
        'faculty_avatar_url', row.faculty_avatar_url
      )
      ORDER BY row.name
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT DISTINCT ON (s.id)
      s.id,
      s.name,
      s.invite_code,
      s.teacher_school_id,
      u.first_name AS faculty_first_name,
      u.last_name AS faculty_last_name,
      u.avatar_url AS faculty_avatar_url
    FROM public.subject_students ss
    JOIN public.subjects s ON s.id = ss.subject_id
    LEFT JOIN LATERAL (
      SELECT first_name, last_name, avatar_url
      FROM public.users
      WHERE school_id = s.teacher_school_id
        AND role ILIKE 'faculty'
      LIMIT 1
    ) u ON true
    WHERE ss.student_id = auth.uid()
    ORDER BY s.id, ss.ctid
  ) row;
$$;

CREATE OR REPLACE FUNCTION public.get_student_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_student_id uuid := auth.uid();
  v_enrolled int := 0;
  v_completed int := 0;
  v_upcoming int := 0;
  v_now timestamptz := now();
BEGIN
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COUNT(DISTINCT ss.subject_id)
  INTO v_enrolled
  FROM public.subject_students ss
  JOIN public.subjects s ON s.id = ss.subject_id
  WHERE ss.student_id = v_student_id;

  SELECT COUNT(*)
  INTO v_completed
  FROM public.exam_results er
  WHERE er.student_id = v_student_id;

  SELECT COUNT(*)
  INTO v_upcoming
  FROM public.exams e
  JOIN public.subject_students ss
    ON ss.subject_id = e.subject_id AND ss.student_id = v_student_id
  WHERE
    (
      (e.start_datetime IS NULL OR e.start_datetime <= v_now)
      AND (e.end_datetime IS NULL OR e.end_datetime >= v_now)
    )
    OR (e.start_datetime IS NOT NULL AND e.start_datetime > v_now);

  RETURN jsonb_build_object(
    'enrolled_subjects', v_enrolled,
    'completed_assessments', v_completed,
    'upcoming_assessments', v_upcoming
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_enrolled_subjects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_enrolled_subjects() TO authenticated;

REVOKE ALL ON FUNCTION public.get_student_dashboard_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_dashboard_stats() TO authenticated;

NOTIFY pgrst, 'reload schema';
