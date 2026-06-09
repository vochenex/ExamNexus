-- Run in Supabase Dashboard → SQL Editor
-- Section-targeted assessments + subject announcements

-- ============================================================
-- EXAMS: which sections can take each assessment
-- ============================================================
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS target_sections text[] NOT NULL DEFAULT '{A,B,C}';

UPDATE public.exams
SET target_sections = '{A,B,C}'
WHERE target_sections IS NULL OR cardinality(target_sections) = 0;

ALTER TABLE public.exams
  DROP CONSTRAINT IF EXISTS exams_target_sections_check;

ALTER TABLE public.exams
  ADD CONSTRAINT exams_target_sections_check
  CHECK (
    target_sections <@ ARRAY['A', 'B', 'C']::text[]
    AND cardinality(target_sections) >= 1
  );

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  target_sections text[] NOT NULL DEFAULT '{A,B,C}',
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_target_sections_check;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_target_sections_check
  CHECK (
    target_sections <@ ARRAY['A', 'B', 'C']::text[]
    AND cardinality(target_sections) >= 1
  );

CREATE INDEX IF NOT EXISTS announcements_subject_created_idx
  ON public.announcements (subject_id, created_at DESC);

-- ============================================================
-- HELPERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_teaches_subject(p_subject_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subjects s
    JOIN public.users u ON u.id = auth.uid()
    WHERE s.id = p_subject_id
      AND u.school_id = s.teacher_school_id
      AND u.role ILIKE 'faculty'
  );
$$;

CREATE OR REPLACE FUNCTION public.student_section_for_subject(p_subject_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT upper(coalesce(nullif(trim(ss.section), ''), 'A'))
  FROM public.subject_students ss
  WHERE ss.subject_id = p_subject_id
    AND ss.student_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.sections_overlap(
  p_student_section text,
  p_target_sections text[]
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(coalesce(nullif(trim(p_student_section), ''), 'A')) = ANY (
    SELECT upper(s)
    FROM unnest(coalesce(p_target_sections, ARRAY['A', 'B', 'C']::text[])) AS s
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_teaches_subject(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_section_for_subject(uuid) TO authenticated;

-- ============================================================
-- RLS: announcements
-- ============================================================
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcements_select_visible ON public.announcements;
DROP POLICY IF EXISTS announcements_insert_faculty ON public.announcements;
DROP POLICY IF EXISTS announcements_update_faculty ON public.announcements;
DROP POLICY IF EXISTS announcements_delete_faculty ON public.announcements;

CREATE POLICY announcements_select_visible ON public.announcements
  FOR SELECT TO authenticated
  USING (
    public.user_teaches_subject(subject_id)
    OR (
      public.student_section_for_subject(subject_id) IS NOT NULL
      AND public.sections_overlap(
        public.student_section_for_subject(subject_id),
        target_sections
      )
    )
  );

CREATE POLICY announcements_insert_faculty ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (public.user_teaches_subject(subject_id));

CREATE POLICY announcements_update_faculty ON public.announcements
  FOR UPDATE TO authenticated
  USING (public.user_teaches_subject(subject_id))
  WITH CHECK (public.user_teaches_subject(subject_id));

CREATE POLICY announcements_delete_faculty ON public.announcements
  FOR DELETE TO authenticated
  USING (public.user_teaches_subject(subject_id));

-- ============================================================
-- RPC: announcements for a subject (ordered newest first)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_subject_announcements(p_subject_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_teaches_subject(p_subject_id)
     AND public.student_section_for_subject(p_subject_id) IS NULL THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'subject_id', a.subject_id,
        'title', a.title,
        'body', a.body,
        'target_sections', a.target_sections,
        'created_by', a.created_by,
        'created_at', a.created_at,
        'author_first_name', u.first_name,
        'author_last_name', u.last_name,
        'author_avatar_url', u.avatar_url
      )
      ORDER BY a.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM public.announcements a
  LEFT JOIN public.users u ON u.id = a.created_by
  WHERE a.subject_id = p_subject_id
    AND (
      public.user_teaches_subject(p_subject_id)
      OR public.sections_overlap(
        public.student_section_for_subject(p_subject_id),
        a.target_sections
      )
    );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_subject_announcements(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_subject_announcements(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
