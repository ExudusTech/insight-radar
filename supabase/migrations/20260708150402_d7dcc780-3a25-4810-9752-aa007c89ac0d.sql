-- Add WITH CHECK to storage UPDATE policies
DROP POLICY IF EXISTS mission_docs_update ON storage.objects;
CREATE POLICY mission_docs_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'mission-documents' AND can_access_mission(((storage.foldername(name))[1])::uuid))
  WITH CHECK (bucket_id = 'mission-documents' AND can_access_mission(((storage.foldername(name))[1])::uuid));

DROP POLICY IF EXISTS mission_evidences_update ON storage.objects;
CREATE POLICY mission_evidences_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'mission-evidences' AND can_access_mission(((storage.foldername(name))[1])::uuid))
  WITH CHECK (bucket_id = 'mission-evidences' AND can_access_mission(((storage.foldername(name))[1])::uuid));

-- Restrict public role → authenticated on defense-in-depth policies
DROP POLICY IF EXISTS briefing_read ON public.briefing_messages;
CREATE POLICY briefing_read ON public.briefing_messages
  FOR SELECT TO authenticated
  USING (can_read_mission(mission_id));

DROP POLICY IF EXISTS briefing_insert ON public.briefing_messages;
CREATE POLICY briefing_insert ON public.briefing_messages
  FOR INSERT TO authenticated
  WITH CHECK (can_access_mission(mission_id));

DROP POLICY IF EXISTS profiles_coordinator_read ON public.profiles;
CREATE POLICY profiles_coordinator_read ON public.profiles
  FOR SELECT TO authenticated
  USING (current_user_role() = 'coordinator'::app_role);

DROP POLICY IF EXISTS user_roles_coordinator_read ON public.user_roles;
CREATE POLICY user_roles_coordinator_read ON public.user_roles
  FOR SELECT TO authenticated
  USING (current_user_role() = 'coordinator'::app_role);