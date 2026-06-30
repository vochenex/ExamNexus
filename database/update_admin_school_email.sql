-- Move an existing admin account to the school email format (lastname.firstname@crmc.en.com)
-- Run once in Supabase Dashboard → SQL Editor.
--
-- 1) Edit OLD_EMAIL and NEW_EMAIL below.
-- 2) Run the whole script.
-- 3) Log in with NEW_EMAIL and your existing password.

DO $$
DECLARE
  v_old_email text := 'jamespalma@gmail.com';
  v_new_email text := 'palma.james@crmc.en.com';
  v_user_id uuid;
BEGIN
  v_old_email := lower(trim(v_old_email));
  v_new_email := lower(trim(v_new_email));

  IF v_new_email !~ '^[a-z][a-z0-9]*\.[a-z][a-z0-9]*@crmc\.en\.com$' THEN
    RAISE EXCEPTION 'NEW_EMAIL must match lastname.firstname@crmc.en.com';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(trim(email)) = v_old_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found for %', v_old_email;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(trim(email)) = v_new_email
      AND id <> v_user_id
  ) THEN
    RAISE EXCEPTION 'Another account already uses %', v_new_email;
  END IF;

  UPDATE auth.users
  SET
    email = v_new_email,
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', 'Admin')
  WHERE id = v_user_id;

  UPDATE auth.identities
  SET
    provider_id = v_new_email,
    identity_data = COALESCE(identity_data, '{}'::jsonb)
      || jsonb_build_object(
        'email', v_new_email,
        'email_verified', true,
        'sub', v_user_id::text
      )
  WHERE user_id = v_user_id
    AND provider = 'email';

  UPDATE public.users
  SET
    email = v_new_email,
    role = 'Admin',
    account_status = 'approved'
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No public.users row for id %', v_user_id;
  END IF;

  RAISE NOTICE 'Admin updated: % -> % (id: %)', v_old_email, v_new_email, v_user_id;
END $$;

-- Verify
SELECT id, email, role, account_status
FROM public.users
WHERE lower(trim(email)) = lower(trim('palma.james@crmc.en.com'));

SELECT id, email, email_confirmed_at IS NOT NULL AS email_confirmed,
       raw_user_meta_data->>'role' AS auth_role
FROM auth.users
WHERE lower(trim(email)) = lower(trim('palma.james@crmc.en.com'));
