-- Extends class sections beyond A/B/C (up to section L / count 12)
-- Run in Supabase SQL Editor after subject_section_count.sql

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_section_count_check;

ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_section_count_check
  CHECK (section_count BETWEEN 1 AND 12);

COMMENT ON COLUMN public.subjects.section_count IS
  'Number of class sections: 1 = A, 2 = A+B, … up to 12 = A through L.';

ALTER TABLE public.subject_students
  DROP CONSTRAINT IF EXISTS subject_students_section_check;

ALTER TABLE public.subject_students
  ADD CONSTRAINT subject_students_section_check
  CHECK (section ~ '^[A-L]$');

-- Section letters A through L
DO $$
BEGIN
  ALTER TABLE public.exams
    DROP CONSTRAINT IF EXISTS exams_target_sections_check;

  ALTER TABLE public.exams
    ADD CONSTRAINT exams_target_sections_check
    CHECK (
      target_sections <@ ARRAY['A','B','C','D','E','F','G','H','I','J','K','L']::text[]
      AND cardinality(target_sections) >= 1
    );

  ALTER TABLE public.announcements
    DROP CONSTRAINT IF EXISTS announcements_target_sections_check;

  ALTER TABLE public.announcements
    ADD CONSTRAINT announcements_target_sections_check
    CHECK (
      target_sections <@ ARRAY['A','B','C','D','E','F','G','H','I','J','K','L']::text[]
      AND cardinality(target_sections) >= 1
    );
END $$;

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
  v_section_index integer;
  v_max_sections integer;
BEGIN
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_section !~ '^[A-L]$' THEN
    RAISE EXCEPTION 'Section must be a letter from A to L';
  END IF;

  v_section_index := ascii(v_section) - 64;

  SELECT * INTO v_subject
  FROM public.subjects
  WHERE invite_code = lower(trim(p_invite_code));

  IF v_subject.id IS NULL THEN
    RAISE EXCEPTION 'Invalid invitation code';
  END IF;

  v_max_sections := GREATEST(1, LEAST(12, COALESCE(v_subject.section_count, 3)));

  IF v_section_index > v_max_sections THEN
    RAISE EXCEPTION 'Section % is not available for this subject (only % section(s))', v_section, v_max_sections;
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
    'section', v_section,
    'section_count', v_max_sections
  );
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_student_by_invite_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enroll_student_by_invite_code(text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
