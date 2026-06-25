import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { sendNotifications } from "@/lib/notifications.functions";

export type Notification = Tables<"notifications">;
export type NotificationType = "doubt" | "observation" | "feedback" | "blocking";

export const notificationsKey = (userId: string) => ["notifications", userId] as const;
export const notificationsUnreadKey = (userId: string) =>
  ["notifications", userId, "unread"] as const;

export async function listNotifications(userId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "*, origin:profiles!notifications_origin_user_id_fkey(id, full_name, email), mission:missions(id, name), target:targets(id, name)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function countUnread(userId: string) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markAsRead(id: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markAllAsRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
}

export type NewNotification = {
  user_id: string;
  origin_user_id?: string | null;
  mission_id?: string | null;
  target_id?: string | null;
  block?: string | null;
  type: NotificationType | string;
  message: string;
};

export async function createNotification(n: NewNotification) {
  await sendNotifications({ data: { notifications: [n] } });
}

export async function createNotifications(rows: NewNotification[]) {
  if (rows.length === 0) return;
  await sendNotifications({ data: { notifications: rows } });
}

export async function listSuperadminIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "superadmin");
  if (error) throw error;
  return (data ?? []).map((r) => r.user_id);
}

export async function getMissionContractorId(missionId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("missions")
    .select("contractor_id")
    .eq("id", missionId)
    .maybeSingle();
  if (error) throw error;
  return data?.contractor_id ?? null;
}

export const NOTIFICATION_TYPE_LABEL: Record<string, string> = {
  doubt: "Dúvida",
  observation: "Observação",
  feedback: "Feedback",
  blocking: "Bloqueante",
};