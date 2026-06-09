-- Run in Supabase Dashboard → SQL Editor
-- Deletes user ab541d61-ab2a-4692-93b0-ed720ef7a68c and related data

DO $$
DECLARE
  uid uuid := 'ab541d61-ab2a-4692-93b0-ed720ef7a68c'::uuid;
BEGIN
  DELETE FROM public.subject_students WHERE student_id = uid;
  DELETE FROM public.exam_results WHERE student_id = uid;

  IF to_regclass('public.student_answers') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.student_answers WHERE student_id = $1' USING uid;
  END IF;

  IF to_regclass('public.exam_integrity_events') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.exam_integrity_events WHERE student_id = $1' USING uid;
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.notifications WHERE user_id = $1' USING uid;
  END IF;

  IF to_regclass('public.announcement_reactions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.announcement_reactions WHERE user_id = $1' USING uid;
  END IF;

  IF to_regclass('public.announcement_comments') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.announcement_comments WHERE user_id = $1' USING uid;
  END IF;

  DELETE FROM public.users WHERE id = uid;
  DELETE FROM auth.users WHERE id = uid;
END $$;

-- Should return 0 rows if deletion succeeded
SELECT id, email, first_name, last_name, role
FROM public.users
WHERE id = 'ab541d61-ab2a-4692-93b0-ed720ef7a68c';
