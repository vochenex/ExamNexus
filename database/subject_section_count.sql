-- Run in Supabase Dashboard → SQL Editor
-- Lets each subject define how many class sections (A, B, C) it uses

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS section_count integer NOT NULL DEFAULT 3;

UPDATE public.subjects
SET section_count = 3
WHERE section_count IS NULL
   OR section_count < 1
   OR section_count > 3;

ALTER TABLE public.subjects
  ALTER COLUMN section_count SET DEFAULT 3;

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_section_count_check;

ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_section_count_check
  CHECK (section_count BETWEEN 1 AND 3);

COMMENT ON COLUMN public.subjects.section_count IS
  'Number of class sections for this subject: 1 = A only, 2 = A+B, 3 = A+B+C.';

NOTIFY pgrst, 'reload schema';
