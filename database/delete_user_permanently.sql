-- Permanently delete a user (profile + auth + related rows)
-- Run in Supabase Dashboard → SQL Editor
--
-- SET the user id or email below, then run the whole file.

DO $$
DECLARE
  uid uuid;
  v_email text := NULL;  -- e.g. 'user@example.com' OR leave NULL and set uid below
  v_uid uuid := '753f6971-d8a0-4a54-a810-763221ba2870'::uuid;  -- or NULL if using email
  v_school_id text;
BEGIN
  IF v_email IS NOT NULL AND trim(v_email) <> '' THEN
    SELECT id INTO uid
    FROM public.users
    WHERE lower(trim(email)) = lower(trim(v_email));
  ELSE
    uid := v_uid;
  END IF;

  IF uid IS NULL THEN
    RAISE EXCEPTION 'User not found — set v_email or v_uid';
  END IF;

  SELECT school_id INTO v_school_id FROM public.users WHERE id = uid;

  -- Unlink faculty-owned content (keeps exams/subjects; removes user reference)
  IF to_regclass('public.exams') IS NOT NULL THEN
    UPDATE public.exams SET created_by = NULL WHERE created_by = uid;
  END IF;

  IF to_regclass('public.announcements') IS NOT NULL THEN
    UPDATE public.announcements SET created_by = NULL WHERE created_by = uid;
  END IF;

  IF to_regclass('public.admin_announcements') IS NOT NULL THEN
    UPDATE public.admin_announcements SET created_by = NULL WHERE created_by = uid;
  END IF;

  IF to_regclass('public.exam_retake_requests') IS NOT NULL THEN
    UPDATE public.exam_retake_requests SET reviewed_by = NULL WHERE reviewed_by = uid;
  END IF;

  IF to_regclass('public.password_reset_requests') IS NOT NULL THEN
    UPDATE public.password_reset_requests SET resolved_by = NULL WHERE resolved_by = uid;
    UPDATE public.password_reset_requests SET user_id = NULL WHERE user_id = uid;
  END IF;

  IF v_school_id IS NOT NULL AND to_regclass('public.subjects') IS NOT NULL THEN
    UPDATE public.subjects SET teacher_school_id = NULL
    WHERE trim(teacher_school_id) = trim(v_school_id);
  END IF;

  -- Student / activity data
  DELETE FROM public.subject_students WHERE student_id = uid;
  DELETE FROM public.exam_results WHERE student_id = uid;

  IF to_regclass('public.student_answers') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.student_answers WHERE student_id = $1' USING uid;
  END IF;

  IF to_regclass('public.exam_integrity_events') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.exam_integrity_events WHERE student_id = $1' USING uid;
  END IF;

  IF to_regclass('public.exam_retake_requests') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.exam_retake_requests WHERE student_id = $1' USING uid;
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

  -- Profile + login (both required)
  DELETE FROM public.users WHERE id = uid;
  DELETE FROM auth.users WHERE id = uid;

  RAISE NOTICE 'Deleted user %', uid;
END $$;

-- Verify (should return 0 rows)
SELECT id, email FROM public.users WHERE id = '753f6971-d8a0-4a54-a810-763221ba2870';
SELECT id, email FROM auth.users WHERE id = '753f6971-d8a0-4a54-a810-763221ba2870';
