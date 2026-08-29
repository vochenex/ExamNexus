-- Exclude students from an assessment with automatic perfect score.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.exam_student_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  excluded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, student_id)
);

CREATE INDEX IF NOT EXISTS exam_student_exclusions_exam_idx
  ON public.exam_student_exclusions (exam_id);

CREATE INDEX IF NOT EXISTS exam_student_exclusions_student_idx
  ON public.exam_student_exclusions (student_id);

ALTER TABLE public.exam_student_exclusions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exam_student_exclusions'
      AND policyname = 'exam_exclusions_student_select_own'
  ) THEN
    CREATE POLICY exam_exclusions_student_select_own
      ON public.exam_student_exclusions FOR SELECT TO authenticated
      USING (student_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exam_student_exclusions'
      AND policyname = 'exam_exclusions_faculty_all'
  ) THEN
    CREATE POLICY exam_exclusions_faculty_all
      ON public.exam_student_exclusions FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.exams e
          WHERE e.id = exam_student_exclusions.exam_id
            AND public.user_teaches_subject(e.subject_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.exams e
          WHERE e.id = exam_student_exclusions.exam_id
            AND public.user_teaches_subject(e.subject_id)
        )
      );
  END IF;
END $$;

-- Award perfect score when faculty excludes a student from an assessment.
CREATE OR REPLACE FUNCTION public.exclude_student_from_exam(
  p_exam_id uuid,
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reviewer uuid := auth.uid();
  v_total integer := 0;
  v_points integer;
  v_q record;
BEGIN
  IF v_reviewer IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.faculty_teaches_exam(p_exam_id) THEN
    RAISE EXCEPTION 'Not authorized to exclude students from this assessment';
  END IF;

  IF p_student_id IS NULL THEN
    RAISE EXCEPTION 'Student is required';
  END IF;

  -- Sum max points across questions (grading_options.points or 1).
  FOR v_q IN
    SELECT grading_options
    FROM public.questions
    WHERE exam_id = p_exam_id
  LOOP
    BEGIN
      v_points := COALESCE(NULLIF((v_q.grading_options->>'points')::numeric, 0), 1);
    EXCEPTION WHEN others THEN
      v_points := 1;
    END;
    IF v_points IS NULL OR v_points <= 0 THEN
      v_points := 1;
    END IF;
    v_total := v_total + v_points::integer;
  END LOOP;

  IF v_total <= 0 THEN
    SELECT COUNT(*)::integer INTO v_total FROM public.questions WHERE exam_id = p_exam_id;
  END IF;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'This assessment has no questions; cannot award a perfect score';
  END IF;

  INSERT INTO public.exam_student_exclusions (exam_id, student_id, excluded_by)
  VALUES (p_exam_id, p_student_id, v_reviewer)
  ON CONFLICT (exam_id, student_id) DO UPDATE
    SET excluded_by = EXCLUDED.excluded_by,
        created_at = now();

  -- Perfect score result (overwrite any prior result for this attempt).
  DELETE FROM public.student_answers
  WHERE exam_id = p_exam_id AND student_id = p_student_id;

  DELETE FROM public.exam_results
  WHERE exam_id = p_exam_id AND student_id = p_student_id;

  INSERT INTO public.exam_results (exam_id, student_id, score, total)
  VALUES (p_exam_id, p_student_id, v_total, v_total);

  -- Clear any open retake so excluded students are not invited back in.
  UPDATE public.exam_retake_requests
  SET status = 'fulfilled',
      updated_at = now()
  WHERE exam_id = p_exam_id
    AND student_id = p_student_id
    AND status IN ('pending', 'approved');

  RETURN jsonb_build_object(
    'exam_id', p_exam_id,
    'student_id', p_student_id,
    'score', v_total,
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.exclude_student_from_exam(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.include_student_in_exam(
  p_exam_id uuid,
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reviewer uuid := auth.uid();
BEGIN
  IF v_reviewer IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.faculty_teaches_exam(p_exam_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.exam_student_exclusions
  WHERE exam_id = p_exam_id AND student_id = p_student_id;

  -- Remove the auto perfect-score result so they can take/submit normally again.
  DELETE FROM public.student_answers
  WHERE exam_id = p_exam_id AND student_id = p_student_id;

  DELETE FROM public.exam_results
  WHERE exam_id = p_exam_id AND student_id = p_student_id;

  RETURN jsonb_build_object(
    'exam_id', p_exam_id,
    'student_id', p_student_id,
    'included', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.include_student_in_exam(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_exam_exclusions(p_exam_id uuid)
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
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC)
    FROM (
      SELECT
        x.id,
        x.exam_id,
        x.student_id,
        x.excluded_by,
        x.created_at,
        u.first_name,
        u.last_name,
        u.email,
        u.school_id,
        u.avatar_url,
        er.score,
        er.total
      FROM public.exam_student_exclusions x
      JOIN public.users u ON u.id = x.student_id
      LEFT JOIN public.exam_results er
        ON er.exam_id = x.exam_id AND er.student_id = x.student_id
      WHERE x.exam_id = p_exam_id
    ) t
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_exam_exclusions(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
