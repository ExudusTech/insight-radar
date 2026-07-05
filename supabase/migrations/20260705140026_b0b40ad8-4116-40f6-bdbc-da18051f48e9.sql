
-- 1) Lock can_view_strategic on self-update
DROP POLICY IF EXISTS profiles_self_update_safe ON public.profiles;
CREATE POLICY profiles_self_update_safe ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND status IS NOT DISTINCT FROM (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid())
  AND accepts_missions IS NOT DISTINCT FROM (SELECT p.accepts_missions FROM public.profiles p WHERE p.id = auth.uid())
  AND can_view_strategic IS NOT DISTINCT FROM (SELECT p.can_view_strategic FROM public.profiles p WHERE p.id = auth.uid())
);

-- 2) Restrict policies from public → authenticated (conditions unchanged)

-- mission_contractors
DROP POLICY IF EXISTS mc_analyst_read ON public.mission_contractors;
CREATE POLICY mc_analyst_read ON public.mission_contractors
FOR SELECT TO authenticated
USING (can_access_mission(mission_id));

DROP POLICY IF EXISTS mc_contractor_self_read ON public.mission_contractors;
CREATE POLICY mc_contractor_self_read ON public.mission_contractors
FOR SELECT TO authenticated
USING (contractor_id = auth.uid());

DROP POLICY IF EXISTS mc_superadmin_all ON public.mission_contractors;
CREATE POLICY mc_superadmin_all ON public.mission_contractors
FOR ALL TO authenticated
USING (current_user_role() = 'superadmin'::app_role)
WITH CHECK (current_user_role() = 'superadmin'::app_role);

-- missions
DROP POLICY IF EXISTS missions_contractor_insert ON public.missions;
CREATE POLICY missions_contractor_insert ON public.missions
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'contractor'::app_role) AND contractor_id = auth.uid());

DROP POLICY IF EXISTS missions_contractor_update ON public.missions;
CREATE POLICY missions_contractor_update ON public.missions
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'contractor'::app_role) AND contractor_id = auth.uid())
WITH CHECK (has_role(auth.uid(), 'contractor'::app_role) AND contractor_id = auth.uid());

DROP POLICY IF EXISTS missions_superadmin_all ON public.missions;
CREATE POLICY missions_superadmin_all ON public.missions
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

-- products
DROP POLICY IF EXISTS products_client_read ON public.products;
CREATE POLICY products_client_read ON public.products
FOR SELECT TO authenticated
USING (client_id = auth.uid());

DROP POLICY IF EXISTS products_superadmin_all ON public.products;
CREATE POLICY products_superadmin_all ON public.products
FOR ALL TO authenticated
USING (current_user_role() = 'superadmin'::app_role)
WITH CHECK (current_user_role() = 'superadmin'::app_role);

-- notifications
DROP POLICY IF EXISTS notifications_self_read ON public.notifications;
CREATE POLICY notifications_self_read ON public.notifications
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_self_update ON public.notifications;
CREATE POLICY notifications_self_update ON public.notifications
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
