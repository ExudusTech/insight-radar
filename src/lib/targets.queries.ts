import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { TargetStatus, TargetPriority } from "./target-status";

export type Target = Tables<"targets">;

export const targetsByMissionKey = (missionId: string) =>
  ["targets", "by-mission", missionId] as const;
export const targetDetailKey = (id: string) => ["targets", "detail", id] as const;

export async function listTargetsByMission(missionId: string) {
  const { data, error } = await supabase
    .from("targets")
    .select("*, analyst:profiles!targets_analyst_id_fkey(id, full_name, email)")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTarget(id: string) {
  const { data, error } = await supabase
    .from("targets")
    .select("*, analyst:profiles!targets_analyst_id_fkey(id, full_name, email)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type CreateTargetInput = {
  mission_id: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  site?: string | null;
  instagram?: string | null;
  whatsapp?: string | null;
  linkedin?: string | null;
  email?: string | null;
  other_links?: string | null;
  priority: TargetPriority;
  notes?: string | null;
  status?: TargetStatus;
  analyst_id?: string | null;
};

export async function createTarget(input: CreateTargetInput) {
  const { data, error } = await supabase
    .from("targets")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;

  await supabase.from("activity_logs").insert({
    mission_id: input.mission_id,
    action: "target_created",
    entity_type: "target",
    entity_id: data.id,
    details: { name: data.name },
  });

  return data;
}

export async function updateTarget(id: string, patch: Partial<CreateTargetInput>) {
  const { data, error } = await supabase
    .from("targets")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateTargetStatus(
  id: string,
  toStatus: TargetStatus,
  fromStatus: TargetStatus,
  missionId: string,
) {
  const { data, error } = await supabase
    .from("targets")
    .update({ status: toStatus })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  await supabase.from("activity_logs").insert({
    mission_id: missionId,
    action: "target_status_changed",
    entity_type: "target",
    entity_id: id,
    details: { from: fromStatus, to: toStatus },
  });

  return data;
}