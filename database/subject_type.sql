-- Major vs minor subject classification for grade weighting
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS subject_type text NOT NULL DEFAULT 'major';

COMMENT ON COLUMN public.subjects.subject_type IS
  'major = 60% exams / 30% class standing / 10% attendance; minor = 70% / 20% / 10%.';

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_subject_type_check;

ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_subject_type_check
  CHECK (subject_type IN ('major', 'minor'));

-- Include subject_type in student enrolled subjects RPC
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
        'subject_type', row.subject_type,
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
      COALESCE(s.subject_type, 'major') AS subject_type,
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

NOTIFY pgrst, 'reload schema';
