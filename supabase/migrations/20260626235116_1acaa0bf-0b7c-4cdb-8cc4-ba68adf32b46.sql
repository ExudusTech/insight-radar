
-- 1. Profiles: bloquear self-update do status
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;

CREATE POLICY profiles_self_update_safe ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND status IS NOT DISTINCT FROM (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid())
);

CREATE POLICY profiles_superadmin_update ON public.profiles
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'superadmin'))
WITH CHECK (has_role(auth.uid(), 'superadmin'));

-- 2. Assistant messages: corrigir policy do superadmin
DROP POLICY IF EXISTS superadmin_all_messages ON public.assistant_messages;

CREATE POLICY superadmin_all_messages ON public.assistant_messages
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'superadmin'));

-- 3. Assistant messages: separar INSERT do client (role='user' apenas) do ALL
DROP POLICY IF EXISTS analyst_own_messages ON public.assistant_messages;

CREATE POLICY analyst_own_messages_select ON public.assistant_messages
FOR SELECT TO authenticated
USING (analyst_id = auth.uid());

CREATE POLICY analyst_own_messages_insert ON public.assistant_messages
FOR INSERT TO authenticated
WITH CHECK (analyst_id = auth.uid() AND role = 'user');

CREATE POLICY analyst_own_messages_update ON public.assistant_messages
FOR UPDATE TO authenticated
USING (analyst_id = auth.uid())
WITH CHECK (analyst_id = auth.uid() AND role = 'user');

CREATE POLICY analyst_own_messages_delete ON public.assistant_messages
FOR DELETE TO authenticated
USING (analyst_id = auth.uid());
