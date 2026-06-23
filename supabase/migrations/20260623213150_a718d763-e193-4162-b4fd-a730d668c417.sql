
-- 1. Fix privilege escalation in signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, organization)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'organization'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Always assign 'analyst' on signup. Promotion requires a superadmin.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'analyst')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Remove permissive profiles policy that exposes all user PII
DROP POLICY IF EXISTS "profiles_list_for_authenticated" ON public.profiles;

-- 3. Scoped teammate visibility for profiles via security-definer helper
CREATE OR REPLACE FUNCTION public.shares_mission_with(_other uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.missions m
    LEFT JOIN public.mission_analysts ma ON ma.mission_id = m.id
    WHERE
      (m.contractor_id = auth.uid() OR ma.analyst_id = auth.uid())
      AND (m.contractor_id = _other OR ma.analyst_id = _other)
  );
$$;

CREATE POLICY "profiles_mission_teammates_read"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.shares_mission_with(id));

-- 4. Lock down SECURITY DEFINER function execution to authenticated only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_access_mission(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_access_mission(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.shares_mission_with(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.shares_mission_with(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.set_updated_at() TO service_role;
