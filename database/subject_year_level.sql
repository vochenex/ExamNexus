-- Add year level to subjects for filtering and display (1st–4th year only)
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS year_level text NOT NULL DEFAULT '1st_year';

COMMENT ON COLUMN public.subjects.year_level IS
  'Target year level for the subject: 1st_year, 2nd_year, 3rd_year, or 4th_year.';

-- Migrate legacy grade levels if present
UPDATE public.subjects
SET year_level = '1st_year'
WHERE year_level IS NULL
   OR year_level IN (
     'grade_7', 'grade_8', 'grade_9', 'grade_10', 'grade_11', 'grade_12'
   );

ALTER TABLE public.subjects
  ALTER COLUMN year_level SET DEFAULT '1st_year';

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_year_level_check;

ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_year_level_check
  CHECK (
    year_level IN ('1st_year', '2nd_year', '3rd_year', '4th_year')
  );

-- Include year_level in student enrolled subjects RPC
CREATE OR REPLACE FUNCTION public.get_student_enrolled_subjects()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', row.id,
        'name', row.name,
        'invite_code', row.invite_code,
        'teacher_school_id', row.teacher_school_id,
        'year_level', row.year_level,
        'faculty_first_name', row.faculty_first_name,
        'faculty_last_name', row.faculty_last_name,
        'faculty_avatar_url', row.faculty_avatar_url
      )
      ORDER BY row.name
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT DISTINCT ON (s.id)
      s.id,
      s.name,
      s.invite_code,
      s.teacher_school_id,
      COALESCE(s.year_level, '1st_year') AS year_level,
      u.first_name AS faculty_first_name,
      u.last_name AS faculty_last_name,
      u.avatar_url AS faculty_avatar_url
    FROM public.subject_students ss
    JOIN public.subjects s ON s.id = ss.subject_id
    LEFT JOIN LATERAL (
      SELECT first_name, last_name, avatar_url
      FROM public.users
      WHERE school_id = s.teacher_school_id
        AND role ILIKE 'faculty'
      LIMIT 1
    ) u ON true
    WHERE ss.student_id = auth.uid()
    ORDER BY s.id, ss.ctid
  ) row;
$$;

REVOKE ALL ON FUNCTION public.get_student_enrolled_subjects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_enrolled_subjects() TO authenticated;
