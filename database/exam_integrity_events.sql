-- Exam integrity / proctoring events (run in Supabase SQL Editor)

CREATE TABLE IF NOT EXISTS public.exam_integrity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  description text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exam_integrity_events_exam_idx
  ON public.exam_integrity_events (exam_id, created_at DESC);

CREATE INDEX IF NOT EXISTS exam_integrity_events_student_idx
  ON public.exam_integrity_events (exam_id, student_id, created_at DESC);

ALTER TABLE public.exam_integrity_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exam_integrity_events'
      AND policyname = 'students_insert_integrity_events'
  ) THEN
    CREATE POLICY students_insert_integrity_events
      ON public.exam_integrity_events
      FOR INSERT
      TO authenticated
      WITH CHECK (student_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exam_integrity_events'
      AND policyname = 'students_select_own_integrity_events'
  ) THEN
    CREATE POLICY students_select_own_integrity_events
      ON public.exam_integrity_events
      FOR SELECT
      TO authenticated
      USING (student_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exam_integrity_events'
      AND policyname = 'faculty_select_exam_integrity_events'
  ) THEN
    CREATE POLICY faculty_select_exam_integrity_events
      ON public.exam_integrity_events
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.exams e
          JOIN public.subjects s ON s.id = e.subject_id
          JOIN public.users u ON u.id = auth.uid()
          WHERE e.id = exam_integrity_events.exam_id
            AND u.role ILIKE 'faculty'
            AND u.school_id = s.teacher_school_id
        )
      );
  END IF;
END $$;
