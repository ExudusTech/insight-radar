
-- Harden mission_analysts: contractor can only assign users with 'analyst' role
DROP POLICY IF EXISTS mission_analysts_contractor_manage ON public.mission_analysts;
CREATE POLICY mission_analysts_contractor_manage ON public.mission_analysts
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.missions m WHERE m.id = mission_analysts.mission_id AND m.contractor_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.missions m WHERE m.id = mission_analysts.mission_id AND m.contractor_id = auth.uid())
    AND public.has_role(analyst_id, 'analyst'::public.app_role)
  );

-- Harden mission_contractors: contractor can only add users with 'contractor' role
DROP POLICY IF EXISTS mission_contractors_contractor_manage ON public.mission_contractors;
CREATE POLICY mission_contractors_contractor_manage ON public.mission_contractors
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.missions m WHERE m.id = mission_contractors.mission_id AND m.contractor_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.missions m WHERE m.id = mission_contractors.mission_id AND m.contractor_id = auth.uid())
    AND public.has_role(contractor_id, 'contractor'::public.app_role)
  );

-- collection_data: enforce updated_by = auth.uid()
DROP POLICY IF EXISTS collection_write ON public.collection_data;
CREATE POLICY collection_write ON public.collection_data
  FOR ALL TO authenticated
  USING (public.can_access_mission(mission_id))
  WITH CHECK (
    public.can_access_mission(mission_id)
    AND (updated_by IS NULL OR updated_by = auth.uid())
  );

-- interactions: enforce created_by = auth.uid()
DROP POLICY IF EXISTS interactions_write ON public.interactions;
CREATE POLICY interactions_write ON public.interactions
  FOR ALL TO authenticated
  USING (public.can_access_mission(mission_id))
  WITH CHECK (
    public.can_access_mission(mission_id)
    AND (created_by IS NULL OR created_by = auth.uid())
  );

-- evidences: enforce created_by = auth.uid()
DROP POLICY IF EXISTS evidences_write ON public.evidences;
CREATE POLICY evidences_write ON public.evidences
  FOR ALL TO authenticated
  USING (public.can_access_mission(mission_id))
  WITH CHECK (
    public.can_access_mission(mission_id)
    AND (created_by IS NULL OR created_by = auth.uid())
  );
