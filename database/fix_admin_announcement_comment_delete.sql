-- Allow admins to remove any comment on admin announcements.
-- Faculty delete rights on class announcements remain in delete_announcement_comment().

CREATE OR REPLACE FUNCTION public.delete_admin_announcement_comment(p_comment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author uuid;
  v_announcement_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id, announcement_id
  INTO v_author, v_announcement_id
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

NOTIFY pgrst, 'reload schema';
