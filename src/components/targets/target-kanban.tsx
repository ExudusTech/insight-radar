import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TargetCard } from "./target-card";
import { type Target } from "@/lib/targets.queries";
import { supabase } from "@/integrations/supabase/client";
import {
  BLOCK_FIELDS,
  COLLECTION_BLOCKS,
  calcTargetCompletionPercent,
  countFilledFieldsByBlock,
  indexCollectionRows,
  type CollectionRow,
} from "@/lib/collection.queries";
import {
  TARGET_PHASE_META,
  TARGET_PHASE_ORDER,
  calcTargetPhase,
  type TargetPhase,
} from "@/lib/target-phase";

const TOTAL_EXPECTED = COLLECTION_BLOCKS.reduce((s, b) => s + BLOCK_FIELDS[b].length, 0);
type CompletionMap = Record<string, { percent: number; filled: number; total: number; completeBlocks: number }>;
type RowsByTarget = Record<string, CollectionRow[]>;

function useMissionCollection(missionId: string): { completion: CompletionMap; rowsByTarget: RowsByTarget } {
  const { data = [] } = useQuery({
    queryKey: ["collection-data", "by-mission", missionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_data")
        .select("*")
        .eq("mission_id", missionId);
      if (error) throw error;
      return (data ?? []) as CollectionRow[];
    },
  });
  return useMemo(() => {
    const rowsByTarget: RowsByTarget = {};
    for (const r of data) (rowsByTarget[r.target_id] ??= []).push(r);
    const completion: CompletionMap = {};
    for (const [tid, rows] of Object.entries(rowsByTarget)) {
      const percent = calcTargetCompletionPercent(rows);
      const filled = Object.values(countFilledFieldsByBlock(rows)).reduce((s, n) => s + n, 0);
      const idx = indexCollectionRows(rows);
      const completeBlocks = COLLECTION_BLOCKS.filter((b) => idx[b].block_status === "done").length;
      completion[tid] = { percent, filled, total: TOTAL_EXPECTED, completeBlocks };
    }
    return { completion, rowsByTarget };
  }, [data]);
}

function useBriefsByTarget(missionId: string): Set<string> {
  const { data = [] } = useQuery({
    queryKey: ["document-versions", "briefs", "by-mission", missionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_versions")
        .select("extracted_data")
        .eq("mission_id", missionId)
        .eq("doc_type", "competitor_brief");
      if (error) throw error;
      return (data ?? []) as { extracted_data: unknown }[];
    },
  });
  return useMemo(() => {
    const s = new Set<string>();
    for (const r of data) {
      const ed = r.extracted_data as { target_id?: string } | null;
      if (ed?.target_id) s.add(ed.target_id);
    }
    return s;
  }, [data]);
}

type TargetWithAnalyst = Target & { analyst?: { full_name: string | null } | null };

export function TargetKanban({
  missionId,
  targets,
  onOpenTarget,
}: {
  missionId: string;
  targets: TargetWithAnalyst[];
  onOpenTarget: (id: string) => void;
  readOnly?: boolean;
}) {
  const { completion, rowsByTarget } = useMissionCollection(missionId);
  const briefs = useBriefsByTarget(missionId);

  const phaseByTarget = useMemo(() => {
    const map: Record<string, TargetPhase> = {};
    for (const t of targets) {
      map[t.id] = calcTargetPhase(rowsByTarget[t.id] ?? [], {
        briefGenerated: briefs.has(t.id),
      });
    }
    return map;
  }, [targets, rowsByTarget, briefs]);

  const byPhase = useMemo(() => {
    const map = new Map<TargetPhase, TargetWithAnalyst[]>();
    for (const p of TARGET_PHASE_ORDER) map.set(p, []);
    for (const t of targets) map.get(phaseByTarget[t.id] ?? "mapeamento")!.push(t);
    return map;
  }, [targets, phaseByTarget]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {TARGET_PHASE_ORDER.map((phase) => (
        <PhaseColumn
          key={phase}
          phase={phase}
          items={byPhase.get(phase) ?? []}
          onOpenTarget={onOpenTarget}
          completion={completion}
          phaseByTarget={phaseByTarget}
        />
      ))}
    </div>
  );
}

function PhaseColumn({
  phase,
  items,
  onOpenTarget,
  completion,
  phaseByTarget,
}: {
  phase: TargetPhase;
  items: TargetWithAnalyst[];
  onOpenTarget: (id: string) => void;
  completion: CompletionMap;
  phaseByTarget: Record<string, TargetPhase>;
}) {
  const meta = TARGET_PHASE_META[phase];
  return (
    <div className="flex flex-col w-64 shrink-0 rounded-lg border border-border bg-surface/60">
      <div className="px-3 py-2 rounded-t-lg border-b border-border flex items-center justify-between bg-muted/40">
        <span className="text-xs font-semibold leading-tight">
          {meta.icon} {meta.label}
        </span>
        <span className="text-[11px] font-medium opacity-80">{items.length}</span>
      </div>
      <div className="flex-1 p-2 space-y-2 min-h-32">
        {items.map((t) => (
          <TargetCard
            key={t.id}
            target={t}
            onClick={() => onOpenTarget(t.id)}
            phase={phaseByTarget[t.id] ?? phase}
            completion={completion[t.id] ?? { percent: 0, filled: 0, total: TOTAL_EXPECTED, completeBlocks: 0 }}
          />
        ))}
        {items.length === 0 && (
          <div className="text-[11px] text-muted-foreground text-center py-4 italic">vazio</div>
        )}
      </div>
    </div>
  );
}