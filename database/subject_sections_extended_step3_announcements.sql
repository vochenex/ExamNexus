-- STEP 3 only — announcements section constraint (A–L)
-- Run after step2_exams succeeds. Run alone if you hit deadlocks.

ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_target_sections_check;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_target_sections_check
  CHECK (
    target_sections <@ ARRAY['A','B','C','D','E','F','G','H','I','J','K','L']::text[]
    AND cardinality(target_sections) >= 1
  );

NOTIFY pgrst, 'reload schema';
