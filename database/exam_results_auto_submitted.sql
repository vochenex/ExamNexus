-- Track assessments force-submitted after integrity violation limit
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE public.exam_results
  ADD COLUMN IF NOT EXISTS auto_submitted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.exam_results.auto_submitted IS
  'True when the student submission was triggered automatically after max integrity violations.';

CREATE INDEX IF NOT EXISTS exam_results_exam_auto_submitted_idx
  ON public.exam_results (exam_id, auto_submitted)
  WHERE auto_submitted = true;

NOTIFY pgrst, 'reload schema';
