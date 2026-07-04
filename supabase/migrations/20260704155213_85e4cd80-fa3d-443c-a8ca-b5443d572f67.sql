
CREATE TABLE IF NOT EXISTS public.coordination_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  receiver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_id uuid REFERENCES public.targets(id) ON DELETE SET NULL,
  content text NOT NULL CHECK (length(btrim(content)) > 0),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS coordination_messages_mission_idx
  ON public.coordination_messages (mission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS coordination_messages_receiver_unread_idx
  ON public.coordination_messages (receiver_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS coordination_messages_thread_idx
  ON public.coordination_messages (mission_id, sender_id, receiver_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.coordination_messages TO authenticated;
GRANT ALL ON public.coordination_messages TO service_role;

ALTER TABLE public.coordination_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants and coordinators can read"
  ON public.coordination_messages
  FOR SELECT TO authenticated
  USING (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
    OR public.current_user_role() IN ('superadmin'::public.app_role, 'coordinator'::public.app_role)
  );

CREATE POLICY "Sender inserts own messages with mission access"
  ON public.coordination_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.can_access_mission(mission_id)
  );

CREATE POLICY "Receiver marks own messages as read"
  ON public.coordination_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- Notification type: coordination_message
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'doubt','observation','status_change','feedback','mission_started',
    'mission_pending_acceptance','mission_accepted','mission_declined',
    'date_proposal','date_proposal_response','deadline_alert','status_update',
    'new_evidence','new_comment','report_ready','assignment','report_request',
    'coordination_message'
  ]));
