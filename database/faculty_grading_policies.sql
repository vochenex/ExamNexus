-- Faculty manual grading: points per answer + update policies
-- Run in Supabase SQL Editor

ALTER TABLE public.student_answers
  ADD COLUMN IF NOT EXISTS points_awarded numeric;

COMMENT ON COLUMN public.student_answers.points_awarded IS
  'Points earned for this answer. Used for essay manual grading and partial credit.';

DO $$
BEGIN
  IF to_regclass('public.student_answers') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'student_answers'
      AND policyname = 'faculty_update_exam_answers'
  ) THEN
    CREATE POLICY faculty_update_exam_answers
      ON public.student_answers
      FOR UPDATE
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
      )
      WITH CHECK (
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exam_results'
      AND policyname = 'faculty_update_exam_results'
  ) THEN
    CREATE POLICY faculty_update_exam_results
      ON public.exam_results
      FOR UPDATE
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
      )
      WITH CHECK (
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

NOTIFY pgrst, 'reload schema';
