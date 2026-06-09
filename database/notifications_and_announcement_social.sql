-- Run in Supabase Dashboard → SQL Editor
-- Notifications feed + announcement comments & heart reactions

-- ============================================================
-- COMMENTS & REACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.announcement_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.announcement_reactions (
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reaction_type text NOT NULL DEFAULT 'heart',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS announcement_comments_announcement_idx
  ON public.announcement_comments (announcement_id, created_at ASC);

-- ============================================================
-- RLS: comments
-- ============================================================
ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcement_comments_select ON public.announcement_comments;
DROP POLICY IF EXISTS announcement_comments_insert ON public.announcement_comments;
DROP POLICY IF EXISTS announcement_comments_delete_own ON public.announcement_comments;

CREATE POLICY announcement_comments_select ON public.announcement_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_comments.announcement_id
        AND (
          public.user_teaches_subject(a.subject_id)
          OR (
            public.student_section_for_subject(a.subject_id) IS NOT NULL
            AND public.sections_overlap(
              public.student_section_for_subject(a.subject_id),
              a.target_sections
            )
          )
        )
    )
  );

CREATE POLICY announcement_comments_insert ON public.announcement_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_comments.announcement_id
        AND (
          public.user_teaches_subject(a.subject_id)
          OR (
            public.student_section_for_subject(a.subject_id) IS NOT NULL
            AND public.sections_overlap(
              public.student_section_for_subject(a.subject_id),
              a.target_sections
            )
          )
        )
    )
  );

CREATE POLICY announcement_comments_delete_own ON public.announcement_comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- RLS: reactions
-- ============================================================
ALTER TABLE public.announcement_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcement_reactions_select ON public.announcement_reactions;
DROP POLICY IF EXISTS announcement_reactions_insert ON public.announcement_reactions;
DROP POLICY IF EXISTS announcement_reactions_delete_own ON public.announcement_reactions;

CREATE POLICY announcement_reactions_select ON public.announcement_reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_reactions.announcement_id
        AND (
          public.user_teaches_subject(a.subject_id)
          OR (
            public.student_section_for_subject(a.subject_id) IS NOT NULL
            AND public.sections_overlap(
              public.student_section_for_subject(a.subject_id),
              a.target_sections
            )
          )
        )
    )
  );

CREATE POLICY announcement_reactions_insert ON public.announcement_reactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY announcement_reactions_delete_own ON public.announcement_reactions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- RPC: enriched announcements (hearts + comment counts)
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
        'author_avatar_url', u.avatar_url,
        'heart_count', (
          SELECT count(*)::int FROM public.announcement_reactions r
          WHERE r.announcement_id = a.id
        ),
        'comment_count', (
          SELECT count(*)::int FROM public.announcement_comments c
          WHERE c.announcement_id = a.id
        ),
        'user_reacted', EXISTS (
          SELECT 1 FROM public.announcement_reactions r
          WHERE r.announcement_id = a.id AND r.user_id = auth.uid()
        )
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

GRANT EXECUTE ON FUNCTION public.get_subject_announcements(uuid) TO authenticated;

-- ============================================================
-- RPC: comments for an announcement
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_announcement_comments(p_announcement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_subject_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT subject_id INTO v_subject_id
  FROM public.announcements
  WHERE id = p_announcement_id;

  IF v_subject_id IS NULL THEN
    RAISE EXCEPTION 'Announcement not found';
  END IF;

  IF NOT public.user_teaches_subject(v_subject_id)
     AND public.student_section_for_subject(v_subject_id) IS NULL THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'body', c.body,
          'created_at', c.created_at,
          'user_id', c.user_id,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'avatar_url', u.avatar_url
        )
        ORDER BY c.created_at ASC
      )
      FROM public.announcement_comments c
      LEFT JOIN public.users u ON u.id = c.user_id
      WHERE c.announcement_id = p_announcement_id
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_announcement_comments(uuid) TO authenticated;

