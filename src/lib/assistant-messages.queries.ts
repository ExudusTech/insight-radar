import { supabase } from "@/integrations/supabase/client";

/**
 * A conversa do assistente é única por alvo (não por bloco).
 * O campo `block` na tabela é mantido apenas por compatibilidade — usamos "all".
 */
export const ASSISTANT_UNIFIED_BLOCK = "all";

export const assistantMessagesKey = (targetId: string) =>
  ["assistant-messages", targetId] as const;

export async function listAssistantMessages(targetId: string) {
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("*")
    .eq("target_id", targetId)
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
  let timeSpent: number | null = null;
  if (params.role === "user") {
    // Find the previous user message from this analyst for this target.
    const { data: prev } = await supabase
      .from("assistant_messages")
      .select("created_at")
      .eq("target_id", params.targetId)
      .eq("analyst_id", params.analystId)
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prev?.created_at) {
      const diffSec = Math.floor(
        (Date.now() - new Date(prev.created_at).getTime()) / 1000,
      );
      // Cap at 30 min; above that = new session.
      timeSpent = diffSec > 30 * 60 ? 0 : Math.max(0, diffSec);
    } else {
      timeSpent = 0;
    }
  }
  const { error } = await supabase.from("assistant_messages").insert({
    mission_id: params.missionId,
    target_id: params.targetId,
    block: params.block,
    analyst_id: params.analystId,
    role: params.role,
    content: params.content,
    metadata: (params.metadata ?? {}) as never,
    time_spent_seconds: timeSpent,
  });
  if (error) throw error;
}

// ============================================================
// Comparative chat (per mission, target_id IS NULL)
// ============================================================

export const comparativeMessagesKey = (missionId: string, sessionId: string | null) =>
  ["assistant-messages", "comparative", missionId, sessionId] as const;

export type ComparativeMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  session_id: string | null;
  created_at: string;
};

/**
 * Retorna a sessão mais recente (session_id) usada pelo usuário atual
 * no chat comparativo dessa missão. Retorna null se não houver histórico.
 */
export async function getLatestComparativeSession(
  missionId: string,
  analystId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("session_id")
    .eq("mission_id", missionId)
    .eq("analyst_id", analystId)
    .is("target_id", null)
    .not("session_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.session_id ?? null;
}

export async function listComparativeMessages(
  missionId: string,
  sessionId: string,
): Promise<ComparativeMessage[]> {
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("id, role, content, session_id, created_at")
    .eq("mission_id", missionId)
    .eq("session_id", sessionId)
    .is("target_id", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ComparativeMessage[];
}

export async function saveComparativeMessage(params: {
  missionId: string;
  analystId: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
}) {
  const { error } = await supabase.from("assistant_messages").insert({
    mission_id: params.missionId,
    target_id: null,
    block: ASSISTANT_UNIFIED_BLOCK,
    analyst_id: params.analystId,
    session_id: params.sessionId,
    role: params.role,
    content: params.content,
  });
  if (error) throw error;
}