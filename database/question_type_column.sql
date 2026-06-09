-- Per-question format for mixed-format assessments
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS question_type text;

UPDATE public.questions q
SET question_type = e.exam_type
FROM public.exams e
WHERE q.exam_id = e.id
  AND (q.question_type IS NULL OR trim(q.question_type) = '');

COMMENT ON COLUMN public.questions.question_type IS
  'Question format: multiple_choice, enumeration, identification, true_false, or essay.';

NOTIFY pgrst, 'reload schema';
