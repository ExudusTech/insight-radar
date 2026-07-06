
CREATE TABLE public.briefing_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX briefing_messages_mission_id_created_at_idx
  ON public.briefing_messages (mission_id, created_at);

GRANT SELECT, INSERT ON public.briefing_messages TO authenticated;
GRANT ALL ON public.briefing_messages TO service_role;

ALTER TABLE public.briefing_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "briefing_read" ON public.briefing_messages
  FOR SELECT USING (public.can_read_mission(mission_id));

CREATE POLICY "briefing_insert" ON public.briefing_messages
  FOR INSERT WITH CHECK (public.can_access_mission(mission_id));
