-- Unique invitation code per section within a subject.
-- Run in Supabase Dashboard → SQL Editor after subject_sections_extended.sql
--
-- Existing enrollments stay on subject_students.section (A–L).
-- Section A reuses the legacy subjects.invite_code when possible so enrolled
-- students keep working; additional sections get new unique codes.
-- Looking up any section code enrolls the student into that section only.

CREATE TABLE IF NOT EXISTS public.subject_section_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  section text NOT NULL CHECK (section ~ '^[A-L]$'),
  invite_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subject_section_invites_subject_section_key UNIQUE (subject_id, section),
  CONSTRAINT subject_section_invites_invite_code_key UNIQUE (invite_code)
);

CREATE INDEX IF NOT EXISTS subject_section_invites_subject_id_idx
  ON public.subject_section_invites (subject_id);

CREATE INDEX IF NOT EXISTS subject_section_invites_invite_code_idx
  ON public.subject_section_invites (invite_code);

COMMENT ON TABLE public.subject_section_invites IS
  'One unique invite code per class section of a subject. Codes are globally unique.';

ALTER TABLE public.subject_section_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subject_section_invites_select_visible ON public.subject_section_invites;
CREATE POLICY subject_section_invites_select_visible
  ON public.subject_section_invites
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.subjects s
      WHERE s.id = subject_section_invites.subject_id
        AND (
          s.teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.subject_students ss
            WHERE ss.subject_id = s.id
              AND ss.student_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND lower(coalesce(u.role, '')) IN ('admin', 'super_admin', 'superadmin')
          )
        )
    )
  );

DROP POLICY IF EXISTS subject_section_invites_manage_faculty ON public.subject_section_invites;
CREATE POLICY subject_section_invites_manage_faculty
  ON public.subject_section_invites
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.subjects s
      WHERE s.id = subject_section_invites.subject_id
        AND (
          s.teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND lower(coalesce(u.role, '')) IN ('admin', 'super_admin', 'superadmin')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.subjects s
      WHERE s.id = subject_section_invites.subject_id
        AND (
          s.teacher_school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND lower(coalesce(u.role, '')) IN ('admin', 'super_admin', 'superadmin')
          )
        )
    )
  );

CREATE OR REPLACE FUNCTION public.generate_subject_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text;
  v_tries integer := 0;
BEGIN
  LOOP
    -- 8 hex chars; gen_random_uuid() is built into Postgres 13+ (no pgcrypto needed)
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    v_tries := v_tries + 1;

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.subject_section_invites WHERE invite_code = v_code
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.subjects WHERE invite_code = v_code
    );

    IF v_tries > 40 THEN
      RAISE EXCEPTION 'Could not generate a unique invitation code';
    END IF;
  END LOOP;

  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_subject_section_invites(p_subject_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject public.subjects%ROWTYPE;
  v_max integer;
  v_idx integer;
  v_section text;
  v_code text;
  v_legacy text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_subject
  FROM public.subjects
  WHERE id = p_subject_id;

  IF v_subject.id IS NULL THEN
    RAISE EXCEPTION 'Subject not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND (
        u.school_id = v_subject.teacher_school_id
        OR lower(coalesce(u.role, '')) IN ('admin', 'super_admin', 'superadmin')
      )
  ) THEN
    RAISE EXCEPTION 'Not allowed to manage invitation codes for this subject';
  END IF;

  v_max := GREATEST(1, LEAST(12, COALESCE(v_subject.section_count, 3)));
  v_legacy := lower(trim(coalesce(v_subject.invite_code, '')));

  FOR v_idx IN 1..v_max LOOP
    v_section := chr(64 + v_idx);

    IF EXISTS (
      SELECT 1
      FROM public.subject_section_invites
      WHERE subject_id = p_subject_id
        AND section = v_section
    ) THEN
      CONTINUE;
    END IF;

    v_code := NULL;

    IF v_idx = 1
      AND v_legacy <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM public.subject_section_invites
        WHERE invite_code = v_legacy
      )
    THEN
      v_code := v_legacy;
    ELSE
      v_code := public.generate_subject_invite_code();
    END IF;

    INSERT INTO public.subject_section_invites (subject_id, section, invite_code)
    VALUES (p_subject_id, v_section, v_code)
    ON CONFLICT (subject_id, section) DO NOTHING;
  END LOOP;

  -- Keep subjects.invite_code aligned with Section A for legacy readers.
  SELECT invite_code INTO v_code
  FROM public.subject_section_invites
  WHERE subject_id = p_subject_id
    AND section = 'A'
  LIMIT 1;

  IF v_code IS NOT NULL AND coalesce(v_subject.invite_code, '') IS DISTINCT FROM v_code THEN
    UPDATE public.subjects
    SET invite_code = v_code
    WHERE id = p_subject_id;
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'section', i.section,
          'invite_code', i.invite_code
        )
        ORDER BY i.section
      )
      FROM public.subject_section_invites i
      WHERE i.subject_id = p_subject_id
        AND (ascii(i.section) - 64) <= v_max
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_all_subject_section_invites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject record;
  v_count integer := 0;
  v_max integer;
  v_idx integer;
  v_section text;
  v_code text;
  v_legacy text;
