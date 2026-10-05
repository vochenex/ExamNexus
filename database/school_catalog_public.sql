-- Public read of active departments and courses from the admin "Departments & courses" page.
-- Signup runs before login, so this must be callable by anon as well as authenticated users.
-- Run in Supabase SQL Editor after admin_platform.sql.

CREATE OR REPLACE FUNCTION public.get_school_catalog()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'item_type', c.item_type,
        'code', c.code,
        'label', c.label,
        'parent_code', c.parent_code,
        'sort_order', c.sort_order,
        'is_active', c.is_active
      )
      ORDER BY c.item_type, c.sort_order, c.label
    ),
    '[]'::jsonb
  )
  FROM public.school_catalog c
  WHERE c.is_active
    AND c.item_type IN ('department', 'course');
$$;

REVOKE ALL ON FUNCTION public.get_school_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_school_catalog() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
