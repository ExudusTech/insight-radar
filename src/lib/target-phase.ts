import type { CollectionRow } from "./collection.queries";

export type TargetPhase =
  | "mapeamento"
  | "abordagem"
  | "dialogo"
  | "aprofundamento"
  | "analise"
  | "concluido";

export const TARGET_PHASE_ORDER: TargetPhase[] = [
  "mapeamento",
  "abordagem",
  "dialogo",
  "aprofundamento",
  "analise",
  "concluido",
];

export const TARGET_PHASE_META: Record<TargetPhase, { icon: string; label: string }> = {
  mapeamento: { icon: "🔍", label: "Mapeamento" },
  abordagem: { icon: "📱", label: "Abordagem" },
  dialogo: { icon: "💬", label: "Em diálogo" },
  aprofundamento: { icon: "📋", label: "Aprofundamento" },
  analise: { icon: "🧠", label: "Análise" },
  concluido: { icon: "✅", label: "Concluído" },
};

const MEANINGFUL = (v: unknown) => {
  const s = String(v ?? "").trim().toLowerCase();
  return s !== "" && s !== "null" && s !== "—" && s !== "não obtido";
};

/**
 * Deriva a fase atual do target a partir dos dados coletados.
 * Ignora campos "notes" e "block_status", que são metadados do bloco.
 */
export function calcTargetPhase(
  rows: CollectionRow[],
  opts: { briefGenerated?: boolean } = {},
): TargetPhase {
  if (opts.briefGenerated) return "concluido";

  const byBlock: Record<string, Record<string, string>> = {};
  for (const r of rows) {
    if (r.field_key === "notes" || r.field_key === "block_status") continue;
    if (!MEANINGFUL(r.field_value)) continue;
    (byBlock[r.block] ??= {})[r.field_key] = String(r.field_value);
  }

  const blocoG = byBlock["G"] ?? {};
  if (blocoG["pontos_fortes"] || blocoG["pontos_fracos"]) return "analise";

  const temAprofundamento = ["C", "D", "E", "F"].some(
    (b) => Object.keys(byBlock[b] ?? {}).length > 0,
  );
  if (temAprofundamento) return "aprofundamento";

  if (byBlock["B"]?.["resposta_tempo"]) return "dialogo";
  if (Object.keys(byBlock["B"] ?? {}).length > 0) return "abordagem";
  if (Object.keys(byBlock["A"] ?? {}).length > 0) return "mapeamento";

  return "mapeamento";
}