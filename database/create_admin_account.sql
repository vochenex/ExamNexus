-- Create your first ExamNexus admin account
-- Run in Supabase SQL Editor
--
-- STEP 1: Sign up normally at /auth (any email/password you want for admin)
-- STEP 2: Run admin_account_approvals.sql first (adds account_status + promote function)
-- STEP 3: Run ONE of the options below

-- ============================================================
-- OPTION A (recommended): Promote by email
-- Change the email to match your signup email, then run:
-- ============================================================
SELECT public.promote_user_to_admin('your-admin@email.com');

-- ============================================================
-- OPTION B: Promote by school ID
-- ============================================================
-- UPDATE public.users
-- SET role = 'Admin', account_status = 'approved'
-- WHERE school_id = 'YOUR-SCHOOL-ID';

-- ============================================================
-- OPTION C: Promote by user UUID (from Authentication > Users)
-- ============================================================
-- UPDATE public.users
-- SET role = 'Admin', account_status = 'approved'
-- WHERE id = '00000000-0000-0000-0000-000000000000';

-- Verify:
-- SELECT id, email, role, account_status FROM public.users WHERE role ILIKE 'admin';
