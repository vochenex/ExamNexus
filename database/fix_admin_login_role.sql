-- Fix admin login: auth metadata still says "Student" and overwrites Admin on each login
-- Run in Supabase SQL Editor for jamespalma@gmail.com (or change the email)

-- 1) Ensure profile is Admin + approved
UPDATE public.users
SET role = 'Admin', account_status = 'approved'
WHERE lower(trim(email)) = lower(trim('jamespalma@gmail.com'));

-- 2) Sync auth metadata so login stops resetting role to Student
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'Admin')
WHERE lower(trim(email)) = lower(trim('jamespalma@gmail.com'));

-- 3) Re-apply SQL fixes (run users_signup_policies.sql patch section OR promote again):
-- SELECT public.promote_user_to_admin('jamespalma@gmail.com');

-- Verify
SELECT id, email, role, account_status FROM public.users
WHERE lower(trim(email)) = lower(trim('jamespalma@gmail.com'));

SELECT id, email, raw_user_meta_data->>'role' AS auth_role
FROM auth.users
WHERE lower(trim(email)) = lower(trim('jamespalma@gmail.com'));
