CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  origin_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE,
  target_id uuid REFERENCES public.targets(id) ON DELETE CASCADE,
  block text CHECK (block IN ('A','B','C','D','E','F','G')),
  type text NOT NULL CHECK (type IN ('doubt','observation','status_change','feedback')),
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_self_read" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_superadmin_all" ON public.notifications
  FOR ALL USING (public.current_user_role() = 'superadmin');

CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notifications_self_update" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());