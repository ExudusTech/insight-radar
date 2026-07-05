import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logServerActivity } from "@/lib/activity-log.server";

const InputSchema = z.object({
  mission_id: z.string().uuid(),
  receiver_id: z.string().uuid(),
  content: z.string().trim().min(1).max(4000),
  target_id: z.string().uuid().nullable().optional(),
});

/**
 * Sends an internal coordination message between coordinator and analyst
 * scoped to a mission, and emits a companion notification to the receiver.
 */
export const sendCoordinationMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify caller has access to the mission
    const { data: canAccess, error: accessErr } = await supabase.rpc(
      "can_access_mission",
      { _mission_id: data.mission_id },
    );
    if (accessErr) throw new Error(accessErr.message);
    if (!canAccess) throw new Error("Forbidden");

    // Verify receiver is a member of the mission (coordinator/superadmin OR
    // contractor OR analyst assigned to mission)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [missionRes, mcRes, maRes, elevatedRes] = await Promise.all([
      supabaseAdmin
        .from("missions")
        .select("contractor_id, name")
        .eq("id", data.mission_id)
        .maybeSingle(),
      supabaseAdmin
        .from("mission_contractors")
        .select("contractor_id")
        .eq("mission_id", data.mission_id)
        .eq("contractor_id", data.receiver_id)
        .maybeSingle(),
      supabaseAdmin
        .from("mission_analysts")
        .select("analyst_id")
        .eq("mission_id", data.mission_id)
        .eq("analyst_id", data.receiver_id)
        .maybeSingle(),
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", data.receiver_id)
        .in("role", ["superadmin", "coordinator"])
        .maybeSingle(),
    ]);
    const isMember =
      missionRes.data?.contractor_id === data.receiver_id ||
      !!mcRes.data ||
      !!maRes.data ||
      !!elevatedRes.data;
    if (!isMember) throw new Error("Forbidden: receiver not in mission");

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("coordination_messages")
      .insert({
        mission_id: data.mission_id,
        sender_id: userId,
        receiver_id: data.receiver_id,
        target_id: data.target_id ?? null,
        content: data.content.trim(),
      })
      .select("id")
      .single();
    if (insertErr) throw new Error(insertErr.message);

    const preview = data.content.trim().slice(0, 180);
    const { error: notifErr } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: data.receiver_id,
        origin_user_id: userId,
        mission_id: data.mission_id,
        target_id: data.target_id ?? null,
        type: "coordination_message",
        message: preview,
      });
    if (notifErr) throw new Error(notifErr.message);

    await logServerActivity({
      userId,
      missionId: data.mission_id,
      action: "coordination_message_sent",
      entityType: "coordination_message",
      entityId: inserted.id,
      details: {
        recipient_id: data.receiver_id,
        target_id: data.target_id ?? null,
        length: data.content.trim().length,
      },
    });

    return { ok: true, id: inserted.id };
  });
