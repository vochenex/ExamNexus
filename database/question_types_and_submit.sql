-- Question types support: enumeration answers array, student submission policies
-- Run in Supabase SQL Editor after existing exam migrations.

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS correct_answers jsonb;

COMMENT ON COLUMN public.questions.correct_answers IS
  'Array of expected answers for enumeration questions. Also stored as JSON in correct_answer for backward compatibility.';

-- Students may submit their own exam results
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exam_results'
      AND policyname = 'students_insert_own_results'
  ) THEN
    CREATE POLICY students_insert_own_results
      ON public.exam_results
      FOR INSERT
      TO authenticated
      WITH CHECK (student_id = auth.uid());
  END IF;
END $$;

-- Students may insert their own answer logs
DO $$
BEGIN
  IF to_regclass('public.student_answers') IS NULL THEN
    CREATE TABLE public.student_answers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
      question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
      student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      answer text,
      is_correct boolean,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS student_answers_exam_student_idx
      ON public.student_answers (exam_id, student_id);
  END IF;
END $$;

ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'student_answers'
      AND policyname = 'students_insert_own_answers'
  ) THEN
    CREATE POLICY students_insert_own_answers
      ON public.student_answers
      FOR INSERT
      TO authenticated
      WITH CHECK (student_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'student_answers'
      AND policyname = 'students_select_own_answers'
  ) THEN
    CREATE POLICY students_select_own_answers
      ON public.student_answers
      FOR SELECT
      TO authenticated
      USING (student_id = auth.uid());
  END IF;
END $$;

-- Allow is_correct to be NULL for essay / manual-review answers
ALTER TABLE public.student_answers
  ALTER COLUMN is_correct DROP NOT NULL;
