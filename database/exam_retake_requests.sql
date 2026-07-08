-- Exam retake requests: students request, faculty approve/deny (bulk supported)
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.exam_retake_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'fulfilled')),
  student_message text,
  faculty_note text,
  -- Snapshot scores so faculty can compare original vs retake even though
  -- exam_results is cleared to allow the retake submission.
  original_score integer,
  original_total integer,
  retake_score integer,
  retake_total integer,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, student_id)
);

CREATE INDEX IF NOT EXISTS exam_retake_requests_exam_status_idx
  ON public.exam_retake_requests (exam_id, status);

CREATE INDEX IF NOT EXISTS exam_retake_requests_student_idx
  ON public.exam_retake_requests (student_id);

ALTER TABLE public.exam_retake_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exam_retake_requests'
      AND policyname = 'retake_requests_student_select_own'
  ) THEN
    CREATE POLICY retake_requests_student_select_own
      ON public.exam_retake_requests FOR SELECT TO authenticated
      USING (student_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exam_retake_requests'
      AND policyname = 'retake_requests_faculty_select'
  ) THEN
    CREATE POLICY retake_requests_faculty_select
      ON public.exam_retake_requests FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.exams e
          WHERE e.id = exam_retake_requests.exam_id
            AND public.user_teaches_subject(e.subject_id)
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.faculty_teaches_exam(p_exam_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.exams e
    WHERE e.id = p_exam_id
      AND public.user_teaches_subject(e.subject_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.faculty_teaches_exam(uuid) TO authenticated;

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
  WHERE exam_id = p_exam_id AND student_id = v_student_id;

  IF FOUND THEN
    IF v_row.status = 'pending' THEN
      RAISE EXCEPTION 'Your retake request is already pending faculty review';
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
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_exam_retake(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_exam_retake_requests(p_exam_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.faculty_teaches_exam(p_exam_id) THEN
    RAISE EXCEPTION 'Not authorized to view retake requests for this assessment';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.sort_order, t.created_at DESC)
    FROM (
      SELECT
        r.id,
        r.exam_id,
        r.student_id,
        r.status,
        r.student_message,
        r.faculty_note,
        r.original_score,
        r.original_total,
        r.retake_score,
        r.retake_total,
        r.reviewed_by,
        r.reviewed_at,
        r.created_at,
        r.updated_at,
        u.first_name,
        u.last_name,
        u.email,
        u.avatar_url,
        er.score AS last_score,
        er.total AS last_total,
        ss.section,
        CASE r.status
          WHEN 'pending' THEN 0
          WHEN 'approved' THEN 1
          WHEN 'denied' THEN 2
          ELSE 3
        END AS sort_order
      FROM public.exam_retake_requests r
      JOIN public.users u ON u.id = r.student_id
      LEFT JOIN public.exam_results er
        ON er.exam_id = r.exam_id AND er.student_id = r.student_id
      LEFT JOIN public.exams e ON e.id = r.exam_id
      LEFT JOIN public.subject_students ss
        ON ss.subject_id = e.subject_id AND ss.student_id = r.student_id
      WHERE r.exam_id = p_exam_id
    ) t
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_exam_retake_requests(uuid) TO authenticated;

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
  v_prev_score integer;
  v_prev_total integer;
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
      -- Snapshot the student's current score before clearing results/answers.
      SELECT er.score, er.total
      INTO v_prev_score, v_prev_total
      FROM public.exam_results er
      WHERE er.exam_id = p_exam_id AND er.student_id = v_student_id
      LIMIT 1;

      DELETE FROM public.student_answers
      WHERE exam_id = p_exam_id AND student_id = v_student_id;

      DELETE FROM public.exam_results
      WHERE exam_id = p_exam_id AND student_id = v_student_id;

      UPDATE public.exam_retake_requests
      SET status = 'approved',
          faculty_note = NULLIF(trim(p_note), ''),
          original_score = COALESCE(original_score, v_prev_score),
          original_total = COALESCE(original_total, v_prev_total),
          -- Clear any previous retake snapshot when approving a new retake.
          retake_score = NULL,
          retake_total = NULL,
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

GRANT EXECUTE ON FUNCTION public.review_exam_retake_requests(uuid, uuid[], text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_student_retake_status(p_exam_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT r.status
  FROM public.exam_retake_requests r
  WHERE r.exam_id = p_exam_id
    AND r.student_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_retake_status(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_retake_fulfilled(p_exam_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score integer;
  v_total integer;
BEGIN
  -- Snapshot the score from the retake submission (exam_results row just inserted).
  SELECT er.score, er.total
  INTO v_score, v_total
  FROM public.exam_results er
  WHERE er.exam_id = p_exam_id
    AND er.student_id = auth.uid()
  LIMIT 1;

  UPDATE public.exam_retake_requests
  SET status = 'fulfilled',
      retake_score = COALESCE(retake_score, v_score),
      retake_total = COALESCE(retake_total, v_total),
      updated_at = now()
  WHERE exam_id = p_exam_id
    AND student_id = auth.uid()
    AND status = 'approved';
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_retake_fulfilled(uuid) TO authenticated;

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

  -- Preserve integrity events from the current attempt so faculty can review retake alerts.
END;
$$;

GRANT EXECUTE ON FUNCTION public.prepare_retake_submission(uuid) TO authenticated;
