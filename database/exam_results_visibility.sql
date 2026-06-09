-- Student results visibility settings on assessments
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS allow_student_view boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_question_review boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_show_correct_answers boolean DEFAULT true;

COMMENT ON COLUMN public.exams.allow_student_view IS
  'When true, students can view their score after submission.';
COMMENT ON COLUMN public.exams.allow_question_review IS
  'When true (and allow_student_view is true), students can review each question and their answers.';
COMMENT ON COLUMN public.exams.allow_show_correct_answers IS
  'When true (and allow_question_review is true), students can see the correct answer for each question.';

UPDATE public.exams
SET allow_student_view = true
WHERE allow_student_view IS NULL;

UPDATE public.exams
SET allow_question_review = true
WHERE allow_question_review IS NULL;

UPDATE public.exams
SET allow_show_correct_answers = true
WHERE allow_show_correct_answers IS NULL;
