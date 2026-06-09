-- Run once in Supabase Dashboard → SQL Editor
-- Allows authenticated faculty/students to read and write their own data via the frontend client

-- ========== USERS ==========
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_select_own'
  ) THEN
    CREATE POLICY users_select_own ON public.users
      FOR SELECT TO authenticated
      USING (id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_update_own'
  ) THEN
    CREATE POLICY users_update_own ON public.users
      FOR UPDATE TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- ========== SUBJECTS ==========
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subjects' AND policyname = 'subjects_select_visible'
  ) THEN
    CREATE POLICY subjects_select_visible ON public.subjects
      FOR SELECT TO authenticated
      USING (
        teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.subject_students ss
          WHERE ss.subject_id = subjects.id AND ss.student_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subjects' AND policyname = 'subjects_insert_faculty'
  ) THEN
    CREATE POLICY subjects_insert_faculty ON public.subjects
      FOR INSERT TO authenticated
      WITH CHECK (
        teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subjects' AND policyname = 'subjects_update_faculty'
  ) THEN
    CREATE POLICY subjects_update_faculty ON public.subjects
      FOR UPDATE TO authenticated
      USING (
        teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
      )
      WITH CHECK (
        teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subjects' AND policyname = 'subjects_delete_faculty'
  ) THEN
    CREATE POLICY subjects_delete_faculty ON public.subjects
      FOR DELETE TO authenticated
      USING (
        teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
      );
  END IF;
END $$;

-- ========== EXAMS ==========
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exams' AND policyname = 'exams_select_visible'
  ) THEN
    CREATE POLICY exams_select_visible ON public.exams
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.subjects s
          WHERE s.id = exams.subject_id
            AND (
              s.teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
              OR EXISTS (
                SELECT 1 FROM public.subject_students ss
                WHERE ss.subject_id = s.id AND ss.student_id = auth.uid()
              )
            )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exams' AND policyname = 'exams_insert_faculty'
  ) THEN
    CREATE POLICY exams_insert_faculty ON public.exams
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.subjects s
          WHERE s.id = exams.subject_id
            AND s.teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exams' AND policyname = 'exams_update_faculty'
  ) THEN
    CREATE POLICY exams_update_faculty ON public.exams
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.subjects s
          WHERE s.id = exams.subject_id
            AND s.teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.subjects s
          WHERE s.id = exams.subject_id
            AND s.teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exams' AND policyname = 'exams_delete_faculty'
  ) THEN
    CREATE POLICY exams_delete_faculty ON public.exams
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.subjects s
          WHERE s.id = exams.subject_id
            AND s.teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
        )
      );
  END IF;
END $$;

-- ========== QUESTIONS ==========
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'questions' AND policyname = 'questions_select_visible'
  ) THEN
    CREATE POLICY questions_select_visible ON public.questions
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.exams e
          JOIN public.subjects s ON s.id = e.subject_id
          WHERE e.id = questions.exam_id
            AND (
              s.teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
              OR EXISTS (
                SELECT 1 FROM public.subject_students ss
                WHERE ss.subject_id = s.id AND ss.student_id = auth.uid()
              )
            )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'questions' AND policyname = 'questions_insert_faculty'
  ) THEN
    CREATE POLICY questions_insert_faculty ON public.questions
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.exams e
          JOIN public.subjects s ON s.id = e.subject_id
          WHERE e.id = questions.exam_id
            AND s.teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'questions' AND policyname = 'questions_update_faculty'
  ) THEN
    CREATE POLICY questions_update_faculty ON public.questions
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.exams e
          JOIN public.subjects s ON s.id = e.subject_id
          WHERE e.id = questions.exam_id
            AND s.teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.exams e
          JOIN public.subjects s ON s.id = e.subject_id
          WHERE e.id = questions.exam_id
            AND s.teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'questions' AND policyname = 'questions_delete_faculty'
  ) THEN
    CREATE POLICY questions_delete_faculty ON public.questions
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.exams e
          JOIN public.subjects s ON s.id = e.subject_id
          WHERE e.id = questions.exam_id
            AND s.teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
        )
      );
  END IF;
END $$;
