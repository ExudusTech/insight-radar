DROP POLICY IF EXISTS profiles_self_update_safe ON public.profiles;

CREATE POLICY profiles_self_update_safe ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND status IS NOT DISTINCT FROM (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid())
  AND accepts_missions IS NOT DISTINCT FROM (SELECT p.accepts_missions FROM public.profiles p WHERE p.id = auth.uid())
);