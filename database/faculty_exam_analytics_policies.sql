-- Faculty can read exam results and student answers for assessments they manage
-- Run in Supabase SQL Editor after exam_results / student_answers exist.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exam_results'
      AND policyname = 'faculty_select_exam_results'
  ) THEN
    CREATE POLICY faculty_select_exam_results
      ON public.exam_results
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.exams e
          JOIN public.subjects s ON s.id = e.subject_id
          JOIN public.users u ON u.id = auth.uid()
          WHERE e.id = exam_results.exam_id
            AND u.role ILIKE 'faculty'
            AND u.school_id = s.teacher_school_id
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.student_answers') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'student_answers'
      AND policyname = 'faculty_select_exam_answers'
  ) THEN
    CREATE POLICY faculty_select_exam_answers
      ON public.student_answers
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.exams e
          JOIN public.subjects s ON s.id = e.subject_id
          JOIN public.users u ON u.id = auth.uid()
          WHERE e.id = student_answers.exam_id
            AND u.role ILIKE 'faculty'
            AND u.school_id = s.teacher_school_id
        )
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
