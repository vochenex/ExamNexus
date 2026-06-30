-- Change admin email: jamespalma@gmail.com -> palma.james@crmc.en.com
-- Run each section separately in Supabase SQL Editor (select + Run).
-- If a step returns 0 rows updated, stop and check the diagnostic.

-- ============ 1) FIND YOUR USER ID ============
SELECT id, email, role, account_status
FROM public.users
WHERE lower(trim(email)) = 'jamespalma@gmail.com';

SELECT id, email, raw_user_meta_data->>'role' AS auth_role
FROM auth.users
WHERE lower(trim(email)) = 'jamespalma@gmail.com';

-- Copy the id from above (both should match). Paste it below in every step.

-- ============ 2) UPDATE auth.users ============
-- Replace PASTE_USER_ID_HERE with your uuid, e.g. fa6e9439-xxxx-xxxx-xxxx-xxxxxxxxxxxx

UPDATE auth.users
SET
  email = 'palma.james@crmc.en.com',
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'Admin')
WHERE id = 'PASTE_USER_ID_HERE'::uuid
  AND lower(trim(email)) = 'jamespalma@gmail.com';

-- ============ 3) UPDATE auth.identities (required for login) ============

UPDATE auth.identities
SET
  provider_id = 'palma.james@crmc.en.com',
  identity_data = COALESCE(identity_data, '{}'::jsonb)
    || jsonb_build_object(
      'email', 'palma.james@crmc.en.com',
      'email_verified', true
    )
WHERE user_id = 'PASTE_USER_ID_HERE'::uuid
  AND provider = 'email';

-- ============ 4) UPDATE public.users profile ============

UPDATE public.users
SET
  email = 'palma.james@crmc.en.com',
  role = 'Admin',
  account_status = 'approved'
WHERE id = 'PASTE_USER_ID_HERE'::uuid
  AND lower(trim(email)) = 'jamespalma@gmail.com';

-- ============ 5) VERIFY ============

SELECT
  u.id,
  u.email AS profile_email,
  u.role,
  u.account_status,
  a.email AS auth_email,
  i.provider_id AS identity_email
FROM public.users u
JOIN auth.users a ON a.id = u.id
LEFT JOIN auth.identities i ON i.user_id = u.id AND i.provider = 'email'
WHERE u.id = 'PASTE_USER_ID_HERE'::uuid;

-- All three email columns should show: palma.james@crmc.en.com

-- ============ ALTERNATIVE: fix role only (keep Gmail, log in with jamespalma@gmail.com) ============
-- Use this if you want to stay on Gmail for now. The app now allows any email on login.

-- UPDATE public.users
-- SET role = 'Admin', account_status = 'approved'
-- WHERE lower(trim(email)) = 'jamespalma@gmail.com';
--
-- UPDATE auth.users
-- SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
--   || jsonb_build_object('role', 'Admin')
-- WHERE lower(trim(email)) = 'jamespalma@gmail.com';
