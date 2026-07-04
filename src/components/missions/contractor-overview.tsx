import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Calendar,
  Users,
  Target as TargetIcon,
  TrendingUp,
  CheckCircle2,
  Circle,
  Play,
  AlertTriangle,
  Info,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/targets/status-badge";
import { TargetDetailSheet } from "@/components/targets/target-detail-sheet";
import { COLLECTION_BLOCKS } from "@/lib/collection.queries";
import {
  listTargetsByMission,
  targetsByMissionKey,
} from "@/lib/targets.queries";
import {
  listMissionAnalysts,
  missionAnalystsKey,
  type Mission,
} from "@/lib/missions.queries";
import { parseLocalDate } from "@/components/ui/date-picker";

type CollectionRowMin = {
  target_id: string;
  block: string;
  field_key: string;
  field_value: unknown;
};

type MissionWithRelations = Mission & {
  contractor?: { full_name: string | null; email: string | null } | null;
  responsible?: { full_name: string | null; email: string | null } | null;
  entregavel_esperado?: string | null;
};

export function ContractorOverview({ mission }: { mission: MissionWithRelations }) {
  const missionId = mission.id;
  const [openTargetId, setOpenTargetId] = useState<string | null>(null);

  const { data: targets = [] } = useQuery({
    queryKey: targetsByMissionKey(missionId),
    queryFn: () => listTargetsByMission(missionId),
  });

  const { data: analysts = [] } = useQuery({
    queryKey: missionAnalystsKey(missionId),
    queryFn: () => listMissionAnalysts(missionId),
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

  const blockStatus: Record<string, Record<string, string>> = {};
  const blocking: Record<string, boolean> = {};
  for (const r of collection) {
    if (r.field_key === "block_status") {
      blockStatus[r.target_id] = blockStatus[r.target_id] ?? {};
      blockStatus[r.target_id][r.block] = String(r.field_value ?? "not_started").replace(/"/g, "");
    }
    if (r.field_key === "doubt_blocking" && r.field_value === true) {
      blocking[r.target_id] = true;
    }
  }

  const done = targets.filter((t) => t.status === "collection_complete").length;
  const total = targets.length;
  const totalBlocks = total * COLLECTION_BLOCKS.length;
  let weightedDone = 0;
  for (const t of targets) {
    if (t.status === "collection_complete") {
      weightedDone += COLLECTION_BLOCKS.length;
      continue;
    }
    const blocks = blockStatus[t.id] ?? {};
    for (const b of COLLECTION_BLOCKS) {
      const s = blocks[b] ?? "not_started";
      if (s === "done") weightedDone += 1;
      else if (s === "in_progress") weightedDone += 0.5;
    }
  }
  const pct = totalBlocks ? Math.round((weightedDone / totalBlocks) * 100) : 0;

  const deadlineDate = mission.deadline_final ? parseLocalDate(mission.deadline_final) : null;
  const daysLeft = deadlineDate
    ? Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const deadlineLabel = deadlineDate ? deadlineDate.toLocaleDateString("pt-BR") : "sem data";

  const analystNames = analysts
    .map((a) => {
      const p = (a as { analyst?: { full_name: string | null; email: string | null } | null }).analyst;
      return p?.full_name || p?.email || null;
    })
    .filter((n): n is string => !!n);

  const contractorName =
    mission.contractor?.full_name || mission.contractor?.email || null;
  const responsibleName =
    mission.responsible?.full_name || mission.responsible?.email || null;

  const countdownTone = (() => {
    if (daysLeft === null) return "neutral";
    if (daysLeft < 0) return "danger";
    if (daysLeft <= 3) return "danger";
    if (daysLeft <= 7) return "warning";
    return "ok";
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-5">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            iconColor="text-cyan-500"
            iconBg="bg-cyan-500/10"
            label="Progresso"
            value={`${pct}%`}
            sub={`${done} de ${total} concluídos`}
          />
          <StatCard
            icon={<Calendar className="h-4 w-4" />}
            iconColor={
              countdownTone === "danger"
                ? "text-destructive"
                : countdownTone === "warning"
                  ? "text-amber-500"
                  : "text-primary"
            }
            iconBg={
              countdownTone === "danger"
                ? "bg-destructive/10"
                : countdownTone === "warning"
                  ? "bg-amber-500/10"
                  : "bg-primary/10"
            }
            label="Prazo"
            value={
              daysLeft === null
                ? "—"
                : daysLeft < 0
                  ? "Expirado"
                  : `${daysLeft} dias`
            }
            sub={deadlineLabel}
          />
          <StatCard
            icon={<TargetIcon className="h-4 w-4" />}
            iconColor="text-primary"
            iconBg="bg-primary/10"
            label="Concorrentes"
            value={String(total)}
            sub="sendo monitorados"
          />
          <StatCard
            icon={<Users className="h-4 w-4" />}
            iconColor="text-green-500"
            iconBg="bg-green-500/10"
            label="Analistas"
            value={String(analysts.length)}
            sub="em campo"
          />
        </div>

        <Card className="p-4">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-muted-foreground">Progresso geral</span>
            <span className="font-medium">
              {done} de {total} alvos concluídos · {pct}%
            </span>
          </div>
          <Progress value={pct} />
        </Card>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Concorrentes monitorados
            </h2>
            <Link
              to="/missions/$missionId/targets"
              params={{ missionId }}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {targets.length === 0 ? (
            <Card className="p-8 text-center">
              <TargetIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhum concorrente cadastrado nesta missão.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {targets.map((t) => {
                const blocks = blockStatus[t.id] ?? {};
                const isBlocked = blocking[t.id] === true;
                return (
                  <Card
                    key={t.id}
                    onClick={() => setOpenTargetId(t.id)}
                    className="p-4 flex flex-col gap-3 hover:shadow-[var(--shadow-elevated)] hover:-translate-y-0.5 hover:border-primary/40 transition-all duration-200 border-border/60 cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold leading-tight truncate group-hover:text-primary transition-colors">
                          {t.name}
                        </h3>
                        {t.category && (
                          <p className="text-xs text-muted-foreground mt-0.5">{t.category}</p>
                        )}
                      </div>
                      <StatusBadge status={t.status} />
                    </div>

                    <div className="flex items-center gap-1.5 py-1">
                      {COLLECTION_BLOCKS.map((b) => {
                        const s = blocks[b] ?? "not_started";
                        const Icon =
                          s === "done" ? CheckCircle2 : s === "in_progress" ? Play : Circle;
                        const color =
                          s === "done"
                            ? "text-green-500"
                            : s === "in_progress"
                              ? "text-cyan-500"
                              : "text-muted-foreground/30";
                        const bg =
                          s === "done"
                            ? "bg-green-500/10"
                            : s === "in_progress"
                              ? "bg-cyan-500/10"
                              : "bg-muted/30";
                        return (
                          <div
                            key={b}
                            className={`flex flex-col items-center gap-0.5 rounded px-1 py-0.5 ${bg}`}
                            title={`Bloco ${b}: ${s}`}
                          >
                            <Icon className={`h-3.5 w-3.5 ${color}`} />
                            <span className="text-[9px] text-muted-foreground font-mono font-bold">
                              {b}
                            </span>
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
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5">
        <Card
          className={`p-6 ${
            countdownTone === "danger"
              ? "border-destructive/40 bg-destructive/5"
              : countdownTone === "warning"
                ? "border-amber-500/40 bg-amber-500/5"
                : "border-border"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Calendar
              className={`h-4 w-4 ${
                countdownTone === "danger"
                  ? "text-destructive"
                  : countdownTone === "warning"
                    ? "text-amber-500"
                    : "text-primary"
              }`}
            />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Prazo final
            </h2>
          </div>
          {daysLeft === null ? (
            <p className="text-sm text-muted-foreground italic">Sem prazo definido.</p>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-5xl font-bold tracking-tight ${
                    countdownTone === "danger"
                      ? "text-destructive"
                      : countdownTone === "warning"
                        ? "text-amber-500"
                        : "text-foreground"
                  }`}
                >
                  {daysLeft < 0 ? Math.abs(daysLeft) : daysLeft}
                </span>
                <span className="text-sm text-muted-foreground">
                  {daysLeft < 0
                    ? `dia${Math.abs(daysLeft) === 1 ? "" : "s"} em atraso`
                    : `dia${daysLeft === 1 ? "" : "s"} restante${daysLeft === 1 ? "" : "s"}`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Entrega em {deadlineLabel}</p>
            </>
          )}
        </Card>

        <Card className="p-6 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Detalhes
          </h2>
          <DetailRow label="Segmento" value={mission.segment} />
          {mission.entregavel_esperado ? (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                Entregável esperado
              </div>
              <div className="rounded-md border border-green-500/40 bg-green-500/5 px-2.5 py-1.5">
                <p className="text-sm text-green-700 dark:text-green-400 leading-relaxed whitespace-pre-wrap">
                  {mission.entregavel_esperado}
                </p>
              </div>
            </div>
          ) : (
            <DetailRow label="Entregável esperado" value={null} />
          )}
          <DetailRow label="Coordenador" value={responsibleName ?? contractorName} />
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
              Analista{analystNames.length === 1 ? "" : "s"}
            </div>
            {analystNames.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Ninguém atribuído.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {analystNames.map((n) => (
                  <Badge key={n} variant="outline">
                    {n}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Objetivo
          </h2>
          {mission.objective ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{mission.objective}</p>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-3">
              <Info className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                O briefing desta missão foi definido internamente. Em caso de dúvidas, entre em
                contato com o coordenador.
              </p>
            </div>
          )}
        </Card>
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

function StatCard({
  icon,
  iconColor,
  iconBg,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className={`inline-flex items-center justify-center rounded-md p-1.5 ${iconBg} ${iconColor}`}>
          {icon}
        </span>
      </div>
      <div className="text-2xl font-bold tracking-tight leading-none">{value}</div>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="text-sm">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-foreground/90">{value || "—"}</div>
    </div>
  );
}