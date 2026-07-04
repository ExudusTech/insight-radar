import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, ArrowLeft, Calendar, AlertTriangle, CheckCircle2, Circle, Play } from "lucide-react";
import { getMission, missionDetailKey } from "@/lib/missions.queries";
import { listTargetsByMission, targetsByMissionKey } from "@/lib/targets.queries";
import { supabase } from "@/integrations/supabase/client";
import { TargetDetailSheet } from "@/components/targets/target-detail-sheet";
import { StatusBadge } from "@/components/targets/status-badge";
import {
  COLLECTION_BLOCKS,
  buildFilledByBlock,
  calcBlockRequiredProgress,
  derivedBlockStatus,
} from "@/lib/collection.queries";

export const Route = createFileRoute("/_authenticated/missions/$missionId/journey")({
  component: JourneyPage,
});

type CollectionRowMin = { target_id: string; block: string; field_key: string; field_value: unknown };

function JourneyPage() {
  const { missionId } = Route.useParams();
  const [openTargetId, setOpenTargetId] = useState<string | null>(null);

  const { data: mission } = useQuery({
    queryKey: missionDetailKey(missionId),
    queryFn: () => getMission(missionId),
  });

  const { data: targets = [], isLoading } = useQuery({
    queryKey: targetsByMissionKey(missionId),
    queryFn: () => listTargetsByMission(missionId),
  });

  const { data: collection = [] } = useQuery({
    queryKey: ["collection", "by-mission", missionId],
    queryFn: async (): Promise<CollectionRowMin[]> => {
      const { data } = await supabase
        .from("collection_data")
        .select("target_id, block, field_key, field_value")
        .eq("mission_id", missionId);
      return (data as CollectionRowMin[]) ?? [];
    },
  });

  // index per target
  const rowsByTarget: Record<string, CollectionRowMin[]> = {};
  const storedStatus: Record<string, Record<string, string>> = {};
  const blocking: Record<string, boolean> = {};
  for (const r of collection) {
    (rowsByTarget[r.target_id] ??= []).push(r);
    if (r.field_key === "block_status") {
      storedStatus[r.target_id] = storedStatus[r.target_id] ?? {};
      storedStatus[r.target_id][r.block] = String(r.field_value ?? "not_started").replace(/"/g, "");
    }
    if (r.field_key === "doubt_blocking" && r.field_value === true) {
      blocking[r.target_id] = true;
    }
  }
  const filledByTarget: Record<string, Record<string, Set<string>>> = {};
  for (const [tid, rows] of Object.entries(rowsByTarget)) {
    filledByTarget[tid] = buildFilledByBlock(rows);
  }
  const blockStatus: Record<string, Record<string, "done" | "in_progress" | "not_started">> = {};
  for (const t of targets) {
    const f = filledByTarget[t.id] ?? buildFilledByBlock([]);
    const s: Record<string, "done" | "in_progress" | "not_started"> = {};
    for (const b of COLLECTION_BLOCKS) {
      s[b] = derivedBlockStatus(f, b, storedStatus[t.id]?.[b]);
    }
    blockStatus[t.id] = s;
  }

  const done = targets.filter((t) => t.status === "collection_complete").length;
  const total = targets.length;
  // Progresso real: soma dos blocos concluídos + parciais (in_progress = 0.5)
  // dividido pelo total de blocos de todos os alvos. Alvos com status
  // "collection_complete" contam como 100% mesmo que os blocos não estejam
  // marcados individualmente.
  // Progresso: média por bloco de campos obrigatórios preenchidos, agregada por alvo.
  let sumTargetProgress = 0;
  for (const t of targets) {
    if (t.status === "collection_complete") {
      sumTargetProgress += 1;
      continue;
    }
    const f = filledByTarget[t.id] ?? buildFilledByBlock([]);
    const per = COLLECTION_BLOCKS.map((b) => calcBlockRequiredProgress(f, b));
    sumTargetProgress += per.reduce((s, n) => s + n, 0) / per.length;
  }
  const pct = total ? Math.round((sumTargetProgress / total) * 100) : 0;
  const daysLeft = mission?.deadline_final
    ? Math.ceil((new Date(mission.deadline_final).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  if (isLoading || !mission) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full space-y-6">
      <div>
        <Link to="/missions" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
          <ArrowLeft className="h-3 w-3" /> Minhas missões
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-display">{mission.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">Painel da jornada de coleta</p>
          </div>
          {daysLeft !== null && (
            <Badge variant={daysLeft <= 3 ? "destructive" : "outline"} className="gap-1">
              <Calendar className="h-3 w-3" />
              {daysLeft >= 0 ? `${daysLeft} dias restantes` : "Prazo expirado"}
            </Badge>
          )}
        </div>
        <Card className="p-4 mt-4">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-muted-foreground">Progresso geral</span>
            <span className="font-medium">{done} de {total} alvos concluídos · {pct}% de progresso</span>
          </div>
          <Progress value={pct} />
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
        {targets.map((t) => {
          const blocks = blockStatus[t.id] ?? {};
          const isBlocked = blocking[t.id] === true;
          return (
            <Card key={t.id} className="p-4 flex flex-col gap-3 hover:shadow-[var(--shadow-elevated)] hover:-translate-y-0.5 transition-all duration-200 border-border/60 group">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold leading-tight truncate font-display group-hover:text-primary transition-colors">{t.name}</h3>
                  {t.category && <p className="text-xs text-muted-foreground mt-0.5">{t.category}</p>}
                </div>
                <StatusBadge status={t.status} />
              </div>

              <div className="flex items-center gap-1.5 py-1">
                {COLLECTION_BLOCKS.map((b) => {
                  const s = blocks[b] ?? "not_started";
                  const Icon = s === "done" ? CheckCircle2 : s === "in_progress" ? Play : Circle;
                  const color = s === "done" ? "text-green-500" : s === "in_progress" ? "text-cyan-500" : "text-muted-foreground/30";
                  const bg = s === "done" ? "bg-green-500/10" : s === "in_progress" ? "bg-cyan-500/10" : "bg-muted/30";
                  return (
                    <div key={b} className={`flex flex-col items-center gap-0.5 rounded px-1 py-0.5 ${bg}`} title={`Bloco ${b}: ${s}`}>
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                      <span className="text-[9px] text-muted-foreground font-mono font-bold">{b}</span>
                    </div>
                  );
                })}
              </div>

              {isBlocked && (
                <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/8 rounded px-2 py-1">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Aguardando feedback do cliente
                </div>
              )}

              <Button size="sm" className="mt-auto" onClick={() => setOpenTargetId(t.id)}>
                Trabalhar
              </Button>
            </Card>
          );
        })}
        {targets.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground col-span-full">
            Nenhum alvo cadastrado para esta missão.
          </Card>
        )}
      </div>

      <TargetDetailSheet
        targetId={openTargetId}
        open={!!openTargetId}
        onOpenChange={(o) => !o && setOpenTargetId(null)}
        targetLabel={mission.target_label || "Alvo"}
        defaultTab="assistant"
      />
    </div>
  );
}