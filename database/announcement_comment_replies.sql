-- Threaded replies on announcement comments (class + admin).
-- Run in Supabase SQL Editor after admin_announcement_social.sql / notifications_and_announcement_social.sql
-- If you also use comment hearts, run announcement_comment_reactions.sql after this
-- (or re-run it) so reaction tables/RPCs exist. This file's get_* helpers already
-- return heart_count / user_reacted when those tables are present.

-- ============================================================
-- Class announcement comments
-- ============================================================
ALTER TABLE public.announcement_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid
    REFERENCES public.announcement_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS announcement_comments_parent_idx
  ON public.announcement_comments (parent_comment_id)
  WHERE parent_comment_id IS NOT NULL;

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
          CASE
            WHEN to_regclass('public.announcement_comment_reactions') IS NULL THEN 0
            ELSE (
              SELECT count(*)::int
              FROM public.announcement_comment_reactions r
              WHERE r.comment_id = c.id
            )
          END AS heart_count,
          CASE
            WHEN to_regclass('public.announcement_comment_reactions') IS NULL THEN false
            ELSE EXISTS (
              SELECT 1
              FROM public.announcement_comment_reactions r
              WHERE r.comment_id = c.id
                AND r.user_id = auth.uid()
            )
          END AS user_reacted
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

DROP FUNCTION IF EXISTS public.add_announcement_comment(uuid, text);

CREATE OR REPLACE FUNCTION public.add_announcement_comment(
  p_announcement_id uuid,
  p_body text,
  p_parent_comment_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.announcement_comments%ROWTYPE;
  v_user public.users%ROWTYPE;
  v_parent public.announcement_comments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF char_length(trim(coalesce(p_body, ''))) = 0 THEN
    RAISE EXCEPTION 'Comment cannot be empty';
  END IF;

  IF p_parent_comment_id IS NOT NULL THEN
    SELECT * INTO v_parent
    FROM public.announcement_comments
    WHERE id = p_parent_comment_id
      AND announcement_id = p_announcement_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Parent comment not found';
    END IF;
    -- Flatten nested replies under the root parent of the thread
    IF v_parent.parent_comment_id IS NOT NULL THEN
      p_parent_comment_id := v_parent.parent_comment_id;
    END IF;
  END IF;

  INSERT INTO public.announcement_comments (
    announcement_id, user_id, body, parent_comment_id
  )
  VALUES (
    p_announcement_id, auth.uid(), trim(p_body), p_parent_comment_id
  )
  RETURNING * INTO v_row;

  SELECT * INTO v_user FROM public.users WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'id', v_row.id,
    'announcement_id', v_row.announcement_id,
    'user_id', v_row.user_id,
    'body', v_row.body,
    'parent_comment_id', v_row.parent_comment_id,
    'created_at', v_row.created_at,
    'first_name', v_user.first_name,
    'last_name', v_user.last_name,
    'avatar_url', v_user.avatar_url
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_announcement_comments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_announcement_comment(uuid, text, uuid) TO authenticated;

-- ============================================================
-- Admin announcement comments
-- ============================================================
ALTER TABLE public.admin_announcement_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid
    REFERENCES public.admin_announcement_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS admin_announcement_comments_parent_idx
  ON public.admin_announcement_comments (parent_comment_id)
  WHERE parent_comment_id IS NOT NULL;

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
          CASE
            WHEN to_regclass('public.admin_announcement_comment_reactions') IS NULL THEN 0
            ELSE (
              SELECT count(*)::int
              FROM public.admin_announcement_comment_reactions r
              WHERE r.comment_id = c.id
            )
          END AS heart_count,
          CASE
            WHEN to_regclass('public.admin_announcement_comment_reactions') IS NULL THEN false
            ELSE EXISTS (
              SELECT 1
              FROM public.admin_announcement_comment_reactions r
              WHERE r.comment_id = c.id
                AND r.user_id = auth.uid()
            )
          END AS user_reacted
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

DROP FUNCTION IF EXISTS public.add_admin_announcement_comment(uuid, text);

CREATE OR REPLACE FUNCTION public.add_admin_announcement_comment(
  p_announcement_id uuid,
  p_body text,
  p_parent_comment_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.admin_announcement_comments%ROWTYPE;
  v_user public.users%ROWTYPE;
  v_parent public.admin_announcement_comments%ROWTYPE;
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

  IF p_parent_comment_id IS NOT NULL THEN
    SELECT * INTO v_parent
    FROM public.admin_announcement_comments
    WHERE id = p_parent_comment_id
      AND announcement_id = p_announcement_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Parent comment not found';
    END IF;
    IF v_parent.parent_comment_id IS NOT NULL THEN
      p_parent_comment_id := v_parent.parent_comment_id;
    END IF;
  END IF;

  INSERT INTO public.admin_announcement_comments (
    announcement_id, user_id, body, parent_comment_id
  )
  VALUES (
    p_announcement_id, auth.uid(), trim(p_body), p_parent_comment_id
  )
  RETURNING * INTO v_row;

  SELECT * INTO v_user FROM public.users WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'id', v_row.id,
    'announcement_id', v_row.announcement_id,
    'user_id', v_row.user_id,
    'body', v_row.body,
    'parent_comment_id', v_row.parent_comment_id,
    'created_at', v_row.created_at,
    'first_name', v_user.first_name,
    'last_name', v_user.last_name,
    'avatar_url', v_user.avatar_url
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_announcement_comments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_admin_announcement_comment(uuid, text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
