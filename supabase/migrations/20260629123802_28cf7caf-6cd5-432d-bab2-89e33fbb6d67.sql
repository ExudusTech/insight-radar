DROP POLICY IF EXISTS missions_admin_write ON public.missions;

CREATE POLICY missions_superadmin_all ON public.missions
  FOR ALL
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY missions_contractor_insert ON public.missions
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'contractor')
    AND contractor_id = auth.uid()
  );

CREATE POLICY missions_contractor_update ON public.missions
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'contractor')
    AND contractor_id = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'contractor')
    AND contractor_id = auth.uid()
  );

-- Allow contractors to manage analyst/contractor links for their own missions
DROP POLICY IF EXISTS mission_analysts_contractor_manage ON public.mission_analysts;
CREATE POLICY mission_analysts_contractor_manage ON public.mission_analysts
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.missions m WHERE m.id = mission_id AND m.contractor_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.missions m WHERE m.id = mission_id AND m.contractor_id = auth.uid())
  );

DROP POLICY IF EXISTS mission_contractors_contractor_manage ON public.mission_contractors;
CREATE POLICY mission_contractors_contractor_manage ON public.mission_contractors
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.missions m WHERE m.id = mission_id AND m.contractor_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.missions m WHERE m.id = mission_id AND m.contractor_id = auth.uid())
  );