BEGIN
  FOR v_subject IN
    SELECT id, invite_code, section_count
    FROM public.subjects
  LOOP
    v_max := GREATEST(1, LEAST(12, COALESCE(v_subject.section_count, 3)));
    v_legacy := lower(trim(coalesce(v_subject.invite_code, '')));

    FOR v_idx IN 1..v_max LOOP
      v_section := chr(64 + v_idx);

      IF EXISTS (
        SELECT 1
        FROM public.subject_section_invites
        WHERE subject_id = v_subject.id
          AND section = v_section
      ) THEN
        CONTINUE;
      END IF;

      IF v_idx = 1
        AND v_legacy <> ''
        AND NOT EXISTS (
          SELECT 1 FROM public.subject_section_invites WHERE invite_code = v_legacy
        )
      THEN
        v_code := v_legacy;
      ELSE
        v_code := public.generate_subject_invite_code();
      END IF;

      INSERT INTO public.subject_section_invites (subject_id, section, invite_code)
      VALUES (v_subject.id, v_section, v_code)
      ON CONFLICT (subject_id, section) DO NOTHING;
    END LOOP;

    SELECT invite_code INTO v_code
    FROM public.subject_section_invites
    WHERE subject_id = v_subject.id
      AND section = 'A'
    LIMIT 1;

    IF v_code IS NOT NULL THEN
      UPDATE public.subjects
      SET invite_code = v_code
      WHERE id = v_subject.id
        AND coalesce(invite_code, '') IS DISTINCT FROM v_code;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Backfill every existing subject (preserves Section A = legacy invite_code).
SELECT public.ensure_all_subject_section_invites();

