
DROP POLICY IF EXISTS "logs_insert" ON public.activity_logs;

CREATE POLICY "logs_insert"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (mission_id IS NULL OR public.can_access_mission(mission_id))
);
