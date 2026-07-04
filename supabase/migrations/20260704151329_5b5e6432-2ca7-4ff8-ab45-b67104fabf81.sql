
CREATE TABLE IF NOT EXISTS public.target_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES public.targets(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  block_key TEXT NOT NULL,
  missing_fields TEXT[] NOT NULL DEFAULT '{}',
  suggestion TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS target_gaps_target_block_uniq ON public.target_gaps(target_id, block_key);
CREATE INDEX IF NOT EXISTS target_gaps_mission_idx ON public.target_gaps(mission_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.target_gaps TO authenticated;
GRANT ALL ON public.target_gaps TO service_role;

ALTER TABLE public.target_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "target_gaps_read" ON public.target_gaps
  FOR SELECT TO authenticated
  USING (public.can_access_mission(mission_id));

CREATE POLICY "target_gaps_write" ON public.target_gaps
  FOR ALL TO authenticated
  USING (public.can_access_mission(mission_id))
  WITH CHECK (public.can_access_mission(mission_id));
