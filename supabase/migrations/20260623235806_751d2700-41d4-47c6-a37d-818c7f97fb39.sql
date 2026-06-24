
CREATE POLICY "mission_evidences_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'mission-evidences'
    AND public.can_access_mission(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "mission_evidences_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mission-evidences'
    AND public.can_access_mission(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "mission_evidences_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'mission-evidences'
    AND public.can_access_mission(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "mission_evidences_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'mission-evidences'
    AND public.can_access_mission(((storage.foldername(name))[1])::uuid)
  );
