-- Heart reactions on individual announcement comments (class + admin).
-- Run in Supabase SQL Editor after announcement_comment_replies.sql

-- ============================================================
-- Class announcement comment reactions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.announcement_comment_reactions (
  comment_id uuid NOT NULL REFERENCES public.announcement_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS announcement_comment_reactions_comment_idx
  ON public.announcement_comment_reactions (comment_id);

ALTER TABLE public.announcement_comment_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcement_comment_reactions_select ON public.announcement_comment_reactions;
CREATE POLICY announcement_comment_reactions_select ON public.announcement_comment_reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.announcement_comments c
      JOIN public.announcements a ON a.id = c.announcement_id
      WHERE c.id = announcement_comment_reactions.comment_id
    )
  );

DROP POLICY IF EXISTS announcement_comment_reactions_insert ON public.announcement_comment_reactions;
CREATE POLICY announcement_comment_reactions_insert ON public.announcement_comment_reactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS announcement_comment_reactions_delete_own ON public.announcement_comment_reactions;
CREATE POLICY announcement_comment_reactions_delete_own ON public.announcement_comment_reactions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.toggle_announcement_comment_reaction(p_comment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_count int;
  v_reacted boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.announcement_comments WHERE id = p_comment_id
  ) THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.announcement_comment_reactions
    WHERE comment_id = p_comment_id AND user_id = auth.uid()
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.announcement_comment_reactions
    WHERE comment_id = p_comment_id AND user_id = auth.uid();
    v_reacted := false;
  ELSE
    INSERT INTO public.announcement_comment_reactions (comment_id, user_id)
    VALUES (p_comment_id, auth.uid());
    v_reacted := true;
  END IF;

  SELECT count(*)::int INTO v_count
  FROM public.announcement_comment_reactions
  WHERE comment_id = p_comment_id;

  RETURN jsonb_build_object(
    'user_reacted', v_reacted,
    'heart_count', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_announcement_comment_reaction(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_announcement_comments(p_announcement_id uuid)
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
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at ASC)
      FROM (
        SELECT
          c.id,
          c.announcement_id,
          c.user_id,
          c.body,
          c.parent_comment_id,
          c.created_at,
          u.first_name,
          u.last_name,
          u.avatar_url,
          (
            SELECT count(*)::int
            FROM public.announcement_comment_reactions r
            WHERE r.comment_id = c.id
          ) AS heart_count,
          EXISTS (
            SELECT 1
            FROM public.announcement_comment_reactions r
            WHERE r.comment_id = c.id
              AND r.user_id = auth.uid()
          ) AS user_reacted
        FROM public.announcement_comments c
        LEFT JOIN public.users u ON u.id = c.user_id
        WHERE c.announcement_id = p_announcement_id
        ORDER BY c.created_at ASC
      ) t
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_announcement_comments(uuid) TO authenticated;

-- ============================================================
-- Admin announcement comment reactions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_announcement_comment_reactions (
  comment_id uuid NOT NULL REFERENCES public.admin_announcement_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS admin_announcement_comment_reactions_comment_idx
  ON public.admin_announcement_comment_reactions (comment_id);

ALTER TABLE public.admin_announcement_comment_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_announcement_comment_reactions_select ON public.admin_announcement_comment_reactions;
CREATE POLICY admin_announcement_comment_reactions_select ON public.admin_announcement_comment_reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_announcement_comments c
      WHERE c.id = admin_announcement_comment_reactions.comment_id
        AND public.can_view_admin_announcement(c.announcement_id)
    )
  );

DROP POLICY IF EXISTS admin_announcement_comment_reactions_insert ON public.admin_announcement_comment_reactions;
CREATE POLICY admin_announcement_comment_reactions_insert ON public.admin_announcement_comment_reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.admin_announcement_comments c
      WHERE c.id = comment_id
        AND public.can_view_admin_announcement(c.announcement_id)
    )
  );

DROP POLICY IF EXISTS admin_announcement_comment_reactions_delete_own ON public.admin_announcement_comment_reactions;
CREATE POLICY admin_announcement_comment_reactions_delete_own ON public.admin_announcement_comment_reactions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.toggle_admin_announcement_comment_reaction(p_comment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_announcement_id uuid;
  v_exists boolean;
  v_count int;
  v_reacted boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT announcement_id INTO v_announcement_id
  FROM public.admin_announcement_comments
  WHERE id = p_comment_id;

  IF v_announcement_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;

  IF NOT public.can_view_admin_announcement(v_announcement_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.admin_announcement_comment_reactions
    WHERE comment_id = p_comment_id AND user_id = auth.uid()
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.admin_announcement_comment_reactions
    WHERE comment_id = p_comment_id AND user_id = auth.uid();
    v_reacted := false;
  ELSE
    INSERT INTO public.admin_announcement_comment_reactions (comment_id, user_id)
    VALUES (p_comment_id, auth.uid());
    v_reacted := true;
  END IF;

  SELECT count(*)::int INTO v_count
  FROM public.admin_announcement_comment_reactions
  WHERE comment_id = p_comment_id;

  RETURN jsonb_build_object(
    'user_reacted', v_reacted,
    'heart_count', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_admin_announcement_comment_reaction(uuid) TO authenticated;

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
          c.parent_comment_id,
          c.created_at,
          u.first_name,
          u.last_name,
          u.avatar_url,
          (
            SELECT count(*)::int
            FROM public.admin_announcement_comment_reactions r
            WHERE r.comment_id = c.id
          ) AS heart_count,
          EXISTS (
            SELECT 1
            FROM public.admin_announcement_comment_reactions r
            WHERE r.comment_id = c.id
              AND r.user_id = auth.uid()
          ) AS user_reacted
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

NOTIFY pgrst, 'reload schema';
