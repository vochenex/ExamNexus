-- Password reset: verify account before submit + digit-normalized school ID matching
-- Run in Supabase SQL Editor, then NOTIFY pgrst, 'reload schema';

CREATE OR REPLACE FUNCTION public.normalize_school_id_digits(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(trim(coalesce(p_value, '')), '[^0-9]', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.lookup_password_reset_user(
  p_email text,
  p_school_id text
)
RETURNS public.users
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_school_id text := public.normalize_school_id_digits(p_school_id);
  v_user public.users%ROWTYPE;
BEGIN
  IF v_email = '' OR v_school_id = '' THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_user
  FROM public.users
  WHERE lower(trim(email)) = v_email
    AND public.normalize_school_id_digits(school_id) = v_school_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN v_user;
END;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_school_id_digits(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_password_reset_user(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_password_reset_account(
  p_email text,
  p_school_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_school_id text := public.normalize_school_id_digits(p_school_id);
  v_user public.users%ROWTYPE;
  v_email_exists boolean := false;
  v_school_id_exists boolean := false;
  v_has_pending boolean := false;
BEGIN
  IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'A valid email address is required';
  END IF;

  IF v_school_id = '' THEN
    RAISE EXCEPTION 'School ID is required';
  END IF;

  v_user := public.lookup_password_reset_user(v_email, v_school_id);

  IF v_user.id IS NOT NULL THEN
    IF lower(trim(coalesce(v_user.role, ''))) = 'admin' THEN
      RETURN jsonb_build_object(
        'found', false,
        'can_request', false,
        'has_pending', false,
        'message', 'Admin accounts must reset passwords through another administrator.'
      );
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.password_reset_requests
      WHERE user_id = v_user.id
        AND status = 'pending'
    )
    INTO v_has_pending;

    RETURN jsonb_build_object(
      'found', true,
      'can_request', NOT v_has_pending,
      'has_pending', v_has_pending,
      'role', v_user.role,
      'message', CASE
        WHEN v_has_pending THEN
          'You already have a pending password reset request. An administrator will contact you soon.'
        ELSE
          'Account found. You can send a password reset request.'
      END
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE lower(trim(email)) = v_email
  )
  INTO v_email_exists;

  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE public.normalize_school_id_digits(school_id) = v_school_id
  )
  INTO v_school_id_exists;

  RETURN jsonb_build_object(
    'found', false,
    'can_request', false,
    'has_pending', false,
    'message', CASE
      WHEN NOT v_email_exists AND NOT v_school_id_exists THEN
        'No account matches this email or school ID. Check both fields and try again.'
      WHEN NOT v_email_exists THEN
        'No account uses this email address. Check the email and try again.'
      WHEN NOT v_school_id_exists THEN
        'No account uses this school ID. Check the ID and try again.'
      ELSE
        'This email and school ID do not match the same account. Use the email and school ID from your profile.'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_password_reset_account(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_password_reset_request(
  p_email text,
  p_school_id text,
  p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_school_id text := public.normalize_school_id_digits(p_school_id);
  v_user public.users%ROWTYPE;
  v_request public.password_reset_requests%ROWTYPE;
BEGIN
  IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'A valid email address is required';
  END IF;

  IF v_school_id = '' THEN
    RAISE EXCEPTION 'School ID is required';
  END IF;

  v_user := public.lookup_password_reset_user(v_email, v_school_id);

  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'found', false,
      'message', 'No account matches this email and school ID. Check both fields and try again.'
    );
  END IF;

  IF lower(trim(coalesce(v_user.role, ''))) = 'admin' THEN
    RAISE EXCEPTION 'Admin accounts must reset passwords through another administrator.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.password_reset_requests
    WHERE user_id = v_user.id
      AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'found', true,
      'has_pending', true,
      'message', 'You already have a pending password reset request. An administrator will contact you soon.'
    );
  END IF;

  INSERT INTO public.password_reset_requests (
    user_id,
    email,
    school_id,
    message,
    status
  )
  VALUES (
    v_user.id,
    v_user.email,
    v_user.school_id,
    coalesce(trim(p_message), ''),
    'pending'
  )
  RETURNING * INTO v_request;

  RETURN jsonb_build_object(
    'success', true,
    'found', true,
    'has_pending', false,
    'message', 'Your password reset request was sent to an administrator. You will be notified once your password has been reset.',
    'request_id', v_request.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_password_reset_request(text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_password_reset_request(
  p_email text,
  p_school_id text,
  p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_school_id text := public.normalize_school_id_digits(p_school_id);
  v_user public.users%ROWTYPE;
  v_request public.password_reset_requests%ROWTYPE;
  v_message text := trim(coalesce(p_message, ''));
BEGIN
  IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'A valid email address is required';
  END IF;

  IF v_school_id = '' THEN
    RAISE EXCEPTION 'School ID is required';
  END IF;

  v_user := public.lookup_password_reset_user(v_email, v_school_id);

  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'found', false,
      'status', 'none',
      'message', 'No account matches this email and school ID. Check both fields and try again.'
    );
  END IF;

  IF lower(trim(coalesce(v_user.role, ''))) = 'admin' THEN
    RAISE EXCEPTION 'Admin accounts must reset passwords through another administrator.';
  END IF;

  SELECT *
  INTO v_request
  FROM public.password_reset_requests
  WHERE user_id = v_user.id
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'found', true,
      'status', 'none',
      'message', 'No pending password reset request was found for this account. Send a new request instead.'
    );
  END IF;

  UPDATE public.password_reset_requests
  SET message = v_message
  WHERE id = v_request.id
  RETURNING * INTO v_request;

  RETURN jsonb_build_object(
    'success', true,
    'found', true,
    'status', 'pending',
    'request_id', v_request.id,
    'message', 'Your pending password reset request was updated. An administrator will review it soon.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_password_reset_request(text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_password_reset_request(
  p_email text,
  p_school_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_school_id text := public.normalize_school_id_digits(p_school_id);
  v_user public.users%ROWTYPE;
  v_request public.password_reset_requests%ROWTYPE;
BEGIN
  IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'A valid email address is required';
  END IF;

  IF v_school_id = '' THEN
    RAISE EXCEPTION 'School ID is required';
  END IF;

  v_user := public.lookup_password_reset_user(v_email, v_school_id);

  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'found', false,
      'status', 'none',
      'message', 'No account matches this email and school ID. Check both fields and try again.'
    );
  END IF;

  IF lower(trim(coalesce(v_user.role, ''))) = 'admin' THEN
    RAISE EXCEPTION 'Admin accounts must reset passwords through another administrator.';
  END IF;

  SELECT *
  INTO v_request
  FROM public.password_reset_requests
  WHERE user_id = v_user.id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'found', true,
      'status', 'none',
      'message', 'No password reset request was found for this account. Send a new request from this page.'
    );
  END IF;

  IF v_request.status = 'pending' THEN
    RETURN jsonb_build_object(
      'success', true,
      'found', true,
      'status', 'pending',
      'request_id', v_request.id,
      'user_message', v_request.message,
      'message', 'Your password reset request is still pending. An administrator has not reset your password yet.'
    );
  END IF;

  IF v_request.status = 'rejected' THEN
    RETURN jsonb_build_object(
      'success', true,
      'found', true,
      'status', 'rejected',
      'request_id', v_request.id,
      'admin_message', coalesce(v_request.admin_notes, ''),
      'message', 'Your password reset request was rejected. You can send a new request if you still need help.'
    );
  END IF;

  IF v_request.status = 'completed' THEN
    IF v_request.resolved_at IS NOT NULL
      AND v_request.resolved_at < (now() - interval '7 days') THEN
      RETURN jsonb_build_object(
        'success', true,
        'found', true,
        'status', 'completed',
        'request_id', v_request.id,
        'admin_message', coalesce(v_request.admin_notes, ''),
        'temporary_password', NULL,
        'expired', true,
        'message', 'Your password was reset, but the temporary password is no longer available here. Contact an administrator if you still cannot sign in.'
      );
    END IF;

    IF coalesce(trim(v_request.temporary_password), '') = '' THEN
      RETURN jsonb_build_object(
        'success', true,
        'found', true,
        'status', 'completed',
        'request_id', v_request.id,
        'admin_message', coalesce(v_request.admin_notes, ''),
        'temporary_password', NULL,
        'consumed', true,
        'message', 'Your temporary password was already used to sign in and is no longer shown here. Use your current password, or send a new reset request if you forgot it again.'
      );
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'found', true,
      'status', 'completed',
      'request_id', v_request.id,
      'admin_message', coalesce(v_request.admin_notes, ''),
      'temporary_password', coalesce(v_request.temporary_password, ''),
      'expired', false,
      'message', 'Your password has been reset. Use the temporary password below to sign in, then change it as soon as possible.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'found', true,
    'status', v_request.status,
    'request_id', v_request.id,
    'message', 'Your password reset request was found.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_password_reset_request(text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
