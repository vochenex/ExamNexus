-- Fix exams.exam_type to store question format (not assessment category).
-- assessment_category holds exam | quiz | activity.
-- Run in Supabase Dashboard → SQL Editor

-- Preserve legacy assessment kind before rewriting exam_type
UPDATE public.exams
SET assessment_category = exam_type
WHERE exam_type IN ('exam', 'quiz', 'activity')
  AND (
    assessment_category IS NULL
    OR assessment_category NOT IN ('exam', 'quiz', 'activity')
  );

UPDATE public.exams
SET exam_type = 'multiple_choice'
WHERE exam_type IN ('exam', 'quiz', 'activity')
   OR exam_type IS NULL
   OR trim(exam_type) = '';

ALTER TABLE public.exams
  DROP CONSTRAINT IF EXISTS exams_exam_type_check;

ALTER TABLE public.exams
  ADD CONSTRAINT exams_exam_type_check
  CHECK (
    exam_type IN (
      'multiple_choice',
      'enumeration',
      'identification',
      'true_false',
      'essay',
      'mixed'
    )
  );

ALTER TABLE public.exams
  ALTER COLUMN exam_type SET DEFAULT 'multiple_choice';

NOTIFY pgrst, 'reload schema';
