-- Per-question time spent on student answers (for faculty analytics)
-- Run in Supabase SQL Editor

ALTER TABLE public.student_answers
  ADD COLUMN IF NOT EXISTS time_spent_seconds integer;

COMMENT ON COLUMN public.student_answers.time_spent_seconds IS
  'Seconds the student spent on this question before submitting the assessment.';

ALTER TABLE public.student_answers
  DROP CONSTRAINT IF EXISTS student_answers_time_spent_check;

ALTER TABLE public.student_answers
  ADD CONSTRAINT student_answers_time_spent_check
  CHECK (time_spent_seconds IS NULL OR time_spent_seconds >= 0);

NOTIFY pgrst, 'reload schema';
