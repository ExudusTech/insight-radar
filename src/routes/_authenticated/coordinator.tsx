import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowRight, ChevronDown, ChevronRight, Clock, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CoordinationThread } from "@/components/coordination/coordination-thread";
import { useCurrentUser as _useCurrentUser } from "@/hooks/use-current-user";
import { coordinationUnreadKey } from "@/lib/coordination-messages.queries";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import {
  COLLECTION_BLOCKS,
  BLOCK_TITLES,
  buildFilledByBlock,
  calcBlockRequiredProgress,
  calcTargetProgressPercent,
} from "@/lib/collection.queries";
import { MISSION_STATUS_LABEL } from "@/lib/target-status";

export const Route = createFileRoute("/_authenticated/coordinator")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw redirect({ to: "/auth" });
    const [{ data: isCoord }, { data: isAdmin }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: auth.user.id, _role: "coordinator" }),
      supabase.rpc("has_role", { _user_id: auth.user.id, _role: "superadmin" }),
    ]);
    if (!isCoord && !isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: CoordinatorDashboard,
});

function CoordinatorDashboard() {
  const { data: me } = useCurrentUser();
  const allowed = me?.role === "coordinator" || me?.role === "superadmin";

  if (!allowed) {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center">
        <h2 className="text-lg font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Este painel está disponível apenas para coordenadores.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full space-y-8">
      <div>
        <Badge variant="secondary" className="font-medium mb-1">Coordenação</Badge>
        <h1 className="text-2xl font-bold tracking-tight font-display">
          Painel do Coordenador
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe missões ativas e o banco de horas dos analistas.
        </p>
      </div>

      <ActiveMissionsSection />
      <TimeBankSection />
    </div>
  );
}

/* -------------------- Missões Ativas -------------------- */

type MissionRow = {
  id: string;
  name: string;
  status: string;
  deadline_final: string | null;
  contractor: { full_name: string | null; email: string | null } | null;
  analysts: Array<{ id: string; full_name: string | null; email: string | null }>;
};

async function fetchActiveMissions(): Promise<MissionRow[]> {
  const { data, error } = await supabase
    .from("missions")
    .select(
      `id, name, status, deadline_final,
       contractor:profiles!missions_contractor_id_fkey(full_name, email),
       mission_analysts(analyst_id, analyst:profiles!mission_analysts_analyst_id_fkey(id, full_name, email))`,
    )
    .not("status", "in", "(closed,cancelled,delivered)")
    .order("deadline_final", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    status: m.status,
    deadline_final: m.deadline_final ?? null,
    contractor: (m.contractor as MissionRow["contractor"]) ?? null,
    analysts: (
      (m.mission_analysts as Array<{ analyst: { id: string; full_name: string | null; email: string | null } | null }> | null) ?? []
    )
      .map((row) => row.analyst)
      .filter((a): a is NonNullable<typeof a> => !!a),
  }));
}

function ActiveMissionsSection() {
  const { data: missions, isLoading } = useQuery({
    queryKey: ["coordinator", "active-missions"],
    queryFn: fetchActiveMissions,
  });

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Missões ativas
      </h2>
      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !missions || missions.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma missão ativa no momento.
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {missions.map((m) => (
            <MissionCard key={m.id} mission={m} />
          ))}
        </div>
      )}
    </section>
  );
}

