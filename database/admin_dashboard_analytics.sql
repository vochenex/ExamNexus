-- Admin dashboard analytics (bar charts)
-- Run once in Supabase Dashboard → SQL Editor

CREATE OR REPLACE FUNCTION public.admin_get_dashboard_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_teachers_today jsonb := '[]'::jsonb;
  v_exams_per_day jsonb := '[]'::jsonb;
  v_today_start timestamptz := date_trunc('day', now());
  v_today_end timestamptz := v_today_start + interval '1 day' - interval '1 microsecond';
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Teachers with at least one exam active today (by schedule window)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', row_key,
        'label', row_label,
        'value', row_value
      )
      ORDER BY row_value DESC, row_label
    ),
    '[]'::jsonb
  )
  INTO v_teachers_today
  FROM (
    SELECT
      COALESCE(u.id::text, s.teacher_school_id, 'unknown') AS row_key,
      COALESCE(
        NULLIF(trim(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''),
        u.school_id,
        'Unassigned faculty'
      ) AS row_label,
      count(DISTINCT e.id)::bigint AS row_value
    FROM public.exams e
    JOIN public.subjects s ON s.id = e.subject_id
    LEFT JOIN public.users u
      ON u.school_id = s.teacher_school_id
      AND u.role ILIKE 'faculty'
    WHERE e.start_datetime IS NOT NULL
      AND e.end_datetime IS NOT NULL
      AND e.start_datetime <= v_today_end
      AND e.end_datetime >= v_today_start
    GROUP BY u.id, u.first_name, u.last_name, u.school_id, s.teacher_school_id
    ORDER BY row_value DESC, row_label
    LIMIT 12
  ) teachers;

  -- Exams scheduled to start on each of the last 14 days
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', day_key,
        'label', day_label,
        'value', day_value
      )
      ORDER BY day_key
    ),
    '[]'::jsonb
  )
  INTO v_exams_per_day
  FROM (
    SELECT
      d.day::text AS day_key,
      to_char(d.day, 'Mon DD') AS day_label,
      count(e.id)::bigint AS day_value
    FROM generate_series(
      (CURRENT_DATE - interval '13 days')::date,
      CURRENT_DATE::date,
      interval '1 day'
    ) AS d(day)
    LEFT JOIN public.exams e
      ON e.start_datetime IS NOT NULL
      AND e.start_datetime::date = d.day
    GROUP BY d.day
    ORDER BY d.day
  ) days;

  RETURN jsonb_build_object(
    'teachers_active_today', v_teachers_today,
    'exams_per_day', v_exams_per_day,
    'teachers_active_today_total', (
      SELECT count(DISTINCT s.teacher_school_id)
      FROM public.exams e
      JOIN public.subjects s ON s.id = e.subject_id
      WHERE e.start_datetime IS NOT NULL
        AND e.end_datetime IS NOT NULL
        AND e.start_datetime <= v_today_end
        AND e.end_datetime >= v_today_start
        AND s.teacher_school_id IS NOT NULL
    ),
    'exams_today', (
      SELECT count(*)
      FROM public.exams e
      WHERE e.start_datetime IS NOT NULL
        AND e.start_datetime::date = CURRENT_DATE
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_analytics() TO authenticated;
