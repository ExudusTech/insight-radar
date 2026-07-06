import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Mission = Tables<"missions">;
export type Profile = Tables<"profiles">;

export const missionsListKey = ["missions", "list"] as const;
export const missionDetailKey = (id: string) => ["missions", "detail", id] as const;
export const missionAnalystsKey = (id: string) => ["missions", id, "analysts"] as const;
export const missionContractorsKey = (id: string) => ["missions", id, "contractors"] as const;
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

export async function listMissionContractors(missionId: string) {
  const { data, error } = await supabase
    .from("mission_contractors")
    .select("contractor_id, contractor:profiles(id, full_name, email)")
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
  const { data: roles, error: rolesErr } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", role);
  if (rolesErr) throw rolesErr;
  const ids = (roles ?? []).map((r) => r.user_id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ids);
  if (error) throw error;
  return data ?? [];
}

export type CreateMissionInput = {
  name: string;
  description?: string | null;
  objective?: string | null;
  segment?: string | null;
  contractor_id?: string | null;
  product_id?: string | null;
  deadline_first?: string | null;
  deadline_final?: string | null;
  target_label: string;
  analyst_ids: string[];
  contractor_ids?: string[];
};

export async function createMission(input: CreateMissionInput) {
  const { analyst_ids, contractor_ids = [], ...rest } = input;

  // Defense-in-depth: RLS `missions_contractor_insert` requires
  // `contractor_id = auth.uid()` when the caller is a contractor.
  // Force it here so any caller (form, upload, AI flows) is safe even
  // if the payload omits contractor_id.
  const { data: sessionForInsert } = await supabase.auth.getSession();
  const currentUserId = sessionForInsert?.session?.user?.id ?? null;
  if (currentUserId) {
    const { data: isContractor } = await supabase.rpc("has_role", {
      _user_id: currentUserId,
      _role: "contractor",
    });
    const { data: isSuperadmin } = await supabase.rpc("has_role", {
      _user_id: currentUserId,
      _role: "superadmin",
    });
    if (isContractor && !isSuperadmin) {
      rest.contractor_id = currentUserId;
    }
  }

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

  if (contractor_ids.length > 0) {
    const rows = contractor_ids.map((contractor_id) => ({ mission_id: mission.id, contractor_id }));
    const { error: linkErr } = await supabase.from("mission_contractors").insert(rows);
    if (linkErr) throw linkErr;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id ?? null;

  await supabase.from("activity_logs").insert({
    mission_id: mission.id,
    user_id: userId,
    action: "mission_created",
    entity_type: "mission",
    entity_id: mission.id,
    details: { name: mission.name },
  });

  return mission;
}

export async function updateMission(id: string, patch: Partial<CreateMissionInput>) {
  const { analyst_ids, contractor_ids, ...rest } = patch;
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

  if (contractor_ids) {
    await supabase.from("mission_contractors").delete().eq("mission_id", id);
    if (contractor_ids.length > 0) {
      await supabase
        .from("mission_contractors")
        .insert(contractor_ids.map((contractor_id) => ({ mission_id: id, contractor_id })));
    }
  }

  return data;
}

export async function deleteMission(id: string) {
  const { error } = await supabase.from("missions").delete().eq("id", id);
  if (error) throw error;
}

export async function updateMissionFromExtraction(
  missionId: string,
  extracted: {
    mission_name?: string;
    objective?: string;
    segment?: string;
    deadline_first?: string;
    deadline_final?: string;
    approach_type?: string;
    ethical_rules?: string;
    entregavel_esperado?: string;
    profundidade_autorizada?: string | null;
    canais_obrigatorios?: string[] | null;
  },
) {
  const patch: {
    objective?: string;
    segment?: string;
    deadline_first?: string;
    deadline_final?: string;
    approach_type?: string;
    ethical_rules?: string;
    entregavel_esperado?: string;
    profundidade_autorizada?: string;
    canais_obrigatorios?: string[];
  } = {};
  if (extracted.objective) patch.objective = extracted.objective;
  if (extracted.segment) patch.segment = extracted.segment;
  if (extracted.deadline_first) patch.deadline_first = extracted.deadline_first;
  if (extracted.deadline_final) patch.deadline_final = extracted.deadline_final;
  if (extracted.approach_type) patch.approach_type = extracted.approach_type;
  if (extracted.ethical_rules) patch.ethical_rules = extracted.ethical_rules;
  if (extracted.entregavel_esperado) patch.entregavel_esperado = extracted.entregavel_esperado;
  if (extracted.profundidade_autorizada)
    patch.profundidade_autorizada = extracted.profundidade_autorizada;
  if (extracted.canais_obrigatorios && extracted.canais_obrigatorios.length > 0)
    patch.canais_obrigatorios = extracted.canais_obrigatorios;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from("missions").update(patch).eq("id", missionId);
  if (error) throw error;
}