-- Platform (admin) announcements: social + delete
-- Run in Supabase SQL editor after admin_platform.sql

CREATE TABLE IF NOT EXISTS public.admin_announcement_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.admin_announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_announcement_comments_ann_idx
  ON public.admin_announcement_comments (announcement_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.admin_announcement_reactions (
  announcement_id uuid NOT NULL REFERENCES public.admin_announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

ALTER TABLE public.admin_announcement_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_announcement_reactions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_admin_announcement(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audience text;
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT aa.audience INTO v_audience
  FROM public.admin_announcements aa
  WHERE aa.id = p_id;

  IF v_audience IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_admin() THEN
    RETURN true;
  END IF;

  SELECT lower(coalesce(role, '')) INTO v_role
  FROM public.users WHERE id = auth.uid();

  IF v_audience = 'all' THEN
    RETURN v_role IN ('student', 'faculty');
  END IF;
  IF v_audience = 'students' THEN
    RETURN v_role = 'student';
  END IF;
  IF v_audience = 'faculty' THEN
    RETURN v_role = 'faculty';
  END IF;
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_view_admin_announcement(uuid) TO authenticated;

DROP POLICY IF EXISTS admin_announcement_comments_select ON public.admin_announcement_comments;
CREATE POLICY admin_announcement_comments_select ON public.admin_announcement_comments
  FOR SELECT TO authenticated
  USING (public.can_view_admin_announcement(announcement_id));

DROP POLICY IF EXISTS admin_announcement_comments_insert ON public.admin_announcement_comments;
CREATE POLICY admin_announcement_comments_insert ON public.admin_announcement_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_view_admin_announcement(announcement_id)
  );

DROP POLICY IF EXISTS admin_announcement_reactions_select ON public.admin_announcement_reactions;
CREATE POLICY admin_announcement_reactions_select ON public.admin_announcement_reactions
  FOR SELECT TO authenticated
  USING (public.can_view_admin_announcement(announcement_id));

DROP POLICY IF EXISTS admin_announcement_reactions_write ON public.admin_announcement_reactions;
CREATE POLICY admin_announcement_reactions_write ON public.admin_announcement_reactions
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND public.can_view_admin_announcement(announcement_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_view_admin_announcement(announcement_id)
  );

CREATE OR REPLACE FUNCTION public.get_platform_announcements()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC)
      FROM (
        SELECT
          aa.id,
          aa.title,
          aa.body,
          aa.audience,
          aa.created_at,
          aa.created_by,
          u.first_name AS author_first_name,
          u.last_name AS author_last_name,
          u.avatar_url AS author_avatar_url,
          (
            SELECT count(*)::int
            FROM public.admin_announcement_reactions r
            WHERE r.announcement_id = aa.id
          ) AS heart_count,
          EXISTS (
            SELECT 1
            FROM public.admin_announcement_reactions r
            WHERE r.announcement_id = aa.id AND r.user_id = auth.uid()
          ) AS user_reacted,
          (
            SELECT count(*)::int
            FROM public.admin_announcement_comments c
            WHERE c.announcement_id = aa.id
          ) AS comment_count
        FROM public.admin_announcements aa
        LEFT JOIN public.users u ON u.id = aa.created_by
        WHERE public.can_view_admin_announcement(aa.id)
        ORDER BY aa.created_at DESC
        LIMIT 100
      ) t
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_announcements() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_announcement_comments(p_announcement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.can_view_admin_announcement(p_announcement_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at ASC)
      FROM (
        SELECT
          c.id,
          c.announcement_id,
          c.user_id,
          c.body,
          c.created_at,
          u.first_name,
          u.last_name,
          u.avatar_url
        FROM public.admin_announcement_comments c
        LEFT JOIN public.users u ON u.id = c.user_id
        WHERE c.announcement_id = p_announcement_id
        ORDER BY c.created_at ASC
      ) t
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_announcement_comments(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_admin_announcement_comment(
  p_announcement_id uuid,
  p_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.admin_announcement_comments%ROWTYPE;
  v_user public.users%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.can_view_admin_announcement(p_announcement_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF char_length(trim(coalesce(p_body, ''))) = 0 THEN
    RAISE EXCEPTION 'Comment cannot be empty';
  END IF;

  INSERT INTO public.admin_announcement_comments (announcement_id, user_id, body)
  VALUES (p_announcement_id, auth.uid(), trim(p_body))
  RETURNING * INTO v_row;

  SELECT * INTO v_user FROM public.users WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'id', v_row.id,
    'announcement_id', v_row.announcement_id,
    'user_id', v_row.user_id,
    'body', v_row.body,
    'created_at', v_row.created_at,
    'first_name', v_user.first_name,
    'last_name', v_user.last_name,
    'avatar_url', v_user.avatar_url
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_admin_announcement_comment(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.toggle_admin_announcement_reaction(p_announcement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.can_view_admin_announcement(p_announcement_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.admin_announcement_reactions
    WHERE announcement_id = p_announcement_id AND user_id = auth.uid()
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.admin_announcement_reactions
    WHERE announcement_id = p_announcement_id AND user_id = auth.uid();
  ELSE
    INSERT INTO public.admin_announcement_reactions (announcement_id, user_id)
    VALUES (p_announcement_id, auth.uid())
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT count(*)::int INTO v_count
  FROM public.admin_announcement_reactions
  WHERE announcement_id = p_announcement_id;

  RETURN jsonb_build_object(
    'user_reacted', NOT v_exists,
    'heart_count', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_admin_announcement_reaction(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_broadcast(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  DELETE FROM public.admin_announcements WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_broadcast(uuid) TO authenticated;
