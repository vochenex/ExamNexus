-- Add created_at to exams for listing/sorting (used by faculty subject pages and exports).
-- Run in Supabase Dashboard → SQL Editor.

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.exams.created_at IS
  'When the assessment was created/published.';

CREATE INDEX IF NOT EXISTS exams_subject_created_at_idx
  ON public.exams (subject_id, created_at DESC);

NOTIFY pgrst, 'reload schema';
