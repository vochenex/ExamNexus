-- Student results review: reliable fetch that respects faculty visibility settings.
-- Run in Supabase SQL Editor (safe to re-run).

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS allow_student_view boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_question_review boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_show_correct_answers boolean DEFAULT true;

UPDATE public.exams SET allow_student_view = true WHERE allow_student_view IS NULL;
UPDATE public.exams SET allow_question_review = true WHERE allow_question_review IS NULL;
UPDATE public.exams SET allow_show_correct_answers = true WHERE allow_show_correct_answers IS NULL;

CREATE OR REPLACE FUNCTION public.get_student_exam_result_review(
  p_exam_id uuid,
  p_student_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_student uuid;
  v_exam public.exams%ROWTYPE;
  v_result public.exam_results%ROWTYPE;
  v_show_score boolean;
  v_show_review boolean;
  v_show_answers boolean;
  v_questions jsonb := '[]'::jsonb;
  v_answers jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_student := COALESCE(p_student_id, v_uid);
  IF v_student <> v_uid THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO v_result
  FROM public.exam_results
  WHERE exam_id = p_exam_id
    AND student_id = v_student;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Result not found';
  END IF;

  SELECT * INTO v_exam
  FROM public.exams
  WHERE id = p_exam_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment not found';
  END IF;

  v_show_score := COALESCE(v_exam.allow_student_view, true);
  v_show_review := v_show_score AND COALESCE(v_exam.allow_question_review, true);
  v_show_answers := v_show_review AND COALESCE(v_exam.allow_show_correct_answers, true);

  IF NOT v_show_score THEN
    RETURN jsonb_build_object(
      'exam', jsonb_build_object(
        'id', v_exam.id,
        'title', v_exam.title,
        'description', v_exam.description,
        'exam_type', v_exam.exam_type,
        'allow_student_view', false,
        'allow_question_review', false,
        'allow_show_correct_answers', false
      ),
      'result', NULL,
      'questions', '[]'::jsonb,
      'answers', '[]'::jsonb,
      'show_score', false,
      'show_question_review', false,
      'show_correct_answers', false
    );
  END IF;

  IF v_show_review THEN
    SELECT COALESCE(
      jsonb_agg(payload ORDER BY sort_at ASC NULLS LAST, sort_id ASC),
      '[]'::jsonb
    )
    INTO v_questions
    FROM (
      SELECT
        CASE
          WHEN v_show_answers THEN to_jsonb(q)
          ELSE to_jsonb(q) - 'correct_answer' - 'correct_answers' - 'grading_options'
        END AS payload,
        q.created_at AS sort_at,
        q.id AS sort_id
      FROM public.questions q
      WHERE q.exam_id = p_exam_id
    ) ranked;

    SELECT COALESCE(jsonb_agg(to_jsonb(sa)), '[]'::jsonb)
    INTO v_answers
    FROM public.student_answers sa
    WHERE sa.exam_id = p_exam_id
      AND sa.student_id = v_student;
  END IF;

  RETURN jsonb_build_object(
    'exam', to_jsonb(v_exam) || jsonb_build_object(
      'allow_student_view', true,
      'allow_question_review', v_show_review,
      'allow_show_correct_answers', v_show_answers
    ),
    'result', to_jsonb(v_result),
    'questions', v_questions,
    'answers', v_answers,
    'show_score', true,
    'show_question_review', v_show_review,
    'show_correct_answers', v_show_answers
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_exam_result_review(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_exam_result_review(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_student_exam_result_review(uuid, uuid) IS
  'Returns a student''s own exam result with questions/answers gated by faculty visibility settings.';
