-- Faculty exam analytics RPC (bypasses RLS safely after ownership check)
-- Run in Supabase SQL Editor. Also re-applies SELECT policies as fallback.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exam_results'
      AND policyname = 'faculty_select_exam_results'
  ) THEN
    CREATE POLICY faculty_select_exam_results
      ON public.exam_results
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.exams e
          JOIN public.subjects s ON s.id = e.subject_id
          JOIN public.users u ON u.id = auth.uid()
          WHERE e.id = exam_results.exam_id
            AND u.role ILIKE 'faculty'
            AND u.school_id = s.teacher_school_id
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.student_answers') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'student_answers'
      AND policyname = 'faculty_select_exam_answers'
  ) THEN
    CREATE POLICY faculty_select_exam_answers
      ON public.student_answers
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.exams e
          JOIN public.subjects s ON s.id = e.subject_id
          JOIN public.users u ON u.id = auth.uid()
          WHERE e.id = student_answers.exam_id
            AND u.role ILIKE 'faculty'
            AND u.school_id = s.teacher_school_id
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_exam_faculty_analytics(p_exam_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_allowed boolean := false;
  v_has_answers boolean := to_regclass('public.student_answers') IS NOT NULL;
  v_has_integrity boolean := to_regclass('public.exam_integrity_events') IS NOT NULL;
  v_has_time_column boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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
    RAISE EXCEPTION 'Not authorized to view analytics for this assessment';
  END IF;

  IF v_has_answers THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'student_answers'
        AND column_name = 'time_spent_seconds'
    ) INTO v_has_time_column;
  END IF;

  RETURN jsonb_build_object(
    'results', COALESCE((
      SELECT jsonb_agg(row_data ORDER BY (row_data->>'score_pct')::numeric DESC NULLS LAST)
      FROM (
        SELECT jsonb_build_object(
          'id', er.id,
          'score', er.score,
          'total', er.total,
          'student_id', er.student_id,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'school_id', u.school_id,
          'score_pct', CASE
            WHEN COALESCE(er.total, 0) > 0
              THEN ROUND((er.score::numeric / er.total::numeric) * 1000) / 10
            ELSE NULL
          END
        ) AS row_data
        FROM public.exam_results er
        LEFT JOIN public.users u ON u.id = er.student_id
        WHERE er.exam_id = p_exam_id
      ) ranked
    ), '[]'::jsonb),
    'student_answers', CASE
      WHEN v_has_answers THEN COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'question_id', sa.question_id,
            'student_id', sa.student_id,
            'is_correct', sa.is_correct,
            'time_spent_seconds', CASE
              WHEN v_has_time_column THEN sa.time_spent_seconds
              ELSE NULL
            END
          )
        )
        FROM public.student_answers sa
        WHERE sa.exam_id = p_exam_id
      ), '[]'::jsonb)
      ELSE '[]'::jsonb
    END,
    'integrity_events', CASE
      WHEN v_has_integrity THEN COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', eie.id,
            'student_id', eie.student_id,
            'event_type', eie.event_type,
            'description', eie.description,
            'metadata', eie.metadata,
            'created_at', eie.created_at
          )
          ORDER BY eie.created_at ASC
        )
        FROM public.exam_integrity_events eie
        WHERE eie.exam_id = p_exam_id
      ), '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_exam_faculty_analytics(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_exam_faculty_analytics(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
