-- Optional: section percentile standings for student dashboard analytics
-- Run in Supabase Dashboard → SQL Editor

CREATE OR REPLACE FUNCTION public.get_student_section_standings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_student_id uuid := auth.uid();
BEGIN
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'subject_id', row.subject_id,
          'subject_name', row.subject_name,
          'section', row.section,
          'average_pct', row.average_pct,
          'section_percentile', row.section_percentile,
          'classmates_in_section', row.classmates_in_section
        )
        ORDER BY row.subject_name
      )
      FROM (
        SELECT
          s.id AS subject_id,
          s.name AS subject_name,
          COALESCE(NULLIF(trim(ss.section), ''), 'A') AS section,
          ROUND(AVG((er.score::numeric / NULLIF(er.total, 0)) * 100), 1) AS average_pct,
          ROUND(
            100.0 * (
              COUNT(*) FILTER (
                WHERE (peer.score::numeric / NULLIF(peer.total, 0)) <
                  (er.score::numeric / NULLIF(er.total, 0))
              )::numeric / NULLIF(COUNT(*) - 1, 0)
            ),
            0
          ) AS section_percentile,
          COUNT(DISTINCT peer.student_id) AS classmates_in_section
        FROM public.exam_results er
        JOIN public.exams e ON e.id = er.exam_id
        JOIN public.subjects s ON s.id = e.subject_id
        JOIN public.subject_students ss
          ON ss.subject_id = s.id AND ss.student_id = v_student_id
        JOIN public.exam_results peer ON peer.exam_id = er.exam_id
        JOIN public.subject_students peer_ss
          ON peer_ss.subject_id = s.id
          AND peer_ss.student_id = peer.student_id
          AND COALESCE(NULLIF(trim(peer_ss.section), ''), 'A') =
              COALESCE(NULLIF(trim(ss.section), ''), 'A')
        WHERE er.student_id = v_student_id
          AND er.total > 0
        GROUP BY s.id, s.name, ss.section
      ) row
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_section_standings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_section_standings() TO authenticated;

NOTIFY pgrst, 'reload schema';
