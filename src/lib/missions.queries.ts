import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Mission = Tables<"missions">;
export type Profile = Tables<"profiles">;

export const missionsListKey = ["missions", "list"] as const;
export const missionDetailKey = (id: string) => ["missions", "detail", id] as const;
export const missionAnalystsKey = (id: string) => ["missions", id, "analysts"] as const;
export const profilesKey = ["profiles", "list"] as const;

export async function listMissions() {
  const { data, error } = await supabase
    .from("missions")
    .select("*, contractor:profiles!missions_contractor_id_fkey(id, full_name, email)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getMission(id: string) {
  const { data, error } = await supabase
    .from("missions")
    .select(
      "*, contractor:profiles!missions_contractor_id_fkey(id, full_name, email), responsible:profiles!missions_responsible_id_fkey(id, full_name, email)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listMissionAnalysts(missionId: string) {
  const { data, error } = await supabase
    .from("mission_analysts")
    .select("analyst_id, analyst:profiles(id, full_name, email)")
    .eq("mission_id", missionId);
  if (error) throw error;
  return data ?? [];
}

export async function listProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, organization");
  if (error) throw error;
  return data ?? [];
}

export async function listProfilesWithRole(role: "contractor" | "analyst" | "superadmin") {
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id, profile:profiles!user_roles_user_id_fkey(id, full_name, email)")
    .eq("role", role);
  if (error) throw error;
  return (data ?? [])
    .map((r) => r.profile)
    .filter((p): p is { id: string; full_name: string | null; email: string | null } => !!p);
}

export type CreateMissionInput = {
  name: string;
  description?: string | null;
  objective?: string | null;
  segment?: string | null;
  contractor_id?: string | null;
  deadline_first?: string | null;
  deadline_final?: string | null;
  target_label: string;
  analyst_ids: string[];
};

export async function createMission(input: CreateMissionInput) {
  const { analyst_ids, ...rest } = input;
  const { data: mission, error } = await supabase
    .from("missions")
    .insert({ ...rest })
    .select("*")
    .single();
  if (error) throw error;

  if (analyst_ids.length > 0) {
    const rows = analyst_ids.map((analyst_id) => ({ mission_id: mission.id, analyst_id }));
    const { error: linkErr } = await supabase.from("mission_analysts").insert(rows);
    if (linkErr) throw linkErr;
  }

  await supabase.from("activity_logs").insert({
    mission_id: mission.id,
    action: "mission_created",
    entity_type: "mission",
    entity_id: mission.id,
    details: { name: mission.name },
  });

  return mission;
}

export async function updateMission(id: string, patch: Partial<CreateMissionInput>) {
  const { analyst_ids, ...rest } = patch;
  const { data, error } = await supabase
    .from("missions")
    .update(rest)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  if (analyst_ids) {
    await supabase.from("mission_analysts").delete().eq("mission_id", id);
    if (analyst_ids.length > 0) {
      await supabase
        .from("mission_analysts")
        .insert(analyst_ids.map((analyst_id) => ({ mission_id: id, analyst_id })));
    }
  }

  return data;
}