-- Password reset requests (user asks admin to reset password)
-- Run in Supabase SQL Editor after users_signup_policies.sql

CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  school_id text NOT NULL,
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  admin_notes text,
  temporary_password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS password_reset_requests_status_idx
  ON public.password_reset_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS password_reset_requests_user_pending_idx
  ON public.password_reset_requests (user_id)
  WHERE status = 'pending';

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- No direct table access; use RPCs only
DROP POLICY IF EXISTS password_reset_requests_deny_all ON public.password_reset_requests;
CREATE POLICY password_reset_requests_deny_all ON public.password_reset_requests
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS password_reset_requests_admin_select ON public.password_reset_requests;
CREATE POLICY password_reset_requests_admin_select ON public.password_reset_requests
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================================
-- Submit request (login page — no auth required)
-- ============================================================
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
    -- Do not reveal whether the account exists
    RETURN jsonb_build_object(
      'success', true,
      'message', 'If an account matches that email and school ID, an administrator will review your request.'
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
    'message', 'Your password reset request was sent to an administrator. You will be notified once your password has been reset.',
    'request_id', v_request.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_password_reset_request(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_password_reset_request(text, text, text) TO authenticated;

-- ============================================================
-- Admin: list requests
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_list_password_reset_requests(
  p_status text DEFAULT NULL
)
RETURNS SETOF public.password_reset_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
    SELECT r.*
    FROM public.password_reset_requests r
    WHERE p_status IS NULL
      OR trim(p_status) = ''
      OR r.status = lower(trim(p_status))
    ORDER BY
      CASE r.status WHEN 'pending' THEN 0 ELSE 1 END,
      r.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_password_reset_requests(text) TO authenticated;

-- ============================================================
-- Admin: reject request
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_reject_password_reset_request(
  p_request_id uuid,
  p_admin_notes text DEFAULT NULL
)
RETURNS public.password_reset_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.password_reset_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.password_reset_requests
  SET
    status = 'rejected',
    admin_notes = NULLIF(trim(coalesce(p_admin_notes, '')), ''),
    resolved_at = now(),
    resolved_by = auth.uid()
  WHERE id = p_request_id
    AND status = 'pending'
  RETURNING * INTO row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending request not found';
  END IF;

  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reject_password_reset_request(uuid, text) TO authenticated;

-- ============================================================
-- Admin: mark completed (after password set via backend)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_complete_password_reset_request(
  p_request_id uuid,
  p_admin_notes text DEFAULT NULL
)
RETURNS public.password_reset_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.password_reset_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.password_reset_requests
  SET
    status = 'completed',
    admin_notes = NULLIF(trim(coalesce(p_admin_notes, '')), ''),
    resolved_at = now(),
    resolved_by = auth.uid()
  WHERE id = p_request_id
    AND status IN ('pending', 'approved')
  RETURNING * INTO row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already resolved';
  END IF;

  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_complete_password_reset_request(uuid, text) TO authenticated;

-- Dashboard stat: pending password resets
CREATE OR REPLACE FUNCTION public.admin_get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_has_account_status boolean;
  v_pending bigint := 0;
  v_integrity bigint := 0;
  v_password_resets bigint := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'account_status'
  ) INTO v_has_account_status;

  IF v_has_account_status THEN
    SELECT count(*) INTO v_pending
    FROM public.users
    WHERE account_status = 'pending'
      AND role ILIKE ANY (ARRAY['student', 'faculty']);
  END IF;

  IF to_regclass('public.exam_integrity_events') IS NOT NULL THEN
    SELECT count(*) INTO v_integrity FROM public.exam_integrity_events;
  END IF;

  IF to_regclass('public.password_reset_requests') IS NOT NULL THEN
    SELECT count(*) INTO v_password_resets
    FROM public.password_reset_requests
    WHERE status = 'pending';
  END IF;

  RETURN jsonb_build_object(
    'users', (SELECT count(*) FROM public.users),
    'students', (SELECT count(*) FROM public.users WHERE role ILIKE 'student'),
    'faculty', (SELECT count(*) FROM public.users WHERE role ILIKE 'faculty'),
    'pending_requests', v_pending,
    'pending_password_resets', v_password_resets,
    'subjects', (SELECT count(*) FROM public.subjects),
    'assessments', (SELECT count(*) FROM public.exams),
    'results', (SELECT count(*) FROM public.exam_results),
    'integrity_events', v_integrity
  );
END;
$$;

-- User update + status/reveal helpers (also in password_reset_user_reveal.sql)
ALTER TABLE public.password_reset_requests
  ADD COLUMN IF NOT EXISTS temporary_password text;

CREATE INDEX IF NOT EXISTS password_reset_requests_email_school_idx
  ON public.password_reset_requests (lower(email), school_id, created_at DESC);

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

    IF coalesce(trim(v_request.temporary_password), '') = '' THEN
      RETURN jsonb_build_object(
        'success', true,
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

CREATE OR REPLACE FUNCTION public.clear_password_reset_temporary_password()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.password_reset_requests
  SET temporary_password = NULL
  WHERE user_id = auth.uid()
    AND temporary_password IS NOT NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_password_reset_temporary_password() TO authenticated;
