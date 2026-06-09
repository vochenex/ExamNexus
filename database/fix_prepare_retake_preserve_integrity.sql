-- Preserve integrity alerts when a student submits an approved retake.
-- Run in Supabase SQL Editor after exam_retake_requests.sql.

CREATE OR REPLACE FUNCTION public.prepare_retake_submission(p_exam_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.exam_retake_requests r
    WHERE r.exam_id = p_exam_id
      AND r.student_id = auth.uid()
      AND r.status = 'approved'
  ) THEN
    RETURN;
  END IF;

  DELETE FROM public.student_answers
  WHERE exam_id = p_exam_id AND student_id = auth.uid();

  DELETE FROM public.exam_results
  WHERE exam_id = p_exam_id AND student_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.prepare_retake_submission(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
