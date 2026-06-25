import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Target as TargetIcon,
  CheckCircle2,
  AlertTriangle,
  Play,
  Calendar,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listMissions, missionsListKey } from "@/lib/missions.queries";
import { COLLECTION_BLOCKS } from "@/lib/collection.queries";
import { generateComparative } from "@/lib/ai-analysis.functions";

type Comparative = {
  market_overview?: string;
  market_gaps?: string[];
  strategic_recommendations?: string[];
  ranking?: Array<{ target: string; score: number; reason: string }>;
};

export function ContractorDashboard() {
  const qc = useQueryClient();
  const { data: missions = [] } = useQuery({
    queryKey: missionsListKey,
    queryFn: listMissions,
  });
  const [missionId, setMissionId] = useState<string>("");

  // auto-select first
  useMemo(() => {
    if (!missionId && missions[0]) setMissionId(missions[0].id);
  }, [missions, missionId]);

  const mission = missions.find((m) => m.id === missionId) ?? null;

  const { data: targets = [] } = useQuery({
    queryKey: ["contractor", "targets", missionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("targets")
        .select("id, name, status")
        .eq("mission_id", missionId);
      return data ?? [];
    },
    enabled: !!missionId,
  });

  const { data: collection = [] } = useQuery({
    queryKey: ["contractor", "collection", missionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("collection_data")
        .select("target_id, block, field_key, field_value")
        .eq("mission_id", missionId);
      return data ?? [];
    },
    enabled: !!missionId,
  });

  const { data: doubts = [] } = useQuery({
    queryKey: ["contractor", "doubts", missionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, message, block, type, target_id, target:targets(id, name), origin_user_id")
        .eq("mission_id", missionId)
        .in("type", ["doubt", "blocking"])
        .is("read_at", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!missionId,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["contractor", "reports", missionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("reports")
        .select("*")
        .eq("mission_id", missionId)
        .eq("report_type", "comparative")
        .order("generated_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!missionId,
  });
  const comparative = reports[0];
  const comp = (comparative?.content ?? {}) as Comparative;

  // index block status + blocking per target
  const blockStatus: Record<string, Record<string, string>> = {};
  const blocking: Record<string, boolean> = {};
  for (const r of collection) {
    const k = r.field_key;
    const v = r.field_value;
    if (k === "block_status") {
      blockStatus[r.target_id] = blockStatus[r.target_id] ?? {};
      blockStatus[r.target_id][r.block as string] = String(v ?? "not_started").replace(/"/g, "");
    }
    if (k === "doubt_blocking" && v === true) blocking[r.target_id] = true;
  }

  const kpis = {
    total: targets.length,
    done: targets.filter((t) => t.status === "collection_complete").length,
    inProgress: targets.filter((t) =>
      ![
        "not_started",
        "collection_complete",
        "incomplete",
        "discarded",
      ].includes(t.status),
    ).length,
    blocked: Object.keys(blocking).length,
  };

  const daysLeft = mission?.deadline_final
    ? Math.ceil((new Date(mission.deadline_final).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const genFn = useServerFn(generateComparative);
  const genMut = useMutation({
    mutationFn: () => genFn({ data: { missionId } }),
    onSuccess: () => {
      toast.success("Análise comparativa gerada");
      qc.invalidateQueries({ queryKey: ["contractor", "reports", missionId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="max-w-7xl mx-auto w-full space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Acompanhe suas missões e dúvidas pendentes</p>
        </div>
        <Select value={missionId} onValueChange={setMissionId}>
          <SelectTrigger className="w-[300px]"><SelectValue placeholder="Selecione uma missão" /></SelectTrigger>
          <SelectContent>
            {missions.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!missionId ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Selecione uma missão para visualizar.
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 stagger-children">
            <Kpi label="Total de alvos" value={kpis.total} icon={TargetIcon} />
            <Kpi label="Concluídos" value={kpis.done} icon={CheckCircle2} tone="success" />
            <Kpi label="Em andamento" value={kpis.inProgress} icon={Play} tone="info" />
            <Kpi label="Bloqueados" value={kpis.blocked} icon={AlertTriangle} tone="danger" />
            <Kpi
              label="Prazo (dias)"
              value={daysLeft ?? "—"}
              icon={Calendar}
              tone={daysLeft !== null && daysLeft <= 3 ? "danger" : "default"}
            />
          </div>

          {/* Comparative table */}
          <Card className="overflow-x-auto">
            <div className="p-4 border-b">
              <h2 className="font-semibold">Progresso por bloco</h2>
              <p className="text-xs text-muted-foreground">Estado de cada alvo nos 7 blocos</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alvo</TableHead>
                  {COLLECTION_BLOCKS.map((b) => (
                    <TableHead key={b} className="text-center font-mono">{b}</TableHead>
                  ))}
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.map((t) => {
                  const bs = blockStatus[t.id] ?? {};
                  const blockedT = blocking[t.id];
                  const completed = COLLECTION_BLOCKS.filter((b) => bs[b] === "done").length;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      {COLLECTION_BLOCKS.map((b) => {
                        const s = bs[b] ?? "not_started";
                        const emoji =
                          blockedT && s !== "done"
                            ? "🔴"
                            : s === "done"
                            ? "✅"
                            : s === "in_progress"
                            ? "🔵"
                            : "⚪";
                        return (
                          <TableCell key={b} className="text-center">{emoji}</TableCell>
                        );
                      })}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Progress value={(completed / 7) * 100} className="w-16 h-2" />
                          <span className="text-xs text-muted-foreground w-8">{Math.round((completed / 7) * 100)}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {targets.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-6">Sem alvos.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          {/* AI comparative */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Análise comparativa de IA</h2>
                {comparative && (
                  <p className="text-xs text-muted-foreground">Última geração: {new Date(comparative.generated_at).toLocaleString("pt-BR")}</p>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => genMut.mutate()}
                disabled={genMut.isPending || targets.length === 0}
              >
                {genMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {comparative ? "Regenerar" : "Gerar análise"}
              </Button>
            </div>
            {!comparative ? (
              <p className="text-sm text-muted-foreground">Nenhuma análise comparativa gerada ainda.</p>
            ) : (
              <div className="space-y-3">
                {comp.market_overview && <p className="text-sm">{comp.market_overview}</p>}
                {comp.ranking && comp.ranking.length > 0 && (
                  <div>
                    <div className="text-xs uppercase text-muted-foreground mb-1">Ranking</div>
                    <ol className="text-sm list-decimal pl-5 space-y-1">
                      {comp.ranking.map((r, i) => (
                        <li key={i}><span className="font-medium">{r.target}</span> · <Badge variant="secondary">{r.score}/10</Badge> — <span className="text-muted-foreground">{r.reason}</span></li>
                      ))}
                    </ol>
                  </div>
                )}
                {comp.market_gaps && comp.market_gaps.length > 0 && (
                  <div>
                    <div className="text-xs uppercase text-muted-foreground mb-1">Gaps de mercado</div>
                    <ul className="text-sm list-disc pl-5">{comp.market_gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
                  </div>
                )}
                {comp.strategic_recommendations && comp.strategic_recommendations.length > 0 && (
                  <div>
                    <div className="text-xs uppercase text-muted-foreground mb-1">Recomendações</div>
                    <ul className="text-sm list-disc pl-5">{comp.strategic_recommendations.map((g, i) => <li key={i}>{g}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Pending doubts */}
          <Card className="p-5">
            <h2 className="font-semibold flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4" /> Dúvidas pendentes
            </h2>
            {doubts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma dúvida pendente.</p>
            ) : (
              <ul className="space-y-2">
                {doubts.map((d) => {
                  const tgt = (d as unknown as { target?: { name: string } | null }).target;
                  return (
                    <li key={d.id} className="flex items-start gap-2 text-sm border-b pb-2 last:border-0">
                      <Badge variant={d.type === "blocking" ? "destructive" : "secondary"}>
                        {d.type === "blocking" ? "Bloqueante" : "Dúvida"}
                      </Badge>
                      {d.block && <Badge variant="outline" className="font-mono">{d.block}</Badge>}
                      <span className="font-medium">{tgt?.name}</span>
                      <span className="text-muted-foreground flex-1 truncate">{d.message}</span>
                      <Button asChild size="sm" variant="outline">
                        <a href="/notificacoes">Responder</a>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "info" | "danger";
}) {
  const toneMap = {
    default: { bg: "bg-muted/60", icon: "bg-muted text-muted-foreground", border: "border-border" },
    success: { bg: "bg-gradient-to-br from-green-500/10 to-transparent", icon: "bg-green-500/15 text-green-600", border: "border-green-500/20" },
    info:    { bg: "bg-gradient-to-br from-primary/10 to-transparent", icon: "bg-primary/15 text-primary", border: "border-primary/20" },
    danger:  { bg: "bg-gradient-to-br from-destructive/10 to-transparent", icon: "bg-destructive/15 text-destructive", border: "border-destructive/20" },
  }[tone];
  return (
    <Card className={`p-4 border ${toneMap.border} ${toneMap.bg} hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)] transition-all duration-200`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">{label}</div>
          <div className="text-3xl font-bold mt-1 font-display">{value}</div>
        </div>
        <div className={`grid place-items-center h-9 w-9 rounded-lg ${toneMap.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}