-- Run in Supabase Dashboard → SQL Editor
-- Deletes the listed users and their related enrollment/result data

DO $$
DECLARE
  user_ids uuid[] := ARRAY[
    'a7bf5b06-e881-480c-a9d4-b9ab871f9016'::uuid,
    'fa648a91-05d2-4275-a7bc-a0979e556da9'::uuid,
    '521ca203-950c-4569-8079-ced669036356'::uuid
  ];
  uid uuid;
BEGIN
  FOREACH uid IN ARRAY user_ids LOOP
    DELETE FROM public.subject_students WHERE student_id = uid;
    DELETE FROM public.exam_results WHERE student_id = uid;

    IF to_regclass('public.student_answers') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.student_answers WHERE student_id = $1' USING uid;
    END IF;

    DELETE FROM public.users WHERE id = uid;
    DELETE FROM auth.users WHERE id = uid;
  END LOOP;
END $$;

-- Should return 0 rows if deletion succeeded
SELECT id, email, first_name, last_name
FROM public.users
WHERE id IN (
  'a7bf5b06-e881-480c-a9d4-b9ab871f9016',
  'fa648a91-05d2-4275-a7bc-a0979e556da9',
  '521ca203-950c-4569-8079-ced669036356'
);
