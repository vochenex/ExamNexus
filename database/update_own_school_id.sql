-- Run once in Supabase Dashboard → SQL Editor
-- Lets a user update their own school_id and remaps faculty subject ownership.
-- Faculty: exactly 5 digits. Legacy 3-digit faculty IDs are upgraded here;
-- subjects.teacher_school_id is remapped so faculty do not lose subjects.

CREATE OR REPLACE FUNCTION public.update_own_school_id(p_school_id text)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_school_id text := regexp_replace(trim(coalesce(p_school_id, '')), '[^0-9]', '', 'g');
  v_role text;
  v_old_school_id text;
  v_row public.users;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_school_id = '' THEN
    RAISE EXCEPTION 'School ID must contain numbers only.';
  END IF;

  SELECT role, regexp_replace(trim(coalesce(school_id, '')), '[^0-9]', '', 'g')
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
    WHERE regexp_replace(trim(coalesce(school_id, '')), '[^0-9]', '', 'g') = v_school_id
      AND id <> v_uid
  ) THEN
    RAISE EXCEPTION 'This School ID is already registered.';
  END IF;

  -- Already on the correct ID: no-op (prevents APK/web loops from rewriting).
  IF v_old_school_id = v_school_id THEN
    SELECT * INTO v_row FROM public.users WHERE id = v_uid;
    RETURN v_row;
  END IF;

  UPDATE public.users
  SET school_id = v_school_id
  WHERE id = v_uid
  RETURNING * INTO v_row;

  IF lower(coalesce(v_role, '')) = 'faculty'
     AND v_old_school_id <> ''
     AND to_regclass('public.subjects') IS NOT NULL THEN
    UPDATE public.subjects
    SET teacher_school_id = v_school_id
    WHERE regexp_replace(trim(coalesce(teacher_school_id, '')), '[^0-9]', '', 'g') = v_old_school_id;
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_own_school_id(text) TO authenticated;
