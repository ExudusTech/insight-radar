
-- 1) Prioridade de papel: coordenador entre superadmin e contractor
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role
    WHEN 'superadmin'  THEN 1
    WHEN 'coordinator' THEN 2
    WHEN 'contractor'  THEN 3
    WHEN 'analyst'     THEN 4
  END
  LIMIT 1;
$$;

-- 2) Helper de leitura ampla: leitura para superadmin, coordinator, contractor ou analista atribuído
CREATE OR REPLACE FUNCTION public.can_read_mission(_mission_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.current_user_role() IN ('superadmin'::public.app_role, 'coordinator'::public.app_role)
    OR public.can_access_mission(_mission_id);
$$;

REVOKE EXECUTE ON FUNCTION public.can_read_mission(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_read_mission(uuid) TO authenticated, service_role;

-- 3) Trocar políticas de LEITURA para usar can_read_mission (inclui coordinator)
DROP POLICY IF EXISTS missions_read ON public.missions;
CREATE POLICY missions_read ON public.missions
  FOR SELECT TO authenticated
  USING (public.can_read_mission(id));

DROP POLICY IF EXISTS targets_read ON public.targets;
CREATE POLICY targets_read ON public.targets
  FOR SELECT TO authenticated
  USING (public.can_read_mission(mission_id));

DROP POLICY IF EXISTS collection_read ON public.collection_data;
CREATE POLICY collection_read ON public.collection_data
  FOR SELECT TO authenticated
  USING (public.can_read_mission(mission_id));

DROP POLICY IF EXISTS evidences_read ON public.evidences;
CREATE POLICY evidences_read ON public.evidences
  FOR SELECT TO authenticated
  USING (public.can_read_mission(mission_id));

DROP POLICY IF EXISTS docver_read ON public.document_versions;
CREATE POLICY docver_read ON public.document_versions
  FOR SELECT TO authenticated
  USING (public.can_read_mission(mission_id));

DROP POLICY IF EXISTS reports_read ON public.reports;
CREATE POLICY reports_read ON public.reports
  FOR SELECT TO authenticated
  USING (public.can_read_mission(mission_id));

DROP POLICY IF EXISTS mission_analysts_read ON public.mission_analysts;
CREATE POLICY mission_analysts_read ON public.mission_analysts
  FOR SELECT TO authenticated
  USING (public.can_read_mission(mission_id));

DROP POLICY IF EXISTS "Mission members can view timeline events" ON public.target_timeline_events;
CREATE POLICY "Mission members can view timeline events" ON public.target_timeline_events
  FOR SELECT TO authenticated
  USING (public.can_read_mission(mission_id));

-- 4) Assistant messages: coordinator lê tudo (leitura equivalente a superadmin)
DROP POLICY IF EXISTS coordinator_all_messages_read ON public.assistant_messages;
CREATE POLICY coordinator_all_messages_read ON public.assistant_messages
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'coordinator'::public.app_role);

-- 5) Coordenador pode atualizar missões (marcar como entregue, ajustar status)
DROP POLICY IF EXISTS missions_coordinator_update ON public.missions;
CREATE POLICY missions_coordinator_update ON public.missions
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'coordinator'::public.app_role)
  WITH CHECK (public.current_user_role() = 'coordinator'::public.app_role);

-- 6) Coordenador pode gerenciar mission_analysts (atribuir/remover)
DROP POLICY IF EXISTS mission_analysts_coordinator_write ON public.mission_analysts;
CREATE POLICY mission_analysts_coordinator_write ON public.mission_analysts
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'coordinator'::public.app_role)
  WITH CHECK (public.current_user_role() = 'coordinator'::public.app_role);

-- 7) Novo tipo de notificação: report_request (analista solicita parecer ao coordenador)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'doubt','observation','status_change','feedback','mission_started',
    'mission_pending_acceptance','mission_accepted','mission_declined',
    'date_proposal','date_proposal_response','deadline_alert','status_update',
    'new_evidence','new_comment','report_ready','assignment','report_request'
  ]));
