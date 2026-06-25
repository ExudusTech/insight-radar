
-- Tighten notifications insert: only self-targeted or by superadmin
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'superadmin')
);

-- Tighten change_requests insert: requestor_id must be the caller (or null)
DROP POLICY IF EXISTS "cr_insert" ON public.change_requests;
CREATE POLICY "cr_insert" ON public.change_requests
FOR INSERT TO authenticated
WITH CHECK (
  public.can_access_mission(mission_id)
  AND (requestor_id IS NULL OR requestor_id = auth.uid())
);
