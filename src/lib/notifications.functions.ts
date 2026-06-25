import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const NotificationSchema = z.object({
  user_id: z.string().uuid(),
  origin_user_id: z.string().uuid().nullable().optional(),
  mission_id: z.string().uuid().nullable().optional(),
  target_id: z.string().uuid().nullable().optional(),
  block: z.string().nullable().optional(),
  type: z.string().max(40),
  message: z.string().max(2000),
});

const InputSchema = z.object({
  notifications: z.array(NotificationSchema).min(1).max(50),
});

/**
 * Server-side notification dispatch. Validates that the caller has access to
 * the mission referenced in each notification before inserting via the admin
 * client (RLS only allows self-targeted inserts from clients).
 */
export const sendNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Validate mission access for each notification (skip if no mission_id)
    const missionIds = Array.from(
      new Set(
        data.notifications
          .map((n) => n.mission_id)
          .filter((m): m is string => !!m),
      ),
    );
    for (const missionId of missionIds) {
      const { data: ok, error } = await supabase.rpc("can_access_mission", {
        _mission_id: missionId,
      });
      if (error) throw new Error(error.message);
      if (!ok) throw new Error("Forbidden");
    }

    // Force origin to caller; users cannot spoof origin
    const rows = data.notifications.map((n) => ({
      ...n,
      origin_user_id: userId,
    }));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("notifications").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });