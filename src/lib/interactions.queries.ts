import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { TargetStatus } from "./target-status";

export type Interaction = Tables<"interactions">;

export const INTERACTION_EVENT_TYPES = [
  "primeiro_contato",
  "resposta_recebida",
  "call_realizada",
  "proposta_solicitada",
  "proposta_recebida",
  "followup",
  "outro",
] as const;
export type InteractionEventType = (typeof INTERACTION_EVENT_TYPES)[number];

export const INTERACTION_EVENT_LABEL: Record<InteractionEventType, string> = {
  primeiro_contato: "Primeiro contato",
  resposta_recebida: "Resposta recebida",
  call_realizada: "Call realizada",
  proposta_solicitada: "Proposta solicitada",
  proposta_recebida: "Proposta recebida",
  followup: "Follow-up",
  outro: "Outro",
};

export const INTERACTION_CHANNELS = [
  "WhatsApp",
  "Instagram",
  "LinkedIn",
  "Email",
  "Telefone",
  "Outro",
] as const;
export type InteractionChannel = (typeof INTERACTION_CHANNELS)[number];

export const interactionsByTargetKey = (targetId: string) =>
  ["interactions", "by-target", targetId] as const;

export async function listInteractionsByTarget(targetId: string) {
  const { data, error } = await supabase
    .from("interactions")
    .select("*")
    .eq("target_id", targetId)
    .order("event_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type CreateInteractionInput = {
  mission_id: string;
  target_id: string;
  event_type: InteractionEventType;
  channel?: InteractionChannel | null;
  event_at: string; // ISO
  content?: string | null;
  next_action?: string | null;
  status_after?: TargetStatus | null;
  created_by: string;
};

export async function createInteraction(input: CreateInteractionInput) {
  const { data, error } = await supabase
    .from("interactions")
    .insert({ ...input, attachments: [] as never })
    .select("*")
    .single();
  if (error) throw error;

  if (input.status_after) {
    const { data: prev } = await supabase
      .from("targets")
      .select("status")
      .eq("id", input.target_id)
      .single();
    const fromStatus = prev?.status;
    await supabase
      .from("targets")
      .update({ status: input.status_after })
      .eq("id", input.target_id);
    await supabase.from("activity_logs").insert({
      mission_id: input.mission_id,
      user_id: input.created_by,
      action: "target_status_changed",
      entity_type: "target",
      entity_id: input.target_id,
      details: { from: fromStatus, to: input.status_after, via: "interaction" },
    });
  }

  return data;
}