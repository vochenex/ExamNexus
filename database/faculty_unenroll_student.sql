-- Run once in Supabase Dashboard → SQL Editor
-- Allows faculty who teach a subject to remove an enrolled student.

CREATE OR REPLACE FUNCTION public.faculty_unenroll_student_from_subject(
  p_subject_id uuid,
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_faculty_id uuid := auth.uid();
  v_subject_name text;
  v_student_name text;
  v_deleted integer := 0;
BEGIN
  IF v_faculty_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_subject_id IS NULL OR p_student_id IS NULL THEN
    RAISE EXCEPTION 'Subject and student are required.';
  END IF;

  IF NOT public.user_teaches_subject(p_subject_id) THEN
    RAISE EXCEPTION 'Only the assigned faculty can unenroll students from this subject.';
  END IF;

  SELECT s.name
  INTO v_subject_name
  FROM public.subjects s
  WHERE s.id = p_subject_id;

  IF v_subject_name IS NULL THEN
    RAISE EXCEPTION 'Subject not found';
  END IF;

  SELECT trim(both FROM concat_ws(' ', u.first_name, u.last_name))
  INTO v_student_name
  FROM public.users u
  WHERE u.id = p_student_id;

  DELETE FROM public.subject_students
  WHERE subject_id = p_subject_id
    AND student_id = p_student_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RAISE EXCEPTION 'That student is not enrolled in this subject';
  END IF;

  RETURN jsonb_build_object(
    'subject_id', p_subject_id,
    'subject_name', v_subject_name,
    'student_id', p_student_id,
    'student_name', COALESCE(NULLIF(v_student_name, ''), 'Student')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.faculty_unenroll_student_from_subject(uuid, uuid)
  TO authenticated;
