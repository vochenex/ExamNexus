-- Run once in Supabase Dashboard → SQL Editor (paste the WHOLE file, then Run).
-- Role check for faculty writes: creating / editing / deleting subjects, exams and
-- questions now also requires an approved faculty account, not just matching
-- teacher_school_id. Admin access is unchanged (subjects_admin_all, exams_admin_write).
-- Read (SELECT) policies are not touched, so students still see their enrolled subjects.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_approved_faculty()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND lower(trim(role)) = 'faculty'
      -- Legacy rows with no status count as approved (same as backend requireFaculty).
      AND lower(coalesce(nullif(trim(account_status), ''), 'approved')) = 'approved'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_approved_faculty() TO authenticated;

-- ========== SUBJECTS ==========
DROP POLICY IF EXISTS subjects_insert_faculty ON public.subjects;
CREATE POLICY subjects_insert_faculty ON public.subjects
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_approved_faculty()
    AND teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS subjects_update_faculty ON public.subjects;
CREATE POLICY subjects_update_faculty ON public.subjects
  FOR UPDATE TO authenticated
  USING (
    public.is_approved_faculty()
    AND teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
  )
  WITH CHECK (
    public.is_approved_faculty()
    AND teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS subjects_delete_faculty ON public.subjects;
CREATE POLICY subjects_delete_faculty ON public.subjects
  FOR DELETE TO authenticated
  USING (
    public.is_approved_faculty()
    AND teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
  );

-- ========== EXAMS ==========
DROP POLICY IF EXISTS exams_insert_faculty ON public.exams;
CREATE POLICY exams_insert_faculty ON public.exams
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_approved_faculty()
    AND EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = exams.subject_id
        AND s.teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS exams_update_faculty ON public.exams;
CREATE POLICY exams_update_faculty ON public.exams
  FOR UPDATE TO authenticated
  USING (
    public.is_approved_faculty()
    AND EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = exams.subject_id
        AND s.teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_approved_faculty()
    AND EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = exams.subject_id
        AND s.teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS exams_delete_faculty ON public.exams;
CREATE POLICY exams_delete_faculty ON public.exams
  FOR DELETE TO authenticated
  USING (
    public.is_approved_faculty()
    AND EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = exams.subject_id
        AND s.teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
    )
  );

-- ========== QUESTIONS ==========
DROP POLICY IF EXISTS questions_insert_faculty ON public.questions;
CREATE POLICY questions_insert_faculty ON public.questions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_approved_faculty()
    AND EXISTS (
      SELECT 1 FROM public.exams e
      JOIN public.subjects s ON s.id = e.subject_id
      WHERE e.id = questions.exam_id
        AND s.teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS questions_update_faculty ON public.questions;
CREATE POLICY questions_update_faculty ON public.questions
  FOR UPDATE TO authenticated
  USING (
    public.is_approved_faculty()
    AND EXISTS (
      SELECT 1 FROM public.exams e
      JOIN public.subjects s ON s.id = e.subject_id
      WHERE e.id = questions.exam_id
        AND s.teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_approved_faculty()
    AND EXISTS (
      SELECT 1 FROM public.exams e
      JOIN public.subjects s ON s.id = e.subject_id
      WHERE e.id = questions.exam_id
        AND s.teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS questions_delete_faculty ON public.questions;
CREATE POLICY questions_delete_faculty ON public.questions
  FOR DELETE TO authenticated
  USING (
    public.is_approved_faculty()
    AND EXISTS (
      SELECT 1 FROM public.exams e
      JOIN public.subjects s ON s.id = e.subject_id
      WHERE e.id = questions.exam_id
        AND s.teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Optional check afterwards: every write policy on these tables. Any row here that
-- is NOT *_faculty or *_admin_* is another rule that could still allow writes.
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('subjects', 'exams', 'questions')
--   AND cmd <> 'SELECT'
-- ORDER BY tablename, policyname;
