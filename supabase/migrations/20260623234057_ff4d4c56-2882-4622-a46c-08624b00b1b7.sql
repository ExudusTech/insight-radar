
-- RLS policies for mission-documents bucket on storage.objects
-- Access controlled via can_access_mission() based on first path segment (mission_id)

CREATE POLICY "mission_docs_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'mission-documents'
    AND public.can_access_mission(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "mission_docs_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mission-documents'
    AND public.can_access_mission(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "mission_docs_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'mission-documents'
    AND public.can_access_mission(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "mission_docs_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'mission-documents'
    AND public.can_access_mission(((storage.foldername(name))[1])::uuid)
  );
