-- Enrich invite-code lookup with assigned faculty name for enroll preview.
-- Safe to re-run.

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
  v_faculty public.users%ROWTYPE;
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

  IF NULLIF(trim(COALESCE(v_subject.teacher_school_id, '')), '') IS NOT NULL THEN
    SELECT * INTO v_faculty
    FROM public.users
    WHERE school_id = v_subject.teacher_school_id
      AND lower(COALESCE(role, '')) = 'faculty'
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'id', v_subject.id,
    'name', v_subject.name,
    'invite_code', v_code,
    'teacher_school_id', v_subject.teacher_school_id,
    'section_count', v_max,
    'section', v_section,
    'year_level', COALESCE(v_subject.year_level, '1st_year'),
    'faculty_first_name', v_faculty.first_name,
    'faculty_last_name', v_faculty.last_name,
    'faculty_avatar_url', v_faculty.avatar_url,
    'faculty_name', NULLIF(
      trim(
        concat_ws(
          ' ',
          NULLIF(trim(COALESCE(v_faculty.first_name, '')), ''),
          NULLIF(trim(COALESCE(v_faculty.last_name, '')), '')
        )
      ),
      ''
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_subject_by_invite_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_subject_by_invite_code(text) TO authenticated;
