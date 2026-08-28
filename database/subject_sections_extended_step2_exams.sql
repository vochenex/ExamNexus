-- STEP 2 only — exams section constraint (A–L)
-- Run this alone if the full subject_sections_extended.sql deadlocks on announcements.
-- Wait 5–10 seconds after STEP 1 before running.

ALTER TABLE public.exams
  DROP CONSTRAINT IF EXISTS exams_target_sections_check;

ALTER TABLE public.exams
  ADD CONSTRAINT exams_target_sections_check
  CHECK (
    target_sections <@ ARRAY['A','B','C','D','E','F','G','H','I','J','K','L']::text[]
    AND cardinality(target_sections) >= 1
  );

NOTIFY pgrst, 'reload schema';
