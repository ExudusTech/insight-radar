import { supabase } from "@/integrations/supabase/client";
import type { Tables, Database } from "@/integrations/supabase/types";

export type CollectionBlock = Database["public"]["Enums"]["collection_block"];
export type CollectionRow = Tables<"collection_data">;

export const COLLECTION_BLOCKS: CollectionBlock[] = ["A", "B", "C", "D", "E", "F", "G"];

export const BLOCK_STATUS_LABEL: Record<string, string> = {
  not_started: "Não iniciado",
  in_progress: "Em andamento",
  done: "Concluído",
};

export const collectionByTargetKey = (targetId: string) =>
  ["collection-data", "by-target", targetId] as const;

export async function listCollectionByTarget(targetId: string) {
  const { data, error } = await supabase
    .from("collection_data")
    .select("*")
    .eq("target_id", targetId);
  if (error) throw error;
  return data ?? [];
}

export async function upsertCollectionField(params: {
  missionId: string;
  targetId: string;
  block: CollectionBlock;
  fieldKey: string;
  value: unknown;
  userId: string;
}) {
  const { missionId, targetId, block, fieldKey, value, userId } = params;
  const { error } = await supabase
    .from("collection_data")
    .upsert(
      {
        mission_id: missionId,
        target_id: targetId,
        block,
        field_key: fieldKey,
        field_value: value as never,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "target_id,block,field_key" },
    );
  if (error) throw error;
}

/** Returns map block -> { notes, block_status } */
export function indexCollectionRows(rows: CollectionRow[]) {
  const map: Record<string, { notes: string; block_status: string }> = {};
  for (const b of COLLECTION_BLOCKS) map[b] = { notes: "", block_status: "not_started" };
  for (const r of rows) {
    const slot = map[r.block as string] ?? { notes: "", block_status: "not_started" };
    if (r.field_key === "notes") slot.notes = String(r.field_value ?? "");
    if (r.field_key === "block_status") slot.block_status = String(r.field_value ?? "not_started");
    map[r.block as string] = slot;
  }
  return map;
}

export function countCompleteBlocks(rows: CollectionRow[]) {
  const idx = indexCollectionRows(rows);
  return COLLECTION_BLOCKS.filter((b) => idx[b].block_status === "done").length;
}