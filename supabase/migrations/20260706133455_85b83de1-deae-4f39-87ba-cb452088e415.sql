-- Restrict policies to authenticated role for defense-in-depth
ALTER POLICY "contractor_mission_messages" ON public.assistant_messages TO authenticated;
ALTER POLICY "notifications_superadmin_all" ON public.notifications TO authenticated;
ALTER POLICY "Analysts and superadmins can insert timeline events" ON public.target_timeline_events TO authenticated;
ALTER POLICY "Superadmin can delete timeline events" ON public.target_timeline_events TO authenticated;