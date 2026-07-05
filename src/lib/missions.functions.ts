import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logServerActivity } from "@/lib/activity-log.server";

const inputSchema = z.object({
  missionId: z.string().uuid(),
});

export const assignAnalystToMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorize: caller must be superadmin, coordinator, OR the mission's primary contractor
    const [{ data: isSuperadmin }, { data: isCoordinator }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "superadmin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "coordinator" }),
    ]);
    const { data: mission, error: missionErr } = await supabase
      .from("missions")
      .select("id, contractor_id")
      .eq("id", data.missionId)
      .maybeSingle();
    if (missionErr) throw new Error(missionErr.message);
    if (!mission) throw new Error("Missão não encontrada.");
    if (!isSuperadmin && !isCoordinator && mission.contractor_id !== userId) {
      throw new Error("Sem permissão para atribuir analista a esta missão.");
    }

    // Privileged reads/writes: pool discovery + assignment bypass RLS
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roleRows, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "analyst");
    if (rolesErr) throw new Error(rolesErr.message);
    const analystIds = (roleRows ?? []).map((r) => r.user_id);
    if (analystIds.length === 0) return { assignedId: null as string | null };

    const { data: available, error: availErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .in("id", analystIds)
      .eq("accepts_missions", true);
    if (availErr) throw new Error(availErr.message);
    if (!available || available.length === 0) return { assignedId: null };

    // Check for existing assignment to avoid duplicate constraint violation
    const { data: existing } = await supabaseAdmin
      .from("mission_analysts")
      .select("analyst_id")
      .eq("mission_id", data.missionId)
      .maybeSingle();

    if (existing) {
      // Already has an assigned analyst; do not reassign
      return { assignedId: existing.analyst_id };
    }

    const counts = await Promise.all(
      available.map(async (a) => {
        const { count } = await supabaseAdmin
          .from("mission_analysts")
          .select("*", { count: "exact", head: true })
          .eq("analyst_id", a.id);
        return { id: a.id, count: count ?? 0 };
      }),
    );
    counts.sort((a, b) => a.count - b.count);
    const chosen = counts[0].id;

    const { error: insErr } = await supabaseAdmin
      .from("mission_analysts")
      .insert({ mission_id: data.missionId, analyst_id: chosen });
    if (insErr) throw new Error(insErr.message);

    await logServerActivity({
      userId,
      missionId: data.missionId,
      action: "mission_analyst_assigned",
      entityType: "mission",
      entityId: data.missionId,
      details: { analyst_id: chosen, pool_size: available.length },
    });

    return { assignedId: chosen as string | null };
  });