CREATE OR REPLACE FUNCTION public.lookup_subject_by_invite_code(p_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_code text := lower(trim(coalesce(p_invite_code, '')));
  v_invite public.subject_section_invites%ROWTYPE;
  v_subject public.subjects%ROWTYPE;
  v_section text;
  v_max integer;
BEGIN
  IF v_code = '' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_invite
  FROM public.subject_section_invites
  WHERE invite_code = v_code
  LIMIT 1;

  IF v_invite.id IS NOT NULL THEN
    SELECT * INTO v_subject FROM public.subjects WHERE id = v_invite.subject_id;
    v_section := v_invite.section;
  ELSE
    SELECT * INTO v_subject
    FROM public.subjects
    WHERE invite_code = v_code
    LIMIT 1;

    IF v_subject.id IS NULL THEN
      RETURN NULL;
    END IF;

    v_section := 'A';
  END IF;

  IF v_subject.id IS NULL THEN
    RETURN NULL;
  END IF;

  v_max := GREATEST(1, LEAST(12, COALESCE(v_subject.section_count, 3)));

  RETURN jsonb_build_object(
    'id', v_subject.id,
    'name', v_subject.name,
    'invite_code', v_code,
    'teacher_school_id', v_subject.teacher_school_id,
    'section_count', v_max,
    'section', v_section,
    'year_level', COALESCE(v_subject.year_level, '1st_year')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.enroll_student_by_invite_code(
  p_invite_code text,
  p_section text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid := auth.uid();
  v_lookup jsonb;
  v_subject_id uuid;
  v_section text;
  v_max_sections integer;
  v_section_index integer;
  v_name text;
  v_teacher text;
  v_code text;
BEGIN
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_lookup := public.lookup_subject_by_invite_code(p_invite_code);

  IF v_lookup IS NULL THEN
    RAISE EXCEPTION 'Invalid invitation code';
  END IF;

  v_subject_id := (v_lookup->>'id')::uuid;
  v_name := v_lookup->>'name';
  v_teacher := v_lookup->>'teacher_school_id';
  v_code := v_lookup->>'invite_code';
  v_max_sections := GREATEST(1, LEAST(12, COALESCE((v_lookup->>'section_count')::integer, 3)));

  -- Section is determined by the invite code (per-section codes).
  v_section := upper(trim(coalesce(v_lookup->>'section', 'A')));

  IF v_section !~ '^[A-L]$' THEN
    RAISE EXCEPTION 'Section must be a letter from A to L';
  END IF;

  v_section_index := ascii(v_section) - 64;
  IF v_section_index > v_max_sections THEN
    RAISE EXCEPTION 'Section % is not available for this subject (only % section(s))', v_section, v_max_sections;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.subject_students
    WHERE student_id = v_student_id
      AND subject_id = v_subject_id
  ) THEN
    RAISE EXCEPTION 'Already enrolled in %', v_name;
  END IF;

  BEGIN
    INSERT INTO public.subject_students (student_id, subject_id, section)
    VALUES (v_student_id, v_subject_id, v_section);
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Already enrolled in %', v_name;
  END;

  RETURN jsonb_build_object(
    'id', v_subject_id,
    'name', v_name,
    'invite_code', v_code,
    'teacher_school_id', v_teacher,
    'section', v_section,
    'section_count', v_max_sections
  );
END;
$$;

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
        'section', row.section,
        'section_count', row.section_count,
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
      COALESCE(ssi.invite_code, s.invite_code) AS invite_code,
      s.teacher_school_id,
      COALESCE(s.year_level, '1st_year') AS year_level,
      COALESCE(ss.section, 'A') AS section,
      GREATEST(1, LEAST(12, COALESCE(s.section_count, 3))) AS section_count,
      u.first_name AS faculty_first_name,
      u.last_name AS faculty_last_name,
      u.avatar_url AS faculty_avatar_url
    FROM public.subject_students ss
    JOIN public.subjects s ON s.id = ss.subject_id
    LEFT JOIN public.subject_section_invites ssi
      ON ssi.subject_id = s.id
     AND ssi.section = COALESCE(ss.section, 'A')
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

CREATE OR REPLACE FUNCTION public.subjects_ensure_section_invites_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max integer;
  v_idx integer;
  v_section text;
  v_code text;
  v_legacy text;
BEGIN
  v_max := GREATEST(1, LEAST(12, COALESCE(NEW.section_count, 3)));
  v_legacy := lower(trim(coalesce(NEW.invite_code, '')));

  FOR v_idx IN 1..v_max LOOP
    v_section := chr(64 + v_idx);

    IF EXISTS (
      SELECT 1
      FROM public.subject_section_invites
      WHERE subject_id = NEW.id
        AND section = v_section
    ) THEN
      CONTINUE;
    END IF;

    IF v_idx = 1
      AND v_legacy <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.subject_section_invites WHERE invite_code = v_legacy
      )
    THEN
      v_code := v_legacy;
    ELSE
      v_code := public.generate_subject_invite_code();
    END IF;

    INSERT INTO public.subject_section_invites (subject_id, section, invite_code)
    VALUES (NEW.id, v_section, v_code)
    ON CONFLICT (subject_id, section) DO NOTHING;
  END LOOP;

  SELECT invite_code INTO v_code
  FROM public.subject_section_invites
  WHERE subject_id = NEW.id
    AND section = 'A'
  LIMIT 1;

  IF v_code IS NOT NULL AND coalesce(NEW.invite_code, '') IS DISTINCT FROM v_code THEN
    UPDATE public.subjects
    SET invite_code = v_code
    WHERE id = NEW.id
      AND coalesce(invite_code, '') IS DISTINCT FROM v_code;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subjects_ensure_section_invites ON public.subjects;
CREATE TRIGGER subjects_ensure_section_invites
  AFTER INSERT OR UPDATE OF section_count, invite_code
  ON public.subjects
  FOR EACH ROW
  EXECUTE FUNCTION public.subjects_ensure_section_invites_trigger();

REVOKE ALL ON FUNCTION public.ensure_subject_section_invites(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_subject_section_invites(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.lookup_subject_by_invite_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_subject_by_invite_code(text) TO authenticated;

REVOKE ALL ON FUNCTION public.enroll_student_by_invite_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enroll_student_by_invite_code(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_student_enrolled_subjects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_enrolled_subjects() TO authenticated;

-- ensure_all is for migrations / admin SQL only
REVOKE ALL ON FUNCTION public.ensure_all_subject_section_invites() FROM PUBLIC;

NOTIFY pgrst, 'reload schema';
