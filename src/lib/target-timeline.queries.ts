import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { logActivity } from "@/lib/activity-log";

export type TimelineEvent = Tables<"target_timeline_events">;

export type TimelineEventType =
  | "contato_inicial"
  | "resposta_recebida"
  | "reuniao_agendada"
  | "reuniao_realizada"
  | "proposta_recebida"
  | "follow_up_recebido"
  | "negociacao"
  | "encerramento"
  | "outro"
  | "interacao_iniciada"
  | "screenshot_enviado"
  | "extracao_campos"
  | "roteiro_gerado"
  | "parecer_solicitado";

export const TIMELINE_EVENT_TYPES: TimelineEventType[] = [
  "contato_inicial",
  "resposta_recebida",
  "reuniao_agendada",
  "reuniao_realizada",
  "proposta_recebida",
  "follow_up_recebido",
  "negociacao",
  "encerramento",
  "outro",
];

export const timelineEventsByTargetKey = (targetId: string) =>
  ["target-timeline", targetId] as const;

export async function listTimelineEvents(targetId: string): Promise<TimelineEvent[]> {
  const { data, error } = await supabase
    .from("target_timeline_events")
    .select("*")
    .eq("target_id", targetId)
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TimelineEvent[];
}

export async function createManualTimelineEvent(params: {
  missionId: string;
  targetId: string;
  eventType: TimelineEventType;
  description: string;
  eventDate: string;
  createdBy: string;
}) {
  const { error } = await supabase.from("target_timeline_events").insert({
    mission_id: params.missionId,
    target_id: params.targetId,
    event_type: params.eventType,
    description: params.description,
    event_date: params.eventDate,
    source: "manual",
    created_by: params.createdBy,
  });
  if (error) throw error;
  await logActivity({
    userId: params.createdBy,
    missionId: params.missionId,
    action: "timeline_event_created",
    entityType: "target",
    entityId: params.targetId,
    details: {
      event_type: params.eventType,
      event_date: params.eventDate,
      source: "manual",
    },
  });
}

export async function createSystemTimelineEvent(params: {
  missionId: string;
  targetId: string;
  eventType: TimelineEventType;
  description: string;
  createdBy: string;
}) {
  const { error } = await supabase.from("target_timeline_events").insert({
    mission_id: params.missionId,
    target_id: params.targetId,
    event_type: params.eventType,
    description: params.description,
    event_date: new Date().toISOString().slice(0, 10),
    source: "system",
    created_by: params.createdBy,
  });
  if (error) console.warn("[timeline] system event insert failed", error);
}