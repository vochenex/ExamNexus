-- Expand in-app notifications: admin broadcasts, reactions, student comments,
-- and keep faculty/student announcement + assessment feeds.
-- Run in Supabase SQL Editor after deploying the app.

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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT lower(coalesce(role, '')) INTO v_role
  FROM public.users WHERE id = auth.uid();

  v_is_faculty := v_role = 'faculty';
  v_is_student := v_role = 'student';

  SELECT COALESCE(
    jsonb_agg(item ORDER BY (item->>'created_at') DESC),
    '[]'::jsonb
  )
  INTO v_result
  FROM (
    -- Platform / admin broadcasts visible to this role
    SELECT jsonb_build_object(
      'kind', 'admin_announcement',
      'id', aa.id,
      'title', aa.title,
      'body', left(coalesce(aa.body, ''), 160),
      'created_at', aa.created_at,
      'audience', aa.audience,
      'status', 'posted',
      'subject_name', 'ExamNexus'
    ) AS item
    FROM public.admin_announcements aa
    WHERE aa.created_at >= now() - interval '60 days'
      AND (
        aa.audience = 'all'
        OR (aa.audience = 'faculty' AND v_is_faculty)
        OR (aa.audience = 'students' AND v_is_student)
      )

    UNION ALL

    -- Subject announcements (faculty: teaching; student: enrolled + section)
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

    -- Assessments
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

    -- Comments on announcements the user can see (exclude own comments)
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
    WHERE c.user_id <> auth.uid()
      AND c.created_at >= now() - interval '60 days'
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

    -- Reactions on announcements created by this user
    SELECT jsonb_build_object(
      'kind', 'reaction',
      'id', r.announcement_id::text || ':' || r.user_id::text,
      'title', 'New reaction on "' || a.title || '"',
      'body', coalesce(u.first_name || ' ' || u.last_name, 'Someone') || ' reacted to your announcement',
      'created_at', coalesce(r.created_at, now()),
      'subject_id', a.subject_id,
      'subject_name', s.name,
      'announcement_id', a.id,
      'status', 'reaction'
    )
    FROM public.announcement_reactions r
    JOIN public.announcements a ON a.id = r.announcement_id
    JOIN public.subjects s ON s.id = a.subject_id
    LEFT JOIN public.users u ON u.id = r.user_id
    WHERE a.created_by = auth.uid()
      AND r.user_id <> auth.uid()
      AND coalesce(r.created_at, now()) >= now() - interval '60 days'

    UNION ALL

    -- Account approval / rejection notices for the signed-in user
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
      'status', lower(coalesce(u.account_status, 'pending'))
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

-- Resolve audience user ids for admin broadcast push
CREATE OR REPLACE FUNCTION public.get_broadcast_recipient_ids(p_audience text DEFAULT 'all')
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(ARRAY(
    SELECT u.id
    FROM public.users u
    WHERE
      CASE lower(coalesce(nullif(trim(p_audience), ''), 'all'))
        WHEN 'faculty' THEN lower(u.role) IN ('faculty', 'teacher')
        WHEN 'students' THEN lower(u.role) = 'student'
        ELSE lower(u.role) IN ('faculty', 'teacher', 'student')
      END
      AND lower(coalesce(u.account_status, 'approved')) = 'approved'
  ), '{}'::uuid[]);
$$;

GRANT EXECUTE ON FUNCTION public.get_broadcast_recipient_ids(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
