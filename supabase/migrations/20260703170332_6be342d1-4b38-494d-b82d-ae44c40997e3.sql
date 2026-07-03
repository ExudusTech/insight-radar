
CREATE TABLE public.target_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  target_id uuid NOT NULL REFERENCES public.targets(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  event_date date NOT NULL DEFAULT current_date,
  event_type text NOT NULL CHECK (event_type IN (
    'contato_inicial',
    'resposta_recebida',
    'reuniao_agendada',
    'reuniao_realizada',
    'proposta_recebida',
    'follow_up_recebido',
    'negociacao',
    'encerramento',
    'outro'
  )),
  description text NOT NULL,
  source text NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'manual')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  evidence_id uuid REFERENCES public.evidences(id) ON DELETE SET NULL
);

CREATE INDEX target_timeline_events_target_idx
  ON public.target_timeline_events (target_id, event_date DESC, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.target_timeline_events TO authenticated;
GRANT ALL ON public.target_timeline_events TO service_role;

ALTER TABLE public.target_timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mission members can view timeline events"
  ON public.target_timeline_events FOR SELECT
  USING (public.can_access_mission(mission_id));

CREATE POLICY "Analysts and superadmins can insert timeline events"
  ON public.target_timeline_events FOR INSERT
  WITH CHECK (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.mission_analysts ma
      WHERE ma.mission_id = target_timeline_events.mission_id
        AND ma.analyst_id = auth.uid()
    )
  );

CREATE POLICY "Superadmin can delete timeline events"
  ON public.target_timeline_events FOR DELETE
  USING (public.is_superadmin());
