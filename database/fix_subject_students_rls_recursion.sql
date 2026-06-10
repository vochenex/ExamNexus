-- Fix: infinite recursion in subject_students RLS policy
-- Cause: the SELECT policy queried subject_students inside itself.
-- Run in Supabase SQL Editor after student_unenroll_and_section_classmates.sql

CREATE OR REPLACE FUNCTION public.user_section_in_subject(p_subject_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_section text;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  SELECT upper(trim(coalesce(section, 'A')))
  INTO v_section
  FROM public.subject_students
  WHERE student_id = auth.uid()
    AND subject_id = p_subject_id
  LIMIT 1;

  RETURN v_section;
END;
$$;

CREATE OR REPLACE FUNCTION public.student_can_view_peer_enrollment(
  p_subject_id uuid,
  p_peer_section text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    public.user_enrolled_in_subject(p_subject_id)
    AND upper(trim(coalesce(p_peer_section, 'A')))
      = coalesce(public.user_section_in_subject(p_subject_id), 'A');
$$;

GRANT EXECUTE ON FUNCTION public.user_section_in_subject(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_can_view_peer_enrollment(uuid, text) TO authenticated;

DROP POLICY IF EXISTS subject_students_select_shared ON public.subject_students;

CREATE POLICY subject_students_select_shared ON public.subject_students
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.user_teaches_subject(subject_id)
    OR public.student_can_view_peer_enrollment(subject_id, section)
  );

NOTIFY pgrst, 'reload schema';
