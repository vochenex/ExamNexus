-- Add submission timestamp to exam_results (fixes student dashboard analytics)
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE public.exam_results
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.exam_results.created_at IS
  'When the student submitted this assessment attempt.';

CREATE INDEX IF NOT EXISTS exam_results_student_created_idx
  ON public.exam_results (student_id, created_at DESC);

NOTIFY pgrst, 'reload schema';
