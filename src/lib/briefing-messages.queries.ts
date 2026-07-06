import { supabase } from "@/integrations/supabase/client";

export type BriefingMessage = {
  id: string;
  mission_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export const briefingMessagesKey = (missionId: string) => ["briefing_messages", missionId] as const;

export async function listBriefingMessages(missionId: string): Promise<BriefingMessage[]> {
  const { data, error } = await supabase
    .from("briefing_messages")
    .select("id, mission_id, user_id, role, content, created_at")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BriefingMessage[];
}