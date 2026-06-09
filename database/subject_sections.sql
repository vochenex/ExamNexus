-- Run in Supabase Dashboard → SQL Editor
-- Adds section (A/B/C) to enrollments + classmates lookup

-- Remove duplicates, then enforce one enrollment per student + subject
DELETE FROM public.subject_students ss
WHERE ss.ctid NOT IN (
  SELECT MIN(s.ctid)
  FROM public.subject_students s
  GROUP BY s.student_id, s.subject_id
);

CREATE UNIQUE INDEX IF NOT EXISTS subject_students_student_subject_uidx
  ON public.subject_students (student_id, subject_id);

DROP FUNCTION IF EXISTS public.enroll_student_by_invite_code(text);
DROP FUNCTION IF EXISTS public.enroll_student_by_invite_code(text, text);

ALTER TABLE public.subject_students
  ADD COLUMN IF NOT EXISTS section text;

UPDATE public.subject_students
SET section = 'A'
WHERE section IS NULL OR trim(section) = '';

ALTER TABLE public.subject_students
  DROP CONSTRAINT IF EXISTS subject_students_section_check;

ALTER TABLE public.subject_students
  ADD CONSTRAINT subject_students_section_check
  CHECK (section IN ('A', 'B', 'C'));

ALTER TABLE public.subject_students
  ALTER COLUMN section SET DEFAULT 'A';

CREATE OR REPLACE FUNCTION public.enroll_student_by_invite_code(
  p_invite_code text,
  p_section text DEFAULT 'A'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid := auth.uid();
  v_subject public.subjects%ROWTYPE;
  v_section text := upper(trim(coalesce(p_section, 'A')));
BEGIN
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_section NOT IN ('A', 'B', 'C') THEN
    RAISE EXCEPTION 'Section must be A, B, or C';
  END IF;

  SELECT * INTO v_subject
  FROM public.subjects
  WHERE invite_code = lower(trim(p_invite_code));

  IF v_subject.id IS NULL THEN
    RAISE EXCEPTION 'Invalid invitation code';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.subject_students
    WHERE student_id = v_student_id
      AND subject_id = v_subject.id
  ) THEN
    RAISE EXCEPTION 'Already enrolled in %', v_subject.name;
  END IF;

  BEGIN
    INSERT INTO public.subject_students (student_id, subject_id, section)
    VALUES (v_student_id, v_subject.id, v_section);
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Already enrolled in %', v_subject.name;
  END;

  RETURN jsonb_build_object(
    'id', v_subject.id,
    'name', v_subject.name,
    'invite_code', v_subject.invite_code,
    'teacher_school_id', v_subject.teacher_school_id,
    'section', v_section
  );
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_student_by_invite_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enroll_student_by_invite_code(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_subject_classmates(p_subject_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.subject_students ss
    WHERE ss.subject_id = p_subject_id
      AND ss.student_id = v_user_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.subjects s
    JOIN public.users u ON u.id = v_user_id
    WHERE s.id = p_subject_id
      AND u.school_id = s.teacher_school_id
      AND u.role ILIKE 'faculty'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  PERFORM set_config('row_security', 'off', true);

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ss.student_id,
          'first_name', COALESCE(u.first_name, 'Student'),
          'last_name', COALESCE(u.last_name, ''),
          'avatar_url', u.avatar_url,
          'school_id', u.school_id,
          'section', COALESCE(NULLIF(trim(ss.section), ''), 'A'),
          'is_you', ss.student_id = v_user_id
        )
        ORDER BY COALESCE(NULLIF(trim(ss.section), ''), 'A'), u.last_name, u.first_name
      )
      FROM public.subject_students ss
      LEFT JOIN public.users u ON u.id = ss.student_id
      WHERE ss.subject_id = p_subject_id
    ),
    '[]'::jsonb
  );
END;
$$;

ALTER FUNCTION public.get_subject_classmates(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_subject_classmates(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_subject_classmates(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
