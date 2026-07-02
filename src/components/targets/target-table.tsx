import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PriorityBadge } from "./priority-badge";
import { TargetPhasePipeline } from "./TargetPhasePipeline";
import type { Target } from "@/lib/targets.queries";
import { supabase } from "@/integrations/supabase/client";
import type { CollectionRow } from "@/lib/collection.queries";
import { calcTargetPhase, TARGET_PHASE_META, type TargetPhase } from "@/lib/target-phase";

type Row = Target & { analyst?: { full_name: string | null } | null };

export function TargetTable({
  targets,
  onOpenTarget,
  missionId,
}: {
  targets: Row[];
  onOpenTarget: (id: string) => void;
  missionId?: string;
}) {
  const { data: rows = [] } = useQuery({
    queryKey: ["collection-data", "by-mission", missionId ?? "none"],
    enabled: !!missionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_data")
        .select("*")
        .eq("mission_id", missionId!);
      if (error) throw error;
      return (data ?? []) as CollectionRow[];
    },
  });
  const { data: briefRows = [] } = useQuery({
    queryKey: ["document-versions", "briefs", "by-mission", missionId ?? "none"],
    enabled: !!missionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_versions")
        .select("extracted_data")
        .eq("mission_id", missionId!)
        .eq("doc_type", "competitor_brief");
      if (error) throw error;
      return (data ?? []) as { extracted_data: unknown }[];
    },
  });
  const phaseByTarget = useMemo(() => {
    const briefs = new Set<string>();
    for (const r of briefRows) {
      const ed = r.extracted_data as { target_id?: string } | null;
      if (ed?.target_id) briefs.add(ed.target_id);
    }
    const byTarget: Record<string, CollectionRow[]> = {};
    for (const r of rows) (byTarget[r.target_id] ??= []).push(r);
    const out: Record<string, TargetPhase> = {};
    for (const t of targets) {
      out[t.id] = calcTargetPhase(byTarget[t.id] ?? [], { briefGenerated: briefs.has(t.id) });
    }
    return out;
  }, [rows, briefRows, targets]);

  if (targets.length === 0) {
    return (
      <div className="text-center py-16 text-sm text-muted-foreground">Nenhum item cadastrado ainda.</div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Marca / categoria</TableHead>
            <TableHead>Fase</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead className="text-right">Atualizado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {targets.map((t) => {
            const phase = phaseByTarget[t.id] ?? "mapeamento";
            return (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => onOpenTarget(t.id)}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {[t.brand, t.category].filter(Boolean).join(" · ") || "—"}
                </TableCell>
                <TableCell>
                  {missionId ? (
                    <TargetPhasePipeline phase={phase} compact />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {TARGET_PHASE_META[phase].icon} {TARGET_PHASE_META[phase].label}
                    </span>
                  )}
                </TableCell>
                <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                <TableCell className="text-muted-foreground">{t.analyst?.full_name ?? "—"}</TableCell>
                <TableCell className="text-right text-muted-foreground text-xs">
                  {new Date(t.updated_at).toLocaleDateString("pt-BR")}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}