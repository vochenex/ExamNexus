-- Run in Supabase Dashboard → SQL Editor
-- Removes duplicate enrollments (keeps the oldest row per student + subject)
-- Safe to run multiple times.

DELETE FROM public.subject_students ss
WHERE ss.ctid NOT IN (
  SELECT MIN(s.ctid)
  FROM public.subject_students s
  GROUP BY s.student_id, s.subject_id
);

-- Block duplicate enrollments at the database level
CREATE UNIQUE INDEX IF NOT EXISTS subject_students_student_subject_uidx
  ON public.subject_students (student_id, subject_id);

NOTIFY pgrst, 'reload schema';
