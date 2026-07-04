import { supabase } from "@/integrations/supabase/client";
import { sendCoordinationMessage } from "@/lib/coordination-messages.functions";

export type CoordinationMessage = {
  id: string;
  created_at: string;
  mission_id: string;
  sender_id: string | null;
  receiver_id: string | null;
  target_id: string | null;
  content: string;
  read_at: string | null;
  sender: { id: string; full_name: string | null; email: string | null } | null;
  receiver: { id: string; full_name: string | null; email: string | null } | null;
  target: { id: string; name: string } | null;
};

export const coordinationThreadKey = (
  missionId: string,
  otherUserId: string,
) => ["coordination-messages", missionId, otherUserId] as const;

export const coordinationUnreadKey = (userId: string) =>
  ["coordination-messages", "unread", userId] as const;

export const coordinationInboxKey = (userId: string) =>
  ["coordination-messages", "inbox", userId] as const;

export async function listThread(
  missionId: string,
  otherUserId: string,
  currentUserId: string,
): Promise<CoordinationMessage[]> {
  const { data, error } = await supabase
    .from("coordination_messages")
    .select(
      `id, created_at, mission_id, sender_id, receiver_id, target_id, content, read_at,
       sender:profiles!coordination_messages_sender_id_fkey(id, full_name, email),
       receiver:profiles!coordination_messages_receiver_id_fkey(id, full_name, email),
       target:targets(id, name)`,
    )
    .eq("mission_id", missionId)
    .or(
      `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`,
    )
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CoordinationMessage[];
}

export async function countUnreadCoordination(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("coordination_messages")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", userId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export type CoordinationInboxEntry = {
  mission_id: string;
  mission_name: string | null;
  other_user_id: string;
  other_user_name: string | null;
  unread: number;
  last_message_at: string;
  last_message_preview: string;
};

export async function listCoordinationInbox(
  userId: string,
): Promise<CoordinationInboxEntry[]> {
  const { data, error } = await supabase
    .from("coordination_messages")
    .select(
      `id, created_at, mission_id, sender_id, receiver_id, content, read_at,
       mission:missions(id, name),
       sender:profiles!coordination_messages_sender_id_fkey(id, full_name, email),
       receiver:profiles!coordination_messages_receiver_id_fkey(id, full_name, email)`,
    )
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  const rows =
    (data ?? []) as unknown as Array<{
      id: string;
      created_at: string;
      mission_id: string;
      sender_id: string | null;
      receiver_id: string | null;
      content: string;
      read_at: string | null;
      mission: { id: string; name: string | null } | null;
      sender: { id: string; full_name: string | null; email: string | null } | null;
      receiver: { id: string; full_name: string | null; email: string | null } | null;
    }>;

  const map = new Map<string, CoordinationInboxEntry>();
  for (const r of rows) {
    const other =
      r.sender_id === userId ? r.receiver : r.sender;
    const otherId =
      r.sender_id === userId ? r.receiver_id : r.sender_id;
    if (!otherId) continue;
    const key = `${r.mission_id}::${otherId}`;
    const existing = map.get(key);
    const isUnread = r.receiver_id === userId && !r.read_at;
    if (!existing) {
      map.set(key, {
        mission_id: r.mission_id,
        mission_name: r.mission?.name ?? null,
        other_user_id: otherId,
        other_user_name: other?.full_name ?? other?.email ?? null,
        unread: isUnread ? 1 : 0,
        last_message_at: r.created_at,
        last_message_preview: r.content.slice(0, 140),
      });
    } else if (isUnread) {
      existing.unread += 1;
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.last_message_at < b.last_message_at ? 1 : -1,
  );
}

export async function markThreadRead(
  missionId: string,
  senderId: string,
  currentUserId: string,
) {
  const { error } = await supabase
    .from("coordination_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("mission_id", missionId)
    .eq("sender_id", senderId)
    .eq("receiver_id", currentUserId)
    .is("read_at", null);
  if (error) throw error;
}

export async function sendMessage(input: {
  mission_id: string;
  receiver_id: string;
  content: string;
  target_id?: string | null;
}) {
  await sendCoordinationMessage({ data: input });
}
