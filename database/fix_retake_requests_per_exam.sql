-- Ensure one retake request row per (exam, student), not per student overall.
-- Older DBs that only unique'd student_id would overwrite earlier requests when a
-- student asked for a retake on a second assessment.
-- Run in Supabase SQL Editor.

DO $$
DECLARE
  r record;
BEGIN
  -- Drop any UNIQUE / PRIMARY constraints that unique only student_id on this table.
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'exam_retake_requests'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%student_id%'
      AND pg_get_constraintdef(c.oid) NOT ILIKE '%exam_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.exam_retake_requests DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'exam_retake_requests'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%exam_id%'
      AND pg_get_constraintdef(c.oid) ILIKE '%student_id%'
  ) THEN
    -- Remove exact duplicates before adding the composite unique key.
    DELETE FROM public.exam_retake_requests a
    USING public.exam_retake_requests b
    WHERE a.exam_id = b.exam_id
      AND a.student_id = b.student_id
      AND a.ctid < b.ctid;

    ALTER TABLE public.exam_retake_requests
      ADD CONSTRAINT exam_retake_requests_exam_student_key UNIQUE (exam_id, student_id);
  END IF;
END $$;

-- Conflict-safe request: never move / overwrite another exam's row.
CREATE OR REPLACE FUNCTION public.request_exam_retake(
  p_exam_id uuid,
  p_message text DEFAULT NULL
)
RETURNS public.exam_retake_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid := auth.uid();
  v_subject_id uuid;
  v_enrolled boolean := false;
  v_has_result boolean := false;
  v_exam_closed boolean := false;
  v_row public.exam_retake_requests;
BEGIN
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT e.subject_id,
         (e.end_datetime IS NOT NULL AND e.end_datetime < now())
  INTO v_subject_id, v_exam_closed
  FROM public.exams e
  WHERE e.id = p_exam_id;

  IF v_subject_id IS NULL THEN
    RAISE EXCEPTION 'Assessment not found';
  END IF;

  SELECT public.user_enrolled_in_subject(v_subject_id) INTO v_enrolled;
  IF NOT v_enrolled THEN
    RAISE EXCEPTION 'You are not enrolled in this subject';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.exam_results er
    WHERE er.exam_id = p_exam_id AND er.student_id = v_student_id
  ) INTO v_has_result;

  IF NOT v_has_result AND NOT v_exam_closed THEN
    RAISE EXCEPTION 'You can request a retake after submitting or once the assessment window has closed';
  END IF;

  SELECT * INTO v_row
  FROM public.exam_retake_requests
  WHERE exam_id = p_exam_id AND student_id = v_student_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_row.status = 'pending' THEN
      -- Idempotent: keep the existing pending request for THIS exam.
      UPDATE public.exam_retake_requests
      SET student_message = COALESCE(NULLIF(trim(p_message), ''), student_message),
          updated_at = now()
      WHERE id = v_row.id
      RETURNING * INTO v_row;
      RETURN v_row;
    END IF;

    IF v_row.status = 'approved' THEN
      RAISE EXCEPTION 'You already have an approved retake for this assessment';
    END IF;

    IF v_row.status NOT IN ('denied', 'fulfilled') THEN
      RAISE EXCEPTION 'Unable to submit a new retake request right now';
    END IF;

    UPDATE public.exam_retake_requests
    SET status = 'pending',
        student_message = COALESCE(NULLIF(trim(p_message), ''), student_message),
        faculty_note = NULL,
        reviewed_by = NULL,
        reviewed_at = NULL,
        updated_at = now()
    WHERE id = v_row.id
    RETURNING * INTO v_row;

    RETURN v_row;
  END IF;

  INSERT INTO public.exam_retake_requests (
    exam_id, student_id, status, student_message, updated_at
  )
  VALUES (
    p_exam_id, v_student_id, 'pending', NULLIF(trim(p_message), ''), now()
  )
  ON CONFLICT (exam_id, student_id) DO UPDATE
    SET status = EXCLUDED.status,
        student_message = COALESCE(EXCLUDED.student_message, public.exam_retake_requests.student_message),
        faculty_note = NULL,
        reviewed_by = NULL,
        reviewed_at = NULL,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_exam_retake(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