-- ============================================================
-- RPC: toggle heart reaction
-- ============================================================
CREATE OR REPLACE FUNCTION public.toggle_announcement_reaction(p_announcement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject_id uuid;
  v_target_sections text[];
  v_reacted boolean;
  v_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT subject_id, target_sections
  INTO v_subject_id, v_target_sections
  FROM public.announcements
  WHERE id = p_announcement_id;

  IF v_subject_id IS NULL THEN
    RAISE EXCEPTION 'Announcement not found';
  END IF;

  IF NOT public.user_teaches_subject(v_subject_id)
     AND NOT (
       public.student_section_for_subject(v_subject_id) IS NOT NULL
       AND public.sections_overlap(
         public.student_section_for_subject(v_subject_id),
         v_target_sections
       )
     ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.announcement_reactions
    WHERE announcement_id = p_announcement_id AND user_id = auth.uid()
  ) THEN
    DELETE FROM public.announcement_reactions
    WHERE announcement_id = p_announcement_id AND user_id = auth.uid();
    v_reacted := false;
  ELSE
    INSERT INTO public.announcement_reactions (announcement_id, user_id)
    VALUES (p_announcement_id, auth.uid());
    v_reacted := true;
  END IF;

  SELECT count(*)::int INTO v_count
  FROM public.announcement_reactions
  WHERE announcement_id = p_announcement_id;

  RETURN jsonb_build_object('user_reacted', v_reacted, 'heart_count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_announcement_reaction(uuid) TO authenticated;

-- ============================================================
-- RPC: post comment
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_announcement_comment(
  p_announcement_id uuid,
  p_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.announcement_comments%ROWTYPE;
  v_user public.users%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NULLIF(trim(p_body), '') IS NULL THEN
    RAISE EXCEPTION 'Comment cannot be empty';
  END IF;

  INSERT INTO public.announcement_comments (announcement_id, user_id, body)
  VALUES (p_announcement_id, auth.uid(), trim(p_body))
  RETURNING * INTO v_row;

  SELECT * INTO v_user FROM public.users WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'id', v_row.id,
    'body', v_row.body,
    'created_at', v_row.created_at,
    'user_id', v_row.user_id,
    'first_name', v_user.first_name,
    'last_name', v_user.last_name,
    'avatar_url', v_user.avatar_url
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_announcement_comment(uuid, text) TO authenticated;

-- ============================================================
-- RPC: faculty bulk announcements (all or selected subjects)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_faculty_announcements(
  p_subject_ids uuid[],
  p_title text,
  p_body text,
  p_target_sections text[] DEFAULT ARRAY['A','B','C']
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject_id uuid;
  v_created jsonb := '[]'::jsonb;
  v_row public.announcements%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NULLIF(trim(p_title), '') IS NULL THEN
    RAISE EXCEPTION 'Title is required';
  END IF;

  IF p_subject_ids IS NULL OR cardinality(p_subject_ids) = 0 THEN
    SELECT array_agg(s.id)
    INTO p_subject_ids
    FROM public.subjects s
    JOIN public.users u ON u.id = auth.uid()
    WHERE u.school_id = s.teacher_school_id
      AND u.role ILIKE 'faculty';
  END IF;

  IF p_subject_ids IS NULL OR cardinality(p_subject_ids) = 0 THEN
    RAISE EXCEPTION 'No subjects found';
  END IF;

  FOREACH v_subject_id IN ARRAY p_subject_ids LOOP
    IF NOT public.user_teaches_subject(v_subject_id) THEN
      RAISE EXCEPTION 'Access denied for subject %', v_subject_id;
    END IF;

    INSERT INTO public.announcements (
      subject_id, title, body, target_sections, created_by
    )
    VALUES (
      v_subject_id,
      trim(p_title),
      coalesce(trim(p_body), ''),
      p_target_sections,
      auth.uid()
    )
    RETURNING * INTO v_row;

    v_created := v_created || jsonb_build_array(to_jsonb(v_row));
  END LOOP;

  RETURN v_created;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_faculty_announcements(uuid[], text, text, text[]) TO authenticated;

-- ============================================================
-- RPC: notification feed (announcements + assessments)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_notifications(p_limit int DEFAULT 40)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_is_faculty boolean;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role ILIKE 'faculty' INTO v_is_faculty
  FROM public.users WHERE id = auth.uid();

  IF coalesce(v_is_faculty, false) THEN
    SELECT COALESCE(
      jsonb_agg(item ORDER BY (item->>'created_at') DESC),
      '[]'::jsonb
    )
    INTO v_result
    FROM (
      SELECT jsonb_build_object(
        'kind', 'announcement',
        'id', a.id,
        'title', a.title,
        'body', left(a.body, 120),
        'created_at', a.created_at,
        'subject_id', a.subject_id,
        'subject_name', s.name,
        'target_sections', a.target_sections,
        'status', 'posted'
      ) AS item
      FROM public.announcements a
      JOIN public.subjects s ON s.id = a.subject_id
      WHERE public.user_teaches_subject(a.subject_id)
        AND a.created_at >= now() - interval '60 days'

      UNION ALL

      SELECT jsonb_build_object(
        'kind', 'assessment',
        'id', e.id,
        'title', e.title,
        'body', coalesce(e.description, ''),
        'created_at', coalesce(e.created_at, e.start_datetime, now()),
        'subject_id', e.subject_id,
        'subject_name', s.name,
        'target_sections', e.target_sections,
        'status', CASE
          WHEN e.start_datetime IS NOT NULL AND now() < e.start_datetime THEN 'scheduled'
          WHEN e.end_datetime IS NOT NULL AND now() > e.end_datetime THEN 'closed'
          ELSE 'active'
        END,
        'start_datetime', e.start_datetime,
        'end_datetime', e.end_datetime
      )
      FROM public.exams e
      JOIN public.subjects s ON s.id = e.subject_id
      WHERE public.user_teaches_subject(e.subject_id)
        AND coalesce(e.created_at, e.start_datetime, now()) >= now() - interval '60 days'

      UNION ALL

      SELECT jsonb_build_object(
        'kind', 'comment',
        'id', c.id,
        'title', 'New comment on "' || a.title || '"',
        'body', left(c.body, 120),
        'created_at', c.created_at,
        'subject_id', a.subject_id,
        'subject_name', s.name,
        'announcement_id', a.id,
        'status', 'comment'
      )
      FROM public.announcement_comments c
      JOIN public.announcements a ON a.id = c.announcement_id
      JOIN public.subjects s ON s.id = a.subject_id
      WHERE public.user_teaches_subject(a.subject_id)
        AND c.user_id <> auth.uid()
        AND c.created_at >= now() - interval '60 days'
    ) feed
    LIMIT p_limit;
  ELSE
    SELECT COALESCE(
      jsonb_agg(item ORDER BY (item->>'created_at') DESC),
      '[]'::jsonb
    )
    INTO v_result
    FROM (
      SELECT jsonb_build_object(
        'kind', 'announcement',
        'id', a.id,
        'title', a.title,
        'body', left(a.body, 120),
        'created_at', a.created_at,
        'subject_id', a.subject_id,
        'subject_name', s.name,
        'target_sections', a.target_sections,
        'status', 'posted'
      ) AS item
      FROM public.announcements a
      JOIN public.subjects s ON s.id = a.subject_id
      JOIN public.subject_students ss
        ON ss.subject_id = a.subject_id AND ss.student_id = auth.uid()
      WHERE public.sections_overlap(ss.section, a.target_sections)
        AND a.created_at >= now() - interval '60 days'

      UNION ALL

      SELECT jsonb_build_object(
        'kind', 'assessment',
        'id', e.id,
        'title', e.title,
        'body', coalesce(e.description, ''),
        'created_at', coalesce(e.created_at, e.start_datetime, now()),
        'subject_id', e.subject_id,
        'subject_name', s.name,
        'target_sections', e.target_sections,
        'status', CASE
          WHEN e.start_datetime IS NOT NULL AND now() < e.start_datetime THEN 'scheduled'
          WHEN e.end_datetime IS NOT NULL AND now() > e.end_datetime THEN 'closed'
          ELSE 'active'
        END,
        'start_datetime', e.start_datetime,
        'end_datetime', e.end_datetime
      )
      FROM public.exams e
      JOIN public.subjects s ON s.id = e.subject_id
      JOIN public.subject_students ss
        ON ss.subject_id = e.subject_id AND ss.student_id = auth.uid()
      WHERE public.sections_overlap(ss.section, e.target_sections)
        AND coalesce(e.created_at, e.start_datetime, now()) >= now() - interval '60 days'
    ) feed
    LIMIT p_limit;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_notifications(int) TO authenticated;

NOTIFY pgrst, 'reload schema';
