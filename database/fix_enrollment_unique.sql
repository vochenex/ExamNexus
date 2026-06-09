-- Run in Supabase Dashboard → SQL Editor
-- Fixes: "no unique or exclusion constraint matching the ON CONFLICT specification"

-- Remove duplicate enrollments first (keeps oldest row)
DELETE FROM public.subject_students ss
WHERE ss.ctid NOT IN (
  SELECT MIN(s.ctid)
  FROM public.subject_students s
  GROUP BY s.student_id, s.subject_id
);

-- Required for enroll ON CONFLICT and duplicate prevention
CREATE UNIQUE INDEX IF NOT EXISTS subject_students_student_subject_uidx
  ON public.subject_students (student_id, subject_id);

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

DROP FUNCTION IF EXISTS public.enroll_student_by_invite_code(text);
DROP FUNCTION IF EXISTS public.enroll_student_by_invite_code(text, text);

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

NOTIFY pgrst, 'reload schema';

-- Verify
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'subject_students'
  AND indexname = 'subject_students_student_subject_uidx';
