-- Persist assessment category: exam, quiz, or activity
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS assessment_category text NOT NULL DEFAULT 'exam';

COMMENT ON COLUMN public.exams.assessment_category IS
  'High-level assessment kind: exam, quiz, or activity. Distinct from exam_type (question format).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'exams_assessment_category_check'
  ) THEN
    ALTER TABLE public.exams
      ADD CONSTRAINT exams_assessment_category_check
      CHECK (assessment_category IN ('exam', 'quiz', 'activity'));
  END IF;
END $$;
