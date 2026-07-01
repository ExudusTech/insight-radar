import { supabase } from "@/integrations/supabase/client";
import type { Tables, Database } from "@/integrations/supabase/types";

export type CollectionBlock = Database["public"]["Enums"]["collection_block"];
export type CollectionRow = Tables<"collection_data">;

export const COLLECTION_BLOCKS: CollectionBlock[] = ["A", "B", "C", "D", "E", "F", "G"];

/** Campos estruturados que o assistente identifica e preenche automaticamente. */
export const BLOCK_FIELDS: Record<CollectionBlock, string[]> = {
  A: ["canal_principal", "promessa", "tipo_conteudo", "cta", "frequencia_posts", "seguidores"],
  B: ["canal_contato", "resposta_tempo", "nome_atendente", "abordagem", "script_inicial"],
  C: ["produtos", "preco", "condicoes", "urgencia", "garantia", "upsell"],
  D: ["depoimentos", "cases", "resultados_mostrados", "metricas_sociais"],
  E: ["qualidade_atendimento", "objecoes_tratadas", "followup", "tom"],
  F: ["proposta_enviada", "pdf", "video", "sequencia_emails"],
  G: ["pontos_fortes", "pontos_fracos", "diferenciais", "oportunidades"],
};

export const BLOCK_TITLES: Record<CollectionBlock, string> = {
  A: "Pesquisa pública",
  B: "Primeiro contato",
  C: "Funil e oferta",
  D: "Prova social",
  E: "Atendimento",
  F: "Materiais",
  G: "Síntese",
};

/** Retorna quantos campos estruturados foram preenchidos por bloco. */
export function countFilledFieldsByBlock(rows: CollectionRow[]) {
  const map: Record<string, number> = {};
  for (const b of COLLECTION_BLOCKS) map[b] = 0;
  const seen = new Set<string>();
  for (const r of rows) {
    const expected = BLOCK_FIELDS[r.block as CollectionBlock] ?? [];
    if (!expected.includes(r.field_key)) continue;
    const v = r.field_value;
    const hasValue =
      v !== null && v !== undefined && String(v).trim() !== "" && String(v).trim() !== "null";
    if (!hasValue) continue;
    const key = `${r.block}:${r.field_key}`;
    if (seen.has(key)) continue;
    seen.add(key);
    map[r.block as string] = (map[r.block as string] ?? 0) + 1;
  }
  return map;
}

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