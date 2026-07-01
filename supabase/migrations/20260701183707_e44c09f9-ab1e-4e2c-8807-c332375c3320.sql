
-- Helper: is_superadmin()
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.current_user_role() = 'superadmin'::app_role $$;

REVOKE ALL ON FUNCTION public.is_superadmin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated, service_role;

-- Fix 1: mission_contractors — restrict manage to superadmin
DROP POLICY IF EXISTS mission_contractors_contractor_manage ON public.mission_contractors;

DROP POLICY IF EXISTS mission_contractors_select ON public.mission_contractors;
CREATE POLICY mission_contractors_select ON public.mission_contractors
  FOR SELECT TO authenticated
  USING (public.can_access_mission(mission_id));

DROP POLICY IF EXISTS mission_contractors_superadmin_manage ON public.mission_contractors;
CREATE POLICY mission_contractors_superadmin_manage ON public.mission_contractors
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Fix 2: allow superadmin to delete missions (explicit policy)
DROP POLICY IF EXISTS missions_superadmin_delete ON public.missions;
CREATE POLICY missions_superadmin_delete ON public.missions
  FOR DELETE TO authenticated
  USING (public.is_superadmin());
