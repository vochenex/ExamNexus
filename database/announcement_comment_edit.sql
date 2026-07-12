-- Edit / delete own comments (class + platform announcements)
-- Run in Supabase after notifications_and_announcement_social.sql
-- and admin_announcement_social.sql

-- Subject announcement comments: allow author update
DROP POLICY IF EXISTS announcement_comments_update_own ON public.announcement_comments;
CREATE POLICY announcement_comments_update_own ON public.announcement_comments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Faculty who owns the announcement (or admin) may delete any comment on it
DROP POLICY IF EXISTS announcement_comments_delete_moderator ON public.announcement_comments;
CREATE POLICY announcement_comments_delete_moderator ON public.announcement_comments
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_comments.announcement_id
        AND a.created_by = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.update_announcement_comment(
  p_comment_id uuid,
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
  IF char_length(trim(coalesce(p_body, ''))) = 0 THEN
    RAISE EXCEPTION 'Comment cannot be empty';
  END IF;

  UPDATE public.announcement_comments
  SET body = trim(p_body)
  WHERE id = p_comment_id
    AND user_id = auth.uid()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Comment not found or not allowed';
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = v_row.user_id;

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

GRANT EXECUTE ON FUNCTION public.update_announcement_comment(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_announcement_comment(p_comment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_announcement_id uuid;
  v_owner uuid;
  v_author uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT c.announcement_id, c.user_id, a.created_by
  INTO v_announcement_id, v_author, v_owner
  FROM public.announcement_comments c
  JOIN public.announcements a ON a.id = c.announcement_id
  WHERE c.id = p_comment_id;

  IF v_announcement_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;

  IF v_author <> auth.uid()
     AND v_owner <> auth.uid()
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  DELETE FROM public.announcement_comments WHERE id = p_comment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_announcement_comment(uuid) TO authenticated;

-- Platform admin comments
DROP POLICY IF EXISTS admin_announcement_comments_update_own ON public.admin_announcement_comments;
CREATE POLICY admin_announcement_comments_update_own ON public.admin_announcement_comments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS admin_announcement_comments_delete ON public.admin_announcement_comments;
CREATE POLICY admin_announcement_comments_delete ON public.admin_announcement_comments
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
  );

CREATE OR REPLACE FUNCTION public.update_admin_announcement_comment(
  p_comment_id uuid,
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
  IF char_length(trim(coalesce(p_body, ''))) = 0 THEN
    RAISE EXCEPTION 'Comment cannot be empty';
  END IF;

  UPDATE public.admin_announcement_comments
  SET body = trim(p_body)
  WHERE id = p_comment_id
    AND user_id = auth.uid()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Comment not found or not allowed';
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = v_row.user_id;

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

GRANT EXECUTE ON FUNCTION public.update_admin_announcement_comment(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_admin_announcement_comment(p_comment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_author
  FROM public.admin_announcement_comments
  WHERE id = p_comment_id;

  IF v_author IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;

  IF v_author <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  DELETE FROM public.admin_announcement_comments WHERE id = p_comment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_admin_announcement_comment(uuid) TO authenticated;
