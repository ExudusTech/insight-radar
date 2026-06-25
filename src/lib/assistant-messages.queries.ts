import { supabase } from "@/integrations/supabase/client";

export const assistantMessagesKey = (targetId: string, block: string) =>
  ["assistant-messages", targetId, block] as const;

export async function listAssistantMessages(targetId: string, block: string) {
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("*")
    .eq("target_id", targetId)
    .eq("block", block)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function saveAssistantMessage(params: {
  missionId: string;
  targetId: string;
  block: string;
  analystId: string;
  role: "user" | "assistant";
  content: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("assistant_messages").insert({
    mission_id: params.missionId,
    target_id: params.targetId,
    block: params.block,
    analyst_id: params.analystId,
    role: params.role,
    content: params.content,
    metadata: (params.metadata ?? {}) as never,
  });
  if (error) throw error;
}