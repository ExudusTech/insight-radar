import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type DocumentVersion = Tables<"document_versions">;

export const docVersionsKey = (missionId: string) =>
  ["document-versions", missionId] as const;

export async function listDocumentVersions(missionId: string) {
  const { data, error } = await supabase
    .from("document_versions")
    .select("*, author:profiles!document_versions_author_id_fkey(id, full_name, email)")
    .eq("mission_id", missionId)
    .order("version_number", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getLatestDocumentVersion(missionId: string) {
  const { data, error } = await supabase
    .from("document_versions")
    .select("*")
    .eq("mission_id", missionId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function uploadAndCreateVersion(params: {
  missionId: string;
  file: File;
  authorId: string;
}) {
  const { missionId, file, authorId } = params;

  // determine next version number
  const latest = await getLatestDocumentVersion(missionId);
  if (latest && latest.status === "frozen") {
    // ok — frozen versions become history; we still allow creating a new one
  }
  const nextNumber = (latest?.version_number ?? 0) + 1;

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `${missionId}/${timestamp}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from("mission-documents")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("document_versions")
    .insert({
      mission_id: missionId,
      version_number: nextNumber,
      file_url: path,
      file_name: file.name,
      author_id: authorId,
      status: "draft",
    })
    .select("*")
    .single();
  if (error) throw error;

  return data;
}

export async function freezeVersion(versionId: string) {
  const { data: version, error: vErr } = await supabase
    .from("document_versions")
    .select("*")
    .eq("id", versionId)
    .single();
  if (vErr) throw vErr;

  const extracted = (version.extracted_data ?? {}) as Record<string, unknown>;

  // mark previous frozen versions as replaced
  await supabase
    .from("document_versions")
    .update({ status: "replaced" })
    .eq("mission_id", version.mission_id)
    .eq("status", "frozen");

  // freeze this version
  const { error: freezeErr } = await supabase
    .from("document_versions")
    .update({ status: "frozen" })
    .eq("id", versionId);
  if (freezeErr) throw freezeErr;

  // apply extracted fields to mission
  const patch: Record<string, unknown> = {};
  if (typeof extracted.objective === "string") patch.objective = extracted.objective;
  if (typeof extracted.ethical_rules === "string") patch.ethical_rules = extracted.ethical_rules;
  if (typeof extracted.approach_type === "string") patch.approach_type = extracted.approach_type;
  if (typeof extracted.segment === "string" && !patch.segment) patch.segment = extracted.segment;
  if (typeof extracted.deadline_first === "string" && extracted.deadline_first)
    patch.deadline_first = extracted.deadline_first;
  if (typeof extracted.deadline_final === "string" && extracted.deadline_final)
    patch.deadline_final = extracted.deadline_final;

  if (Object.keys(patch).length > 0) {
    await supabase.from("missions").update(patch).eq("id", version.mission_id);
  }

  return version;
}

export type ExtractedTarget = {
  name?: string;
  instagram?: string;
  whatsapp?: string;
  linkedin?: string;
  category?: string;
};

export async function createTargetsFromExtraction(versionId: string) {
  const { data: version, error: vErr } = await supabase
    .from("document_versions")
    .select("mission_id, extracted_data")
    .eq("id", versionId)
    .single();
  if (vErr) throw vErr;

  const extracted = (version.extracted_data ?? {}) as { targets?: ExtractedTarget[] };
  const targets = Array.isArray(extracted.targets) ? extracted.targets : [];
  if (targets.length === 0) return { created: 0, skipped: 0 };

  const { data: existing } = await supabase
    .from("targets")
    .select("name")
    .eq("mission_id", version.mission_id);
  const existingNames = new Set((existing ?? []).map((t) => t.name.toLowerCase().trim()));

  const toInsert = targets
    .filter((t) => t.name && !existingNames.has(t.name.toLowerCase().trim()))
    .map((t) => ({
      mission_id: version.mission_id,
      name: t.name!.trim(),
      category: t.category ?? null,
      instagram: t.instagram ?? null,
      whatsapp: t.whatsapp ?? null,
      linkedin: t.linkedin ?? null,
      priority: "medium" as const,
      status: "not_started" as const,
    }));

  if (toInsert.length === 0) return { created: 0, skipped: targets.length };

  const { error } = await supabase.from("targets").insert(toInsert);
  if (error) throw error;

  return { created: toInsert.length, skipped: targets.length - toInsert.length };
}