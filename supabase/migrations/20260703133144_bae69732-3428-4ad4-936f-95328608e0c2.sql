-- 1) llm_usage_logs
CREATE TABLE public.llm_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  target_id uuid REFERENCES public.targets(id) ON DELETE SET NULL,
  provider text NOT NULL,
  model text NOT NULL,
  task text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(12,6) NOT NULL DEFAULT 0
);

GRANT SELECT ON public.llm_usage_logs TO authenticated;
GRANT ALL ON public.llm_usage_logs TO service_role;

ALTER TABLE public.llm_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_all_llm_usage" ON public.llm_usage_logs
  FOR SELECT TO authenticated
  USING (public.is_superadmin());

CREATE POLICY "own_llm_usage" ON public.llm_usage_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX llm_usage_logs_created_at_idx
  ON public.llm_usage_logs (created_at DESC);
CREATE INDEX llm_usage_logs_user_created_idx
  ON public.llm_usage_logs (user_id, created_at DESC);
CREATE INDEX llm_usage_logs_mission_idx
  ON public.llm_usage_logs (mission_id, created_at DESC);

-- 2) assistant_messages — comparative chat support
ALTER TABLE public.assistant_messages
  ALTER COLUMN target_id DROP NOT NULL;

ALTER TABLE public.assistant_messages
  ADD COLUMN IF NOT EXISTS session_id uuid;

CREATE INDEX IF NOT EXISTS assistant_messages_comparative_idx
  ON public.assistant_messages (mission_id, session_id, created_at)
  WHERE target_id IS NULL;

-- Allow inserts for comparative chat (target_id IS NULL) by users
-- who can access the mission. Both user and assistant roles are allowed
-- because the flow persists both sides after the server responds.
CREATE POLICY "comparative_messages_insert" ON public.assistant_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    target_id IS NULL
    AND analyst_id = auth.uid()
    AND public.can_access_mission(mission_id)
  );

-- Ensure users who can access the mission can read comparative messages
-- (superadmin/analyst_own/contractor policies already exist but the
-- contractor one requires mission_contractors; broaden read for
-- comparative to any mission member).
CREATE POLICY "comparative_messages_select" ON public.assistant_messages
  FOR SELECT TO authenticated
  USING (
    target_id IS NULL
    AND public.can_access_mission(mission_id)
  );