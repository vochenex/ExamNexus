-- Password reset: allow users to update a pending request and view a
-- temporary password after an admin completes the reset.
-- Run in Supabase SQL Editor (safe to re-run).

ALTER TABLE public.password_reset_requests
  ADD COLUMN IF NOT EXISTS temporary_password text;

CREATE INDEX IF NOT EXISTS password_reset_requests_email_school_idx
  ON public.password_reset_requests (lower(email), school_id, created_at DESC);

-- ============================================================
-- Update pending request message (forgot password page)
-- ============================================================
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
  v_school_id text := trim(coalesce(p_school_id, ''));
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

  SELECT *
  INTO v_user
  FROM public.users
  WHERE lower(trim(email)) = v_email
    AND trim(school_id) = v_school_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'none',
      'message', 'If an account matches that email and school ID, an administrator will review your request.'
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
    'status', 'pending',
    'request_id', v_request.id,
    'message', 'Your pending password reset request was updated. An administrator will review it soon.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_password_reset_request(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_password_reset_request(text, text, text) TO authenticated;

-- ============================================================
-- Check request status / reveal temporary password
-- ============================================================
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
  v_school_id text := trim(coalesce(p_school_id, ''));
  v_user public.users%ROWTYPE;
  v_request public.password_reset_requests%ROWTYPE;
BEGIN
  IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'A valid email address is required';
  END IF;

  IF v_school_id = '' THEN
    RAISE EXCEPTION 'School ID is required';
  END IF;

  SELECT *
  INTO v_user
  FROM public.users
  WHERE lower(trim(email)) = v_email
    AND trim(school_id) = v_school_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'none',
      'message', 'If an account matches that email and school ID, an administrator will review your request.'
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
      'status', 'none',
      'message', 'No password reset request was found for this account. Send a new request from this page.'
    );
  END IF;

  IF v_request.status = 'pending' THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'pending',
      'request_id', v_request.id,
      'user_message', v_request.message,
      'message', 'Your password reset request is still pending. An administrator has not reset your password yet.'
    );
  END IF;

  IF v_request.status = 'rejected' THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'rejected',
      'request_id', v_request.id,
      'admin_message', coalesce(v_request.admin_notes, ''),
      'message', 'Your password reset request was rejected. You can send a new request if you still need help.'
    );
  END IF;

  IF v_request.status = 'completed' THEN
    -- Only expose the temp password within 7 days of completion.
    IF v_request.resolved_at IS NOT NULL
      AND v_request.resolved_at < (now() - interval '7 days') THEN
      RETURN jsonb_build_object(
        'success', true,
        'status', 'completed',
        'request_id', v_request.id,
        'admin_message', coalesce(v_request.admin_notes, ''),
        'temporary_password', NULL,
        'expired', true,
        'message', 'Your password was reset, but the temporary password is no longer available here. Contact an administrator if you still cannot sign in.'
      );
    END IF;

    RETURN jsonb_build_object(
      'success', true,
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
    'status', v_request.status,
    'request_id', v_request.id,
    'message', 'Your password reset request was found.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_password_reset_request(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_password_reset_request(text, text) TO authenticated;
