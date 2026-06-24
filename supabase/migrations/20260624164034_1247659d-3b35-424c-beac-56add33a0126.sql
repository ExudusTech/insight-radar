CREATE TABLE public.mission_contractors (
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mission_id, contractor_id)
);

GRANT SELECT, INSERT, DELETE ON public.mission_contractors TO authenticated;
GRANT ALL ON public.mission_contractors TO service_role;

ALTER TABLE public.mission_contractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mc_superadmin_all" ON public.mission_contractors
  FOR ALL USING (public.current_user_role() = 'superadmin');

CREATE POLICY "mc_contractor_self_read" ON public.mission_contractors
  FOR SELECT USING (contractor_id = auth.uid());

CREATE POLICY "mc_analyst_read" ON public.mission_contractors
  FOR SELECT USING (public.can_access_mission(mission_id));

CREATE OR REPLACE FUNCTION public.can_access_mission(_mission_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.missions m
    WHERE m.id = _mission_id
    AND (
      public.current_user_role() = 'superadmin'
      OR m.contractor_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.mission_contractors mc
        WHERE mc.mission_id = _mission_id AND mc.contractor_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.mission_analysts ma
        WHERE ma.mission_id = _mission_id AND ma.analyst_id = auth.uid()
      )
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_mission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_mission(uuid) TO authenticated, service_role;