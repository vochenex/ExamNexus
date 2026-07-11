-- Lock finished assessment sections after the student moves on.
-- Run in Supabase SQL Editor.

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS lock_completed_sections boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.exams.lock_completed_sections IS
  'When true, students cannot return to a format section after they have moved into a later section.';

NOTIFY pgrst, 'reload schema';