function MissionCard({ mission }: { mission: MissionRow }) {
  const [expanded, setExpanded] = useState(false);

  const { data: progressData } = useQuery({
    queryKey: ["coordinator", "mission-progress", mission.id],
    queryFn: async () => {
      const [{ data: targets }, { data: rows }] = await Promise.all([
        supabase
          .from("targets")
          .select("id, name")
          .eq("mission_id", mission.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("collection_data")
          .select("target_id, block, field_key, field_value")
          .eq("mission_id", mission.id),
      ]);
      const byTarget = new Map<string, typeof rows>();
      (rows ?? []).forEach((r) => {
        const arr = byTarget.get(r.target_id) ?? [];
        arr.push(r);
        byTarget.set(r.target_id, arr);
      });
      const perTarget = (targets ?? []).map((t) => {
        const trows = byTarget.get(t.id) ?? [];
        const filled = buildFilledByBlock(trows);
        const blocks = COLLECTION_BLOCKS.map((b) => ({
          block: b,
          progress: calcBlockRequiredProgress(filled, b),
        }));
        const percent = calcTargetProgressPercent(trows);
        return { id: t.id, name: t.name, blocks, percent };
      });
      const overall =
        perTarget.length === 0
          ? 0
          : Math.round(
              perTarget.reduce((s, t) => s + t.percent, 0) / perTarget.length,
            );
      return { perTarget, overall };
    },
  });

  const overall = progressData?.overall ?? 0;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold truncate">{mission.name}</h3>
            <Badge variant="outline" className="text-[10px]">
              {MISSION_STATUS_LABEL[mission.status as keyof typeof MISSION_STATUS_LABEL] ?? mission.status}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {mission.contractor?.full_name ?? mission.contractor?.email ?? "Sem cliente"}
            {mission.deadline_final && (
              <> · Prazo {new Date(mission.deadline_final).toLocaleDateString("pt-BR")}</>
            )}
          </div>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link to="/missions/$missionId" params={{ missionId: mission.id }}>
            Abrir <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </div>

      <div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
          <span>Progresso geral</span>
          <span>{overall}%</span>
        </div>
        <Progress value={overall} className="h-1.5" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {mission.analysts.length === 0 ? (
          <span className="text-[11px] text-muted-foreground">Sem analistas atribuídos</span>
        ) : (
          mission.analysts.map((a) => (
            <AnalystChatChip
              key={a.id}
              missionId={mission.id}
              analystId={a.id}
              analystName={a.full_name ?? a.email ?? "—"}
            />
          ))
        )}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {expanded ? "Ocultar" : "Ver"} grade de concorrentes
      </button>

      {expanded && progressData && (
        <div className="border-t pt-3 overflow-x-auto">
          {progressData.perTarget.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem concorrentes cadastrados.</p>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left font-medium py-1 pr-2">Concorrente</th>
                  {COLLECTION_BLOCKS.map((b) => (
                    <th key={b} className="text-center font-medium px-1" title={BLOCK_TITLES[b]}>
                      {b}
                    </th>
                  ))}
                  <th className="text-right font-medium pl-2">%</th>
                </tr>
              </thead>
              <tbody>
                {progressData.perTarget.map((t) => (
                  <tr key={t.id} className="border-t border-border/40">
                    <td className="py-1.5 pr-2 truncate max-w-[140px]">{t.name}</td>
                    {t.blocks.map((b) => (
                      <td key={b.block} className="text-center px-1">
                        <BlockDot progress={b.progress} />
                      </td>
                    ))}
                    <td className="text-right pl-2 font-medium">{t.percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Card>
  );
}

function BlockDot({ progress }: { progress: number }) {
  if (progress >= 1) {
    return <span className="inline-block text-emerald-500">✅</span>;
  }
  if (progress > 0) {
    return <span className="inline-block text-sky-400">🔵</span>;
  }
  return <span className="inline-block text-muted-foreground/50">⚪</span>;
}

function AnalystChatChip({
  missionId,
  analystId,
  analystName,
}: {
  missionId: string;
  analystId: string;
  analystName: string;
}) {
  const { data: me } = _useCurrentUser();
  const { data: unread = 0 } = useQuery({
    queryKey: [
      ...coordinationUnreadKey(me?.id ?? ""),
      "thread",
      missionId,
      analystId,
    ],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("coordination_messages")
        .select("id", { count: "exact", head: true })
        .eq("mission_id", missionId)
        .eq("sender_id", analystId)
        .eq("receiver_id", me!.id)
        .is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!me?.id,
    refetchInterval: 30_000,
  });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-secondary/50 hover:bg-secondary px-2 py-0.5 text-[10px] font-medium transition"
        >
          <MessageCircle className="h-3 w-3" />
          <span className="truncate max-w-[140px]">{analystName}</span>
          {unread > 0 && (
            <Badge variant="destructive" className="h-3.5 min-w-3.5 px-1 text-[9px]">
              {unread}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="start">
        <CoordinationThread
          missionId={missionId}
          otherUserId={analystId}
          otherUserName={analystName}
        />
      </PopoverContent>
    </Popover>
  );
}

/* -------------------- Banco de Horas -------------------- */

type TimeRow = {
  mission_id: string;
  target_id: string;
  analyst_id: string;
  analyst_name: string | null;
  target_name: string | null;
  mission_name: string | null;
  total_user_messages: number;
  total_hours_active: number | string;
  last_interaction: string | null;
};

function TimeBankSection() {
  const [missionFilter, setMissionFilter] = useState<string>("all");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["coordinator", "analyst-time-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analyst_time_metrics")
        .select("*")
        .order("last_interaction", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TimeRow[];
    },
  });

  const missionOptions = useMemo(() => {
    const map = new Map<string, string>();
    (rows ?? []).forEach((r) => {
      if (r.mission_id) map.set(r.mission_id, r.mission_name ?? "—");
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => {
    if (missionFilter === "all") return rows ?? [];
    return (rows ?? []).filter((r) => r.mission_id === missionFilter);
  }, [rows, missionFilter]);

  const totalsByAnalyst = useMemo(() => {
    const acc = new Map<string, { name: string; hours: number; messages: number }>();
    filtered.forEach((r) => {
      const key = r.analyst_id;
      const cur = acc.get(key) ?? {
        name: r.analyst_name ?? "—",
        hours: 0,
        messages: 0,
      };
      cur.hours += Number(r.total_hours_active ?? 0);
      cur.messages += Number(r.total_user_messages ?? 0);
      acc.set(key, cur);
    });
    return Array.from(acc.values()).sort((a, b) => b.hours - a.hours);
  }, [filtered]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Banco de horas
        </h2>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Select value={missionFilter} onValueChange={setMissionFilter}>
            <SelectTrigger className="h-8 w-[220px]">
              <SelectValue placeholder="Filtrar por missão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as missões</SelectItem>
              {missionOptions.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Sem interações registradas.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Analista</TableHead>
                <TableHead>Missão</TableHead>
                <TableHead>Concorrente</TableHead>
                <TableHead className="text-right">Horas efetivas</TableHead>
                <TableHead className="text-right">Mensagens</TableHead>
                <TableHead className="text-right">Última interação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={`${r.analyst_id}-${r.target_id}`}>
                  <TableCell className="font-medium">{r.analyst_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.mission_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.target_name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(r.total_hours_active ?? 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.total_user_messages}</TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs">
                    {r.last_interaction
                      ? new Date(r.last_interaction).toLocaleString("pt-BR")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {totalsByAnalyst.map((t) => (
                <TableRow key={`total-${t.name}`} className="bg-muted/40 font-semibold">
                  <TableCell>Total — {t.name}</TableCell>
                  <TableCell colSpan={2} className="text-muted-foreground text-xs">
                    (soma no filtro atual)
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{t.hours.toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.messages}</TableCell>
                  <TableCell />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </section>
  );
}
