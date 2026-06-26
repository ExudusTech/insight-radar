import { supabase } from "@/integrations/supabase/client";

export async function logActivity(params: {
  userId: string;
  missionId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
}) {
  // fire-and-forget: nunca deve bloquear ou falhar a operação principal
  void supabase
    .from("activity_logs")
    .insert({
      user_id: params.userId,
      mission_id: params.missionId ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      details: params.details ?? {},
    })
    .then(
      () => {},
      () => {},
    );
}