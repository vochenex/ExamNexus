-- Admin login repair — run ONE block at a time in Supabase SQL Editor.
-- Edit OLD_EMAIL / NEW_EMAIL / USER_ID below if needed.

-- ============ STEP 1: Diagnostic ============
SELECT
  u.id,
  u.email AS profile_email,
  u.role,
  u.account_status,
  a.email AS auth_email,
  i.provider_id AS identity_email
FROM public.users u
LEFT JOIN auth.users a ON a.id = u.id
LEFT JOIN auth.identities i ON i.user_id = u.id AND i.provider = 'email'
WHERE lower(trim(u.email)) = 'jamespalma@gmail.com'
   OR lower(trim(a.email)) = 'jamespalma@gmail.com'
   OR u.role ILIKE 'admin';

-- ============ STEP 2: Set variables (edit these) ============
-- OLD: jamespalma@gmail.com
-- NEW: palma.james@crmc.en.com
-- USER_ID: paste from step 1

-- ============ STEP 3: Update auth.users ============
UPDATE auth.users
SET
  email = 'palma.james@crmc.en.com',
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'Admin')
WHERE lower(trim(email)) = 'jamespalma@gmail.com';

-- Should return: UPDATE 1

-- ============ STEP 4: Update auth.identities ============
UPDATE auth.identities i
SET
  provider_id = 'palma.james@crmc.en.com',
  identity_data = COALESCE(i.identity_data, '{}'::jsonb)
    || jsonb_build_object(
      'email', 'palma.james@crmc.en.com',
      'email_verified', true
    )
FROM auth.users a
WHERE i.user_id = a.id
  AND i.provider = 'email'
  AND lower(trim(a.email)) = 'palma.james@crmc.en.com';

-- ============ STEP 5: Update public.users ============
UPDATE public.users
SET
  email = 'palma.james@crmc.en.com',
  role = 'Admin',
  account_status = 'approved'
WHERE lower(trim(email)) = 'jamespalma@gmail.com';

-- Should return: UPDATE 1

-- ============ STEP 6: Verify ============
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
WHERE lower(trim(a.email)) = 'palma.james@crmc.en.com'
   OR lower(trim(u.email)) = 'palma.james@crmc.en.com';
