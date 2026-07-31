-- Passing mark (%) for exams (default 50).
-- Run in Supabase SQL Editor.

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS pass_mark numeric(5,2) DEFAULT 50;

COMMENT ON COLUMN public.exams.pass_mark IS
  'Minimum percentage required to pass this assessment (0–100).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'exams_pass_mark_range'
  ) THEN
    ALTER TABLE public.exams
      ADD CONSTRAINT exams_pass_mark_range
      CHECK (pass_mark IS NULL OR (pass_mark >= 0 AND pass_mark <= 100));
  END IF;
END $$;

UPDATE public.exams
SET pass_mark = 50
WHERE pass_mark IS NULL;
