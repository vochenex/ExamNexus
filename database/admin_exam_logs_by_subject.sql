-- Enrich admin exam logs with subject + section context.
-- Run in Supabase SQL Editor (optional; frontend also enriches via joins).

CREATE OR REPLACE FUNCTION public.admin_list_exam_logs(p_limit integer DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF to_regclass('public.exam_integrity_events') IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_data ORDER BY created_at DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', ev.id,
          'exam_id', ev.exam_id,
          'exam_title', ex.title,
          'subject_id', sub.id,
          'subject_name', sub.name,
          'section_count', sub.section_count,
          'target_sections', ex.target_sections,
          'student_id', ev.student_id,
          'student_name', trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')),
          'student_section', coalesce(upper(trim(ss.section)), ''),
          'event_type', ev.event_type,
          'description', ev.description,
          'metadata', ev.metadata,
          'created_at', ev.created_at
        ) AS row_data,
        ev.created_at
        FROM public.exam_integrity_events ev
        JOIN public.exams ex ON ex.id = ev.exam_id
        JOIN public.subjects sub ON sub.id = ex.subject_id
        LEFT JOIN public.users u ON u.id = ev.student_id
        LEFT JOIN public.subject_students ss
          ON ss.student_id = ev.student_id
         AND ss.subject_id = sub.id
        ORDER BY ev.created_at DESC
        LIMIT greatest(1, least(coalesce(p_limit, 200), 1000))
      ) q
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_exam_logs(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
