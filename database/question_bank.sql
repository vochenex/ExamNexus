-- Question bank: reusable questions saved by faculty
-- Run once in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS public.question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  question_type text NOT NULL DEFAULT 'multiple_choice',
  question text NOT NULL DEFAULT '',
  option_a text DEFAULT '',
  option_b text DEFAULT '',
  option_c text DEFAULT '',
  option_d text DEFAULT '',
  correct_answer text DEFAULT '',
  correct_answers jsonb,
  grading_options jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS question_bank_teacher_id_idx
  ON public.question_bank (teacher_id);

CREATE INDEX IF NOT EXISTS question_bank_school_id_idx
  ON public.question_bank (school_id);

COMMENT ON TABLE public.question_bank IS
  'Faculty-owned reusable assessment questions independent of any exam.';

ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'question_bank'
      AND policyname = 'question_bank_select_own'
  ) THEN
    CREATE POLICY question_bank_select_own ON public.question_bank
      FOR SELECT TO authenticated
      USING (
        teacher_id = auth.uid()
        AND school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'question_bank'
      AND policyname = 'question_bank_insert_own'
  ) THEN
    CREATE POLICY question_bank_insert_own ON public.question_bank
      FOR INSERT TO authenticated
      WITH CHECK (
        teacher_id = auth.uid()
        AND school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'question_bank'
      AND policyname = 'question_bank_update_own'
  ) THEN
    CREATE POLICY question_bank_update_own ON public.question_bank
      FOR UPDATE TO authenticated
      USING (
        teacher_id = auth.uid()
        AND school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
      )
      WITH CHECK (
        teacher_id = auth.uid()
        AND school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'question_bank'
      AND policyname = 'question_bank_delete_own'
  ) THEN
    CREATE POLICY question_bank_delete_own ON public.question_bank
      FOR DELETE TO authenticated
      USING (
        teacher_id = auth.uid()
        AND school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
      );
  END IF;
END $$;
