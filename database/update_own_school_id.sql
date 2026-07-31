-- Run once in Supabase Dashboard → SQL Editor
-- Lets a user update their own school_id and remaps faculty subject ownership.

CREATE OR REPLACE FUNCTION public.update_own_school_id(p_school_id text)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_school_id text := trim(coalesce(p_school_id, ''));
  v_role text;
  v_old_school_id text;
  v_row public.users;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_school_id = '' OR v_school_id !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'School ID must contain numbers only.';
  END IF;

  SELECT role, trim(coalesce(school_id, ''))
  INTO v_role, v_old_school_id
  FROM public.users
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF lower(coalesce(v_role, '')) = 'faculty' THEN
    IF length(v_school_id) <> 5 THEN
      RAISE EXCEPTION 'Faculty School ID must contain exactly 5 numbers.';
    END IF;
  ELSIF lower(coalesce(v_role, '')) = 'admin' THEN
    IF length(v_school_id) <> 3 THEN
      RAISE EXCEPTION 'Admin School ID must contain exactly 3 numbers.';
    END IF;
  ELSE
    IF length(v_school_id) < 9 OR length(v_school_id) > 13 THEN
      RAISE EXCEPTION 'Student School ID must contain 9 to 13 numbers.';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.users
    WHERE trim(coalesce(school_id, '')) = v_school_id
      AND id <> v_uid
  ) THEN
    RAISE EXCEPTION 'This School ID is already registered.';
  END IF;

  UPDATE public.users
  SET school_id = v_school_id
  WHERE id = v_uid
  RETURNING * INTO v_row;

  IF lower(coalesce(v_role, '')) = 'faculty'
     AND v_old_school_id <> ''
     AND v_old_school_id <> v_school_id
     AND to_regclass('public.subjects') IS NOT NULL THEN
    UPDATE public.subjects
    SET teacher_school_id = v_school_id
    WHERE trim(coalesce(teacher_school_id, '')) = v_old_school_id;
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_own_school_id(text) TO authenticated;
