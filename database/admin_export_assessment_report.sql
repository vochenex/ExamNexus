-- Run in Supabase SQL Editor (re-run this to replace any stale version).
-- Full assessment export payload for admin reports (students, scores, questions, faculty).
-- IMPORTANT: questions table has option_a..option_d — there is NO q.options column.

DROP FUNCTION IF EXISTS public.admin_export_assessment_report(uuid);

CREATE OR REPLACE FUNCTION public.admin_export_assessment_report(p_exam_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_exam_id IS NULL THEN
    RAISE EXCEPTION 'Assessment id is required';
  END IF;

  SELECT jsonb_build_object(
    'id', e.id,
    'title', e.title,
    'description', e.description,
    'instructions', e.instructions,
    'type', e.exam_type,
    'exam_type', e.exam_type,
    'category', e.assessment_category,
    'assessment_category', e.assessment_category,
    'subject', s.name,
    'subject_id', s.id,
    'faculty_school_id', s.teacher_school_id,
    'faculty_name', trim(coalesce(f.first_name, '') || ' ' || coalesce(f.last_name, '')),
    'start', e.start_datetime,
    'end', e.end_datetime,
    'start_datetime', e.start_datetime,
    'end_datetime', e.end_datetime,
    'target_sections', e.target_sections,
    'pass_mark', 50,
    'questions', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'question_text', q.question,
          'question', q.question,
          'question_type', q.question_type,
          'option_a', q.option_a,
          'option_b', q.option_b,
          'option_c', q.option_c,
          'option_d', q.option_d,
          'correct_answer', q.correct_answer,
          'correct_answers', q.correct_answers,
          'points', COALESCE(NULLIF((q.grading_options->>'points')::numeric, 0), 1),
          'grading_options', q.grading_options
        )
        ORDER BY q.created_at ASC NULLS LAST
      )
      FROM public.questions q
      WHERE q.exam_id = e.id
    ), '[]'::jsonb),
    'students', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'student_id', er.student_id,
          'student_name', trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')),
          'student_email', u.email,
          'school_id', u.school_id,
          'score', er.score,
          'total', er.total,
          'percentage', CASE
            WHEN er.total > 0 THEN round((er.score::numeric / er.total::numeric) * 100, 2)
            ELSE NULL
          END,
          'submitted_at', er.created_at
        )
        ORDER BY u.last_name ASC NULLS LAST, u.first_name ASC NULLS LAST
      )
      FROM public.exam_results er
      JOIN public.users u ON u.id = er.student_id
      WHERE er.exam_id = e.id
    ), '[]'::jsonb)
  )
  INTO result
  FROM public.exams e
  JOIN public.subjects s ON s.id = e.subject_id
  LEFT JOIN public.users f ON f.school_id = s.teacher_school_id
  WHERE e.id = p_exam_id;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Assessment not found';
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_export_assessment_report(uuid) TO authenticated;
