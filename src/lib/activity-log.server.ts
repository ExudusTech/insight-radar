// Server-side activity log helper. Best-effort — never throws so that a
// logging failure cannot break the primary operation. Uses the admin client
// (RLS bypass) so writes always succeed, but attribution is always to the
// authenticated caller passed in `userId`.

export type ServerActivityParams = {
  userId: string;
  missionId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
};

export async function logServerActivity(params: ServerActivityParams): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("activity_logs").insert({
      user_id: params.userId,
      mission_id: params.missionId ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      details: (params.details ?? {}) as never,
    });
  } catch (e) {
    console.warn("[activity_logs] insert failed", params.action, e);
  }
}