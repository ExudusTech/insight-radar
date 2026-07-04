import { supabase } from "@/integrations/supabase/client";
import type { Tables, Database } from "@/integrations/supabase/types";

export type CollectionBlock = Database["public"]["Enums"]["collection_block"];
export type CollectionRow = Tables<"collection_data">;

export const COLLECTION_BLOCKS: CollectionBlock[] = ["A", "B", "C", "D", "E", "F", "G"];

/** Campos estruturados que o assistente identifica e preenche automaticamente. */
export const BLOCK_FIELDS: Record<CollectionBlock, string[]> = {
  A: ["canal_principal", "promessa", "tipo_conteudo", "cta", "frequencia_posts", "seguidores"],
  B: [
    "canal_contato",
    "resposta_tempo",
    "nome_atendente",
    "abordagem",
    "script_inicial",
    "canal_entrada",
    "canal_continuidade",
    "tipo_continuidade",
    "coerencia_canal",
  ],
  C: ["produtos", "preco", "condicoes", "urgencia", "garantia", "upsell"],
  D: ["depoimentos", "cases", "resultados_mostrados", "metricas_sociais"],
  E: ["qualidade_atendimento", "objecoes_tratadas", "followup", "tom"],
  F: ["proposta_enviada", "pdf", "video", "sequencia_emails"],
  G: ["pontos_fortes", "pontos_fracos", "diferenciais", "oportunidades"],
};

/**
 * Campos OBRIGATÓRIOS: a analista sempre consegue preencher,
 * independente de o concorrente cooperar ou responder.
 * São o critério de suficiência para declarar coleta pronta.
 */
export const BLOCK_FIELDS_REQUIRED: Record<string, string[]> = {
  A: ["canal_principal", "cta"],
  B: ["resposta_tempo", "abordagem", "canal_entrada"],
  C: ["produtos"],
  D: ["depoimentos"],
  E: ["qualidade_atendimento", "tom"],
  F: [],
  G: ["pontos_fortes", "pontos_fracos"],
};

/**
 * Campos CONDICIONAIS: só existem se o concorrente avançar no funil.
 * Se não preenchidos, registrar como "não obtido" na síntese.
 */
export const BLOCK_FIELDS_CONDITIONAL: Record<string, string[]> = {
  A: ["promessa", "tipo_conteudo", "frequencia_posts", "seguidores"],
  B: ["canal_contato", "script_inicial", "followup", "canal_continuidade", "tipo_continuidade", "coerencia_canal"],
  C: ["preco", "condicoes", "urgencia", "garantia"],
  D: ["cases", "resultados_mostrados"],
  E: ["objecoes_tratadas"],
  F: ["proposta_enviada", "materiais_descritos"],
  G: ["diferenciais"],
};

/** Calcula se os campos obrigatórios estão suficientemente preenchidos */
export function calcRequiredCompletion(rows: Array<Pick<CollectionRow, "block" | "field_key" | "field_value">>): {
  totalRequired: number;
  filledRequired: number;
  percent: number;
  missingRequired: string[];
  readyForSynthesis: boolean;
  filledByBlock: Record<string, Set<string>>;
} {
  const filledByBlock = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!filledByBlock.has(row.block)) filledByBlock.set(row.block, new Set());
    const val = String(row.field_value ?? "").trim();
    if (val && val !== "null" && val !== "—" && val !== "não obtido") {
      filledByBlock.get(row.block)!.add(row.field_key);
    }
  }

  let totalRequired = 0;
  let filledRequired = 0;
  const missingRequired: string[] = [];

  for (const [blk, fields] of Object.entries(BLOCK_FIELDS_REQUIRED)) {
    for (const f of fields) {
      totalRequired++;
      if (filledByBlock.get(blk)?.has(f)) filledRequired++;
      else missingRequired.push(`${blk}.${f}`);
    }
  }

  const percent = totalRequired > 0 ? Math.round((filledRequired / totalRequired) * 100) : 0;
  const filledObj: Record<string, Set<string>> = {};
  filledByBlock.forEach((v, k) => (filledObj[k] = v));
  return {
    totalRequired,
    filledRequired,
    percent,
    missingRequired,
    readyForSynthesis: missingRequired.length === 0,
    filledByBlock: filledObj,
  };
}

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

async function promoteTargetStatusFromCollection(targetId: string) {
  const { data: target, error: readError } = await supabase
    .from("targets")
    .select("status")
    .eq("id", targetId)
    .maybeSingle();
  if (readError) throw readError;
  if (target?.status !== "not_started") return;

  const { error: updateError } = await supabase
    .from("targets")
    .update({ status: "public_research" })
    .eq("id", targetId);
  if (updateError) throw updateError;
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
  const filled = buildFilledByBlock(rows);
  return COLLECTION_BLOCKS.filter((b) => calcBlockRequiredProgress(filled, b) >= 1).length;
}

export function calcTargetCompletionPercent(rows: CollectionRow[]): number {
  return calcTargetProgressPercent(rows);
}

/** Constrói { block -> Set<field_key> } com apenas valores significativos, ignorando metadados. */
export function buildFilledByBlock(
  rows: Array<{ block: string; field_key: string; field_value: unknown }>,
): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const b of COLLECTION_BLOCKS) out[b] = new Set();
  for (const r of rows) {
    if (r.field_key === "notes" || r.field_key === "block_status") continue;
    const v = r.field_value;
    const s = String(v ?? "").trim().toLowerCase();
    if (!s || s === "null" || s === "—" || s === "não obtido") continue;
    (out[r.block] ??= new Set()).add(r.field_key);
  }
  return out;
}

/** Progresso do bloco em [0,1] baseado APENAS em campos obrigatórios. Bloco sem obrigatórios = 1. */
export function calcBlockRequiredProgress(
  filledByBlock: Record<string, Set<string>>,
  block: string,
): number {
  const required = BLOCK_FIELDS_REQUIRED[block] ?? [];
  if (required.length === 0) return 1;
  const filled = filledByBlock[block] ?? new Set<string>();
  const n = required.filter((f) => filled.has(f)).length;
  return n / required.length;
}

/** True quando todos obrigatórios do bloco estão preenchidos. */
export function isBlockRequirementsMet(
  rows: Array<{ block: string; field_key: string; field_value: unknown }>,
  block: string,
): boolean {
  return calcBlockRequiredProgress(buildFilledByBlock(rows), block) >= 1;
}

/**
 * Status derivado do bloco:
 * - done: todos obrigatórios preenchidos
 * - in_progress: algum campo (obrig. ou condicional) preenchido, ou block_status armazenado = in_progress
 * - not_started: caso contrário
 */
export function derivedBlockStatus(
  filledByBlock: Record<string, Set<string>>,
  block: string,
  storedStatus?: string,
): "done" | "in_progress" | "not_started" {
  if (calcBlockRequiredProgress(filledByBlock, block) >= 1) return "done";
  const anyFilled = (filledByBlock[block]?.size ?? 0) > 0;
  if (anyFilled || storedStatus === "in_progress") return "in_progress";
  return "not_started";
}

/** Progresso do alvo = média do progresso dos 7 blocos (peso igual). */
export function calcTargetProgressPercent(
  rows: Array<{ block: string; field_key: string; field_value: unknown }>,
): number {
  const filled = buildFilledByBlock(rows);
  const per = COLLECTION_BLOCKS.map((b) => calcBlockRequiredProgress(filled, b));
  const avg = per.reduce((s, n) => s + n, 0) / per.length;
  return Math.round(avg * 100);
}

/** Formata "chave: valor" para exibir no notes do bloco. */
function formatFieldLine(key: string, value: string) {
  const label = key.replace(/_/g, " ");
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
  return `- ${capitalized}: ${value}`;
}

/**
 * Aplica campos extraídos pelo assistente ao "notes" do bloco (merge inteligente:
 * atualiza linhas existentes e adiciona novas), promove status para in_progress
 * quando ainda estiver not_started, e faz upsert dos field_keys granulares.
 */
