-- Keep integrity alerts from the first attempt when a retake is approved,
-- and allow retake-attempt alerts to accumulate on top.
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.review_exam_retake_requests(
  p_exam_id uuid,
  p_request_ids uuid[],
  p_action text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reviewer uuid := auth.uid();
  v_action text := lower(trim(p_action));
  v_id uuid;
  v_student_id uuid;
  v_processed integer := 0;
  v_skipped integer := 0;
BEGIN
  IF v_reviewer IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.faculty_teaches_exam(p_exam_id) THEN
    RAISE EXCEPTION 'Not authorized to review retake requests for this assessment';
  END IF;

  IF v_action NOT IN ('approve', 'deny') THEN
    RAISE EXCEPTION 'Action must be approve or deny';
  END IF;

  IF p_request_ids IS NULL OR array_length(p_request_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Select at least one request';
  END IF;

  FOREACH v_id IN ARRAY p_request_ids
  LOOP
    SELECT r.student_id
    INTO v_student_id
    FROM public.exam_retake_requests r
    WHERE r.id = v_id
      AND r.exam_id = p_exam_id
      AND r.status = 'pending';

    IF v_student_id IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF v_action = 'approve' THEN
      DELETE FROM public.student_answers
      WHERE exam_id = p_exam_id AND student_id = v_student_id;

      DELETE FROM public.exam_results
      WHERE exam_id = p_exam_id AND student_id = v_student_id;

      -- Do NOT delete exam_integrity_events: retake alerts add to the first attempt total.

      UPDATE public.exam_retake_requests
      SET status = 'approved',
          faculty_note = NULLIF(trim(p_note), ''),
          reviewed_by = v_reviewer,
          reviewed_at = now(),
          updated_at = now()
      WHERE id = v_id;
    ELSE
      UPDATE public.exam_retake_requests
      SET status = 'denied',
          faculty_note = NULLIF(trim(p_note), ''),
          reviewed_by = v_reviewer,
          reviewed_at = now(),
          updated_at = now()
      WHERE id = v_id;
    END IF;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'skipped', v_skipped
  );
END;
$$;

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

  -- Preserve all integrity events (first attempt + any retake incidents).
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_exam_retake_requests(uuid, uuid[], text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_retake_submission(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
