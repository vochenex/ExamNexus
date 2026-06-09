-- Run once in Supabase Dashboard → SQL Editor
-- Enables student enrollment by invite code (bypasses RLS safely)

-- Remove any existing duplicate rows first, then enforce uniqueness
DELETE FROM public.subject_students ss
WHERE ss.ctid NOT IN (
  SELECT MIN(s.ctid)
  FROM public.subject_students s
  GROUP BY s.student_id, s.subject_id
);

CREATE UNIQUE INDEX IF NOT EXISTS subject_students_student_subject_uidx
  ON public.subject_students (student_id, subject_id);

CREATE OR REPLACE FUNCTION public.enroll_student_by_invite_code(p_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid := auth.uid();
  v_subject public.subjects%ROWTYPE;
BEGIN
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_subject
  FROM public.subjects
  WHERE invite_code = lower(trim(p_invite_code));

  IF v_subject.id IS NULL THEN
    RAISE EXCEPTION 'Invalid invitation code';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.subject_students
    WHERE student_id = v_student_id
      AND subject_id = v_subject.id
  ) THEN
    RAISE EXCEPTION 'Already enrolled in %', v_subject.name;
  END IF;

  BEGIN
    INSERT INTO public.subject_students (student_id, subject_id)
    VALUES (v_student_id, v_subject.id);
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Already enrolled in %', v_subject.name;
  END;

  RETURN jsonb_build_object(
    'id', v_subject.id,
    'name', v_subject.name,
    'invite_code', v_subject.invite_code,
    'teacher_school_id', v_subject.teacher_school_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_student_by_invite_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enroll_student_by_invite_code(text) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subject_students'
      AND policyname = 'students_select_own_enrollment'
  ) THEN
    CREATE POLICY students_select_own_enrollment
      ON public.subject_students
      FOR SELECT
      TO authenticated
      USING (auth.uid() = student_id);
  END IF;
END $$;

-- Students can read subjects they are enrolled in
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subjects'
      AND policyname = 'students_select_enrolled_subjects'
  ) THEN
    CREATE POLICY students_select_enrolled_subjects
      ON public.subjects
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.subject_students ss
          WHERE ss.subject_id = subjects.id
            AND ss.student_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Students can read exams for enrolled subjects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exams'
      AND policyname = 'students_select_enrolled_exams'
  ) THEN
    CREATE POLICY students_select_enrolled_exams
      ON public.exams
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.subject_students ss
          WHERE ss.subject_id = exams.subject_id
            AND ss.student_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Students can read their own exam results
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exam_results'
      AND policyname = 'students_select_own_results'
  ) THEN
    CREATE POLICY students_select_own_results
      ON public.exam_results
      FOR SELECT
      TO authenticated
      USING (student_id = auth.uid());
  END IF;
END $$;

-- Students can read faculty assigned to their enrolled subjects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'students_select_subject_faculty'
  ) THEN
    CREATE POLICY students_select_subject_faculty
      ON public.users
      FOR SELECT
      TO authenticated
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

-- RPC: enrolled subjects (works even when join RLS is misconfigured)
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

REVOKE ALL ON FUNCTION public.get_student_enrolled_subjects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_enrolled_subjects() TO authenticated;

-- RPC: dashboard stats for profile cards
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
    ON ss.subject_id = e.subject_id
   AND ss.student_id = v_student_id
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

REVOKE ALL ON FUNCTION public.get_student_dashboard_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_dashboard_stats() TO authenticated;

NOTIFY pgrst, 'reload schema';
