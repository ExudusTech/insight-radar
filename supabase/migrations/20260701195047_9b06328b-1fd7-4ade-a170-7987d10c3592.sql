-- Fix 1: mission_analysts — remove contractor write, keep superadmin only
DROP POLICY IF EXISTS mission_analysts_contractor_manage ON public.mission_analysts;
-- mission_analysts_admin_write (ALL, superadmin) and mission_analysts_read (SELECT, can_access_mission) already exist

-- Fix 2: reports — split writes by role
DROP POLICY IF EXISTS reports_write ON public.reports;

CREATE POLICY reports_insert
  ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR public.is_mission_contractor(mission_id)
  );

CREATE POLICY reports_update
  ON public.reports
  FOR UPDATE
  TO authenticated
  USING (
    public.is_superadmin()
    OR public.is_mission_contractor(mission_id)
  )
  WITH CHECK (
    public.is_superadmin()
    OR public.is_mission_contractor(mission_id)
  );

CREATE POLICY reports_delete
  ON public.reports
  FOR DELETE
  TO authenticated
  USING (public.is_superadmin());