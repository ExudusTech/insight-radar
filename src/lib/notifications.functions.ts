import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logServerActivity } from "@/lib/activity-log.server";

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

    // Caller must be superadmin to send notifications without a mission context.
    const { data: isSuperadmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "superadmin",
    });
    if (roleErr) throw new Error(roleErr.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Per-notification validation: caller has mission access AND recipient is a member
    for (const n of data.notifications) {
      if (!n.mission_id) {
        if (!isSuperadmin) throw new Error("Forbidden: mission_id required");
        continue;
      }
      // Caller access
      const { data: callerOk, error: callerErr } = await supabase.rpc(
        "can_access_mission",
        { _mission_id: n.mission_id },
      );
      if (callerErr) throw new Error(callerErr.message);
      if (!callerOk) throw new Error("Forbidden");

      // Recipient membership: superadmin, contractor (direct or via mission_contractors),
      // or analyst (via mission_analysts).
      const [missionRes, mcRes, maRes, roleRes] = await Promise.all([
        supabaseAdmin
          .from("missions")
          .select("contractor_id")
          .eq("id", n.mission_id)
          .maybeSingle(),
        supabaseAdmin
          .from("mission_contractors")
          .select("contractor_id")
          .eq("mission_id", n.mission_id)
          .eq("contractor_id", n.user_id)
          .maybeSingle(),
        supabaseAdmin
          .from("mission_analysts")
          .select("analyst_id")
          .eq("mission_id", n.mission_id)
          .eq("analyst_id", n.user_id)
          .maybeSingle(),
        supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", n.user_id)
          .eq("role", "superadmin")
          .maybeSingle(),
      ]);
      const recipientIsMember =
        missionRes.data?.contractor_id === n.user_id ||
        !!mcRes.data ||
        !!maRes.data ||
        !!roleRes.data;
      if (!recipientIsMember) {
        throw new Error("Forbidden: recipient is not a member of this mission");
      }
    }

    // Force origin to caller; users cannot spoof origin
    const rows = data.notifications.map((n) => ({
      ...n,
      origin_user_id: userId,
    }));

    const { error } = await supabaseAdmin.from("notifications").insert(rows);
    if (error) throw new Error(error.message);
    for (const n of rows) {
      await logServerActivity({
        userId,
        missionId: n.mission_id ?? null,
        action: "notification_dispatched",
        entityType: "notification",
        entityId: n.user_id,
        details: {
          recipient_id: n.user_id,
          type: n.type,
          target_id: n.target_id ?? null,
          preview: n.message?.slice(0, 120) ?? null,
        },
      });
    }
    return { ok: true, count: rows.length };
  });