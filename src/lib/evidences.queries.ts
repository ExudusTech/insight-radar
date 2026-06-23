import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Evidence = Tables<"evidences">;

export const EVIDENCE_TYPES = ["screenshot", "gravacao", "print", "documento", "outro"] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const EVIDENCE_TYPE_LABEL: Record<EvidenceType, string> = {
  screenshot: "Screenshot",
  gravacao: "Gravação",
  print: "Print",
  documento: "Documento",
  outro: "Outro",
};

export const evidencesByTargetKey = (targetId: string) =>
  ["evidences", "by-target", targetId] as const;

export async function listEvidencesByTarget(targetId: string) {
  const { data, error } = await supabase
    .from("evidences")
    .select("*")
    .eq("target_id", targetId)
    .order("captured_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function uploadEvidence(params: {
  missionId: string;
  targetId: string;
  file: File;
  evidenceType: EvidenceType;
  caption?: string;
  tags?: string[];
  capturedAt: string;
  userId: string;
}) {
  const { missionId, targetId, file, evidenceType, caption, tags, capturedAt, userId } = params;
  const ts = Date.now();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `${missionId}/${targetId}/${ts}-${safe}`;

  const { error: upErr } = await supabase.storage
    .from("mission-evidences")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("evidences")
    .insert({
      mission_id: missionId,
      target_id: targetId,
      evidence_type: evidenceType,
      file_url: path,
      caption: caption ?? null,
      tags: tags ?? null,
      captured_at: capturedAt,
      created_by: userId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEvidence(evidence: Evidence) {
  if (evidence.file_url) {
    await supabase.storage.from("mission-evidences").remove([evidence.file_url]);
  }
  const { error } = await supabase.from("evidences").delete().eq("id", evidence.id);
  if (error) throw error;
}

export async function getEvidenceSignedUrl(path: string) {
  const { data, error } = await supabase.storage
    .from("mission-evidences")
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}