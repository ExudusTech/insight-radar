## Fix security scan findings

Address the 2 Critical issues and 2 Warning issues from the security panel.

### 1. Critical — Role check in `missionBriefingAssistant`

**File:** `src/lib/mission-briefing.functions.ts`

Add server-side role gate at the start of `.handler()`, before any admin-client write:

```ts
const [{ data: isContractor }, { data: isSuperadmin }] = await Promise.all([
  context.supabase.rpc("has_role", { _user_id: context.userId, _role: "contractor" }),
  context.supabase.rpc("has_role", { _user_id: context.userId, _role: "superadmin" }),
]);
if (!isContractor && !isSuperadmin) throw new Error("Forbidden");
```

Also gate `/missions/new` route: add `beforeLoad` in `src/routes/_authenticated/missions.new.tsx` that checks the same roles via `supabase.rpc("has_role", ...)` and `redirect({ to: "/dashboard" })` when neither role is present.

### 2. Critical — Self-escalation via `can_view_strategic`

Migration to tighten `profiles_self_update_safe`:

```sql
DROP POLICY IF EXISTS profiles_self_update_safe ON public.profiles;
CREATE POLICY profiles_self_update_safe ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND status IS NOT DISTINCT FROM (SELECT p.status FROM public.profiles p WHERE p.id = auth.uid())
  AND accepts_missions IS NOT DISTINCT FROM (SELECT p.accepts_missions FROM public.profiles p WHERE p.id = auth.uid())
  AND can_view_strategic IS NOT DISTINCT FROM (SELECT p.can_view_strategic FROM public.profiles p WHERE p.id = auth.uid())
);
```

### 3. Warnings — Restrict RLS policies from `public` to `authenticated`

Same migration, recreate the flagged policies with `TO authenticated` (conditions unchanged):

- `mission_contractors`: `mc_analyst_read`, `mc_contractor_self_read`, `mc_superadmin_all`
- `missions`: `missions_contractor_insert`, `missions_contractor_update`, `missions_superadmin_all`
- `products`: `products_client_read`, `products_superadmin_all`
- `notifications`: `notifications_self_read`, `notifications_self_update`

For each: `DROP POLICY ... ; CREATE POLICY ... TO authenticated USING (...) [WITH CHECK (...)]` preserving the current expressions (read via `supabase--read_query` during build to avoid drift).

### 4. Mark findings resolved

After migration approved + code edit shipped, call `security--manage_security_finding` with `mark_as_fixed` for the 2 criticals and 2 warnings; leave the "activity_logs expected" info finding as-is (already noted as expected).

### Out of scope

- Dependency vulnerabilities (7) — separate review.
- The ignored issues (2) shown in the panel.
