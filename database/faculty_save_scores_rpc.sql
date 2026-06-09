-- Faculty essay / partial score saving (bypasses RLS after ownership check)
-- Run in Supabase SQL Editor after faculty_grading_policies.sql

CREATE OR REPLACE FUNCTION public.save_faculty_question_scores(
  p_exam_id uuid,
  p_student_id uuid,
  p_scores jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_allowed boolean := false;
  v_entry jsonb;
  v_question_id uuid;
  v_points numeric;
  v_max_points numeric;
  v_score numeric := 0;
  v_total numeric := 0;
  v_pending integer := 0;
  v_has_points_column boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_exam_id IS NULL OR p_student_id IS NULL THEN
    RAISE EXCEPTION 'Exam and student are required';
  END IF;

  IF p_scores IS NULL OR jsonb_typeof(p_scores) <> 'array' OR jsonb_array_length(p_scores) = 0 THEN
    RAISE EXCEPTION 'At least one score is required';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.exams e
    JOIN public.subjects s ON s.id = e.subject_id
    JOIN public.users u ON u.id = v_user_id
    WHERE e.id = p_exam_id
      AND u.role ILIKE 'faculty'
      AND u.school_id = s.teacher_school_id
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not authorized to grade this assessment';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'student_answers'
      AND column_name = 'points_awarded'
  ) INTO v_has_points_column;

  FOR v_entry IN SELECT value FROM jsonb_array_elements(p_scores)
  LOOP
    v_question_id := NULLIF(trim(both from v_entry->>'question_id'), '')::uuid;
    v_points := COALESCE(NULLIF(v_entry->>'points_awarded', '')::numeric, 0);

    IF v_question_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(NULLIF((q.grading_options->>'points')::numeric, 0), 1)
    INTO v_max_points
    FROM public.questions q
    WHERE q.id = v_question_id
      AND q.exam_id = p_exam_id;

    IF v_max_points IS NULL THEN
      RAISE EXCEPTION 'Question % does not belong to this assessment', v_question_id;
    END IF;

    v_points := GREATEST(0, LEAST(v_max_points, v_points));

    IF v_has_points_column THEN
      UPDATE public.student_answers sa
      SET
        points_awarded = v_points,
        is_correct = v_points >= v_max_points
      WHERE sa.exam_id = p_exam_id
        AND sa.student_id = p_student_id
        AND sa.question_id = v_question_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'No answer found for question %', v_question_id;
      END IF;
    ELSE
      UPDATE public.student_answers sa
      SET is_correct = v_points >= v_max_points
      WHERE sa.exam_id = p_exam_id
        AND sa.student_id = p_student_id
        AND sa.question_id = v_question_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'No answer found for question %', v_question_id;
      END IF;
    END IF;
  END LOOP;

  FOR v_question_id, v_max_points IN
    SELECT
      q.id,
      COALESCE(NULLIF((q.grading_options->>'points')::numeric, 0), 1)
    FROM public.questions q
    WHERE q.exam_id = p_exam_id
    ORDER BY q.id
  LOOP
    v_total := v_total + v_max_points;

    SELECT
      CASE
        WHEN v_has_points_column AND sa.points_awarded IS NOT NULL THEN
          GREATEST(0, LEAST(v_max_points, sa.points_awarded))
        WHEN sa.is_correct IS TRUE THEN v_max_points
        WHEN sa.is_correct IS FALSE THEN 0
        ELSE NULL
      END
    INTO v_points
    FROM public.student_answers sa
    WHERE sa.exam_id = p_exam_id
      AND sa.student_id = p_student_id
      AND sa.question_id = v_question_id;

    IF v_points IS NULL THEN
      v_pending := v_pending + 1;
    ELSE
      v_score := v_score + v_points;
    END IF;
  END LOOP;

  UPDATE public.exam_results er
  SET
    score = ROUND(v_score::numeric, 2),
    total = v_total
  WHERE er.exam_id = p_exam_id
    AND er.student_id = p_student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam result not found for this student';
  END IF;

  RETURN jsonb_build_object(
    'score', ROUND(v_score::numeric, 2),
    'total', v_total,
    'score_pct', CASE
      WHEN v_total > 0 THEN ROUND((v_score / v_total) * 1000) / 10
      ELSE NULL
    END,
    'pending_count', v_pending,
    'is_fully_graded', v_pending = 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_faculty_question_scores(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_faculty_question_scores(uuid, uuid, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
