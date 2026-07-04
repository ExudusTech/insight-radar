import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  missionId: z.string().uuid(),
  targetId: z.string().uuid(),
  targetName: z.string().min(1).max(200),
});

/**
 * Analista solicita ao coordenador que um parecer seja gerado para um concorrente.
 * Cria notificações para todos os usuários com role = 'coordinator' (fan-out).
 */
export const requestCompetitorBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Caller must have access to the mission
    const { data: canAccess, error: accessErr } = await supabase.rpc("can_access_mission", {
      _mission_id: data.missionId,
    });
    if (accessErr) throw new Error(accessErr.message);
    if (!canAccess) throw new Error("Sem permissão para esta missão.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Nome do analista solicitante
    const { data: caller } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();
    const callerName = caller?.full_name?.trim() || caller?.email || "Analista";

    // Todos os coordenadores
    const { data: coordRoles, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "coordinator");
    if (rolesErr) throw new Error(rolesErr.message);

    const coordinatorIds = Array.from(new Set((coordRoles ?? []).map((r) => r.user_id)));
    if (coordinatorIds.length === 0) {
      return { notified: 0 };
    }

    const message = `Analista ${callerName} indica que ${data.targetName} está pronto para parecer.`;
    const rows = coordinatorIds.map((cid) => ({
      user_id: cid,
      origin_user_id: userId,
      mission_id: data.missionId,
      target_id: data.targetId,
      type: "report_request",
      message,
    }));

    const { error: insErr } = await supabaseAdmin.from("notifications").insert(rows);
    if (insErr) throw new Error(insErr.message);

    // Activity log
    await supabaseAdmin.from("activity_logs").insert({
      user_id: userId,
      mission_id: data.missionId,
      action: "brief_requested",
      entity_type: "target",
      entity_id: data.targetId,
      details: { target_name: data.targetName, coordinators_notified: coordinatorIds.length },
    });

    return { notified: coordinatorIds.length };
  });
