-- Question grading options and assessment settings
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS grading_options jsonb;

COMMENT ON COLUMN public.questions.grading_options IS
  'Per-question grading rules such as case sensitivity, alternatives, and points.';

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS instructions text DEFAULT '',
  ADD COLUMN IF NOT EXISTS shuffle_questions boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_review boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS duration_value integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS duration_unit text DEFAULT 'minutes';

COMMENT ON COLUMN public.exams.instructions IS 'Instructions shown to students before taking the assessment.';
COMMENT ON COLUMN public.exams.shuffle_questions IS 'Whether question order is randomized per student.';
COMMENT ON COLUMN public.exams.allow_review IS 'Whether students can revisit questions before submitting.';
COMMENT ON COLUMN public.exams.duration_value IS 'Timer amount for the assessment.';
COMMENT ON COLUMN public.exams.duration_unit IS 'Timer unit: minutes or hours.';
