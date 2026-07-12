-- Improve comment notification messaging: notify authors + prior commenters,
-- and name the student who also commented.
-- Run after notifications_expand_feed.sql

CREATE OR REPLACE FUNCTION public.get_user_notifications(p_limit int DEFAULT 40)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role text;
  v_is_faculty boolean;
  v_is_student boolean;
  v_result jsonb;
  v_viewer_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT lower(coalesce(role, '')),
         trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
  INTO v_role, v_viewer_name
  FROM public.users WHERE id = auth.uid();

  v_is_faculty := v_role = 'faculty';
  v_is_student := v_role = 'student';

  SELECT COALESCE(
    jsonb_agg(item ORDER BY (item->>'created_at') DESC),
    '[]'::jsonb
  )
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'kind', 'admin_announcement',
      'id', aa.id,
      'title', aa.title,
      'body', left(coalesce(aa.body, ''), 160),
      'created_at', aa.created_at,
      'audience', aa.audience,
      'status', 'posted',
      'subject_name', 'ExamNexus',
      'for_account', coalesce(nullif(v_viewer_name, ''), 'Your account')
    ) AS item
    FROM public.admin_announcements aa
    WHERE aa.created_at >= now() - interval '60 days'
      AND (
        aa.audience = 'all'
        OR (aa.audience = 'faculty' AND v_is_faculty)
        OR (aa.audience = 'students' AND v_is_student)
      )

    UNION ALL

    SELECT jsonb_build_object(
      'kind', 'announcement',
      'id', a.id,
      'title', a.title,
      'body', left(a.body, 120),
      'created_at', a.created_at,
      'subject_id', a.subject_id,
      'subject_name', s.name,
      'target_sections', a.target_sections,
      'status', 'posted',
      'for_account', coalesce(nullif(v_viewer_name, ''), 'Your account')
    )
    FROM public.announcements a
    JOIN public.subjects s ON s.id = a.subject_id
    WHERE a.created_at >= now() - interval '60 days'
      AND (
        (v_is_faculty AND public.user_teaches_subject(a.subject_id))
        OR (
          v_is_student
          AND EXISTS (
            SELECT 1
            FROM public.subject_students ss
            WHERE ss.subject_id = a.subject_id
              AND ss.student_id = auth.uid()
              AND public.sections_overlap(ss.section, a.target_sections)
          )
        )
      )

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
      'end_datetime', e.end_datetime,
      'for_account', coalesce(nullif(v_viewer_name, ''), 'Your account')
    )
    FROM public.exams e
    JOIN public.subjects s ON s.id = e.subject_id
    WHERE coalesce(e.created_at, e.start_datetime, now()) >= now() - interval '60 days'
      AND (
        (v_is_faculty AND public.user_teaches_subject(e.subject_id))
        OR (
          v_is_student
          AND EXISTS (
            SELECT 1
            FROM public.subject_students ss
            WHERE ss.subject_id = e.subject_id
              AND ss.student_id = auth.uid()
              AND public.sections_overlap(ss.section, e.target_sections)
          )
        )
      )

    UNION ALL

    -- Comments: author OR prior commenters only, name the commenter
    SELECT jsonb_build_object(
      'kind', 'comment',
      'id', c.id,
      'title', CASE
        WHEN EXISTS (
          SELECT 1 FROM public.announcement_comments mine
          WHERE mine.announcement_id = a.id
            AND mine.user_id = auth.uid()
            AND mine.created_at < c.created_at
        )
          THEN trim(coalesce(cu.first_name, '') || ' ' || coalesce(cu.last_name, ''))
               || ' also commented on "' || a.title || '"'
        ELSE 'New comment on "' || a.title || '"'
      END,
      'body', left(c.body, 120),
      'created_at', c.created_at,
      'subject_id', a.subject_id,
      'subject_name', s.name,
      'announcement_id', a.id,
      'status', 'comment',
      'actor_name', trim(coalesce(cu.first_name, '') || ' ' || coalesce(cu.last_name, '')),
      'for_account', coalesce(nullif(v_viewer_name, ''), 'Your account')
    )
    FROM public.announcement_comments c
    JOIN public.announcements a ON a.id = c.announcement_id
    JOIN public.subjects s ON s.id = a.subject_id
    LEFT JOIN public.users cu ON cu.id = c.user_id
    WHERE c.user_id <> auth.uid()
      AND c.created_at >= now() - interval '60 days'
      AND (
        a.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.announcement_comments mine
          WHERE mine.announcement_id = a.id
            AND mine.user_id = auth.uid()
        )
      )
      AND (
        (v_is_faculty AND public.user_teaches_subject(a.subject_id))
        OR (
          v_is_student
          AND EXISTS (
            SELECT 1
            FROM public.subject_students ss
            WHERE ss.subject_id = a.subject_id
              AND ss.student_id = auth.uid()
              AND public.sections_overlap(ss.section, a.target_sections)
          )
        )
      )

    UNION ALL

    -- Admin announcement comments (same thread-awareness)
    SELECT jsonb_build_object(
      'kind', 'comment',
      'id', c.id,
      'title', CASE
        WHEN EXISTS (
          SELECT 1 FROM public.admin_announcement_comments mine
          WHERE mine.announcement_id = aa.id
            AND mine.user_id = auth.uid()
            AND mine.created_at < c.created_at
        )
          THEN trim(coalesce(cu.first_name, '') || ' ' || coalesce(cu.last_name, ''))
               || ' also commented on "' || aa.title || '"'
        ELSE 'New comment on "' || aa.title || '"'
      END,
      'body', left(c.body, 120),
      'created_at', c.created_at,
      'announcement_id', aa.id,
      'subject_name', 'ExamNexus',
      'status', 'comment',
      'platform', true,
      'actor_name', trim(coalesce(cu.first_name, '') || ' ' || coalesce(cu.last_name, '')),
      'for_account', coalesce(nullif(v_viewer_name, ''), 'Your account')
    )
    FROM public.admin_announcement_comments c
    JOIN public.admin_announcements aa ON aa.id = c.announcement_id
    LEFT JOIN public.users cu ON cu.id = c.user_id
    WHERE c.user_id <> auth.uid()
      AND c.created_at >= now() - interval '60 days'
      AND to_regclass('public.admin_announcement_comments') IS NOT NULL
      AND (
        aa.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.admin_announcement_comments mine
          WHERE mine.announcement_id = aa.id
            AND mine.user_id = auth.uid()
        )
      )
      AND public.can_view_admin_announcement(aa.id)

    UNION ALL

    SELECT jsonb_build_object(
      'kind', 'reaction',
      'id', r.announcement_id::text || ':' || r.user_id::text,
      'title', 'New reaction on "' || a.title || '"',
      'body', coalesce(u.first_name || ' ' || u.last_name, 'Someone') || ' reacted to your announcement',
      'created_at', coalesce(r.created_at, now()),
      'subject_id', a.subject_id,
      'subject_name', s.name,
      'announcement_id', a.id,
      'status', 'reaction',
      'for_account', coalesce(nullif(v_viewer_name, ''), 'Your account')
    )
    FROM public.announcement_reactions r
    JOIN public.announcements a ON a.id = r.announcement_id
    JOIN public.subjects s ON s.id = a.subject_id
    LEFT JOIN public.users u ON u.id = r.user_id
    WHERE a.created_by = auth.uid()
      AND r.user_id <> auth.uid()
      AND coalesce(r.created_at, now()) >= now() - interval '60 days'

    UNION ALL

    SELECT jsonb_build_object(
      'kind', 'account',
      'id', u.id,
      'title', CASE
        WHEN lower(coalesce(u.account_status, '')) = 'approved' THEN 'Account approved'
        WHEN lower(coalesce(u.account_status, '')) = 'rejected' THEN 'Account not approved'
        ELSE 'Account update'
      END,
      'body', CASE
        WHEN lower(coalesce(u.account_status, '')) = 'approved'
          THEN 'Your ExamNexus account has been approved. You can sign in and use the app.'
        WHEN lower(coalesce(u.account_status, '')) = 'rejected'
          THEN 'Your registration was not approved. Contact an administrator if you need help.'
        ELSE 'Your account status was updated.'
      END,
      'created_at', coalesce(u.created_at, now()),
      'status', lower(coalesce(u.account_status, 'pending')),
      'for_account', coalesce(nullif(v_viewer_name, ''), 'Your account')
    )
    FROM public.users u
    WHERE u.id = auth.uid()
      AND lower(coalesce(u.account_status, '')) IN ('approved', 'rejected')
      AND coalesce(u.created_at, now()) >= now() - interval '14 days'
  ) feed
  LIMIT p_limit;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_notifications(int) TO authenticated;

NOTIFY pgrst, 'reload schema';