export async function applyBlockUpdatesFromAssistant(params: {
  missionId: string;
  targetId: string;
  userId: string;
  blockUpdates: Record<string, Record<string, string>>;
}): Promise<number> {
  const { missionId, targetId, userId, blockUpdates } = params;
  console.log("[applyBlockUpdates] input blocks:", Object.keys(blockUpdates ?? {}));
  const existing = await listCollectionByTarget(targetId);
  const indexed = indexCollectionRows(existing);
  let totalFields = 0;
  let firstError: unknown = null;
  const blocksUpdated: CollectionBlock[] = [];

  for (const [blk, fields] of Object.entries(blockUpdates)) {
    if (!COLLECTION_BLOCKS.includes(blk as CollectionBlock)) continue;
    if (!fields || typeof fields !== "object") continue;
    const block = blk as CollectionBlock;
    let blockHadField = false;

    // 1) upsert dos campos granulares
    for (const [fieldKey, value] of Object.entries(fields)) {
      const v = String(value ?? "").trim();
      if (!v) continue;
      try {
        await upsertCollectionField({
          missionId,
          targetId,
          block,
          fieldKey,
          value: v,
          userId,
        });
        totalFields++;
        blockHadField = true;
      } catch (e) {
        console.error("[applyBlockUpdates] upsert field failed", block, fieldKey, e);
        if (!firstError) firstError = e;
      }
    }
    if (blockHadField) blocksUpdated.push(block);

    // 2) merge no notes (visível na aba Coleta)
    const currentNotes = indexed[block]?.notes ?? "";
    const lines = currentNotes.split("\n");
    const nextLines = [...lines];
    for (const [fieldKey, value] of Object.entries(fields)) {
      const v = String(value ?? "").trim();
      if (!v) continue;
      const label = fieldKey.replace(/_/g, " ");
      const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
      const prefix = `- ${capitalized}:`;
      const idxLine = nextLines.findIndex((l) => l.trim().startsWith(prefix));
      const newLine = formatFieldLine(fieldKey, v);
      if (idxLine >= 0) nextLines[idxLine] = newLine;
      else nextLines.push(newLine);
    }
    const mergedNotes = nextLines.filter((l) => l.trim()).join("\n");
    if (mergedNotes && mergedNotes !== currentNotes) {
      try {
        await upsertCollectionField({
          missionId, targetId, block, fieldKey: "notes",
          value: mergedNotes, userId,
        });
      } catch (e) {
        console.error("[applyBlockUpdates] notes upsert failed", block, e);
        if (!firstError) firstError = e;
      }
    }

    // 3) status → in_progress se ainda estiver not_started
    const currentStatus = indexed[block]?.block_status ?? "not_started";
    if (currentStatus === "not_started") {
      try {
        await upsertCollectionField({
          missionId, targetId, block, fieldKey: "block_status",
          value: "in_progress", userId,
        });
      } catch (e) {
        console.error("[applyBlockUpdates] status upsert failed", block, e);
        if (!firstError) firstError = e;
      }
    }
  }
  console.log("[applyBlockUpdates] totalFields upserted:", totalFields);
  if (firstError && totalFields === 0) throw firstError;

  // Auto-promote block_status → 'done' quando todos os obrigatórios do bloco estiverem preenchidos
  if (blocksUpdated.length > 0) {
    try {
      const refreshed = await listCollectionByTarget(targetId);
      const filledByBlock = new Map<string, Set<string>>();
      for (const row of refreshed) {
        const val = String(row.field_value ?? "").trim();
        if (!val || val === "null" || val === "—" || val === "não obtido") continue;
        if (!filledByBlock.has(row.block)) filledByBlock.set(row.block, new Set());
        filledByBlock.get(row.block)!.add(row.field_key);
      }
      for (const blk of new Set(blocksUpdated)) {
        const required = BLOCK_FIELDS_REQUIRED[blk] ?? [];
        if (required.length === 0) continue;
        const filled = filledByBlock.get(blk) ?? new Set<string>();
        const allFilled = required.every((f) => filled.has(f));
        if (!allFilled) continue;
        const currentStatus = String(
          refreshed.find((r) => r.block === blk && r.field_key === "block_status")?.field_value ?? "not_started",
        );
        if (currentStatus === "done") continue;
        await upsertCollectionField({
          missionId, targetId, block: blk, fieldKey: "block_status",
          value: "done", userId,
        });
      }
    } catch (e) {
      console.warn("[applyBlockUpdates] auto-complete block_status failed", e);
    }
  }

  if (totalFields > 0) {
    try {
      await promoteTargetStatusFromCollection(targetId);
    } catch (e) {
      console.warn("[applyBlockUpdates] target status promotion failed", e);
    }
  }

  return totalFields;
}