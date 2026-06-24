import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Target as TargetIcon, Loader2, Calendar, ArrowRight } from "lucide-react";
import { listMissions, missionsListKey } from "@/lib/missions.queries";
import { MISSION_STATUS_LABEL } from "@/lib/target-status";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/missions/")({
  component: MissionsPage,
});

function MissionsPage() {
  const { data: user } = useCurrentUser();
  const canCreate = user?.role === "superadmin";
  const cardsView = user?.role === "analyst" || user?.role === "contractor";
  const { data: missions, isLoading } = useQuery({
    queryKey: missionsListKey,
    queryFn: listMissions,
  });
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const list = missions ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((m) => m.name.toLowerCase().includes(q));
  }, [missions, search]);

  return (
    <div className="max-w-7xl mx-auto w-full space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {user?.role === "analyst" ? "Minhas Missões" : "Missões"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie missões de inteligência de mercado.
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link to="/missions/new"><Plus className="h-4 w-4" /> Nova missão</Link>
          </Button>
        )}
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar missão..."
              className="pl-8"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState canCreate={canCreate} />
        ) : cardsView ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((m) => <MissionCard key={m.id} missionId={m.id} name={m.name} segment={m.segment} deadline={m.deadline_final} status={m.status} />)}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Missão</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rótulo</TableHead>
                <TableHead className="text-right">Criada em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => {
                // contractor relation may be present or null
                const contractor =
                  (m as { contractor?: { full_name: string | null; email: string | null } | null }).contractor;
                return (
                  <TableRow key={m.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link to="/missions/$missionId" params={{ missionId: m.id }} className="hover:underline">
                        {m.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contractor?.full_name || contractor?.email || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{MISSION_STATUS_LABEL[m.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.target_label}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs">
                      {new Date(m.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function MissionCard({
  missionId,
  name,
  segment,
  deadline,
  status,
}: {
  missionId: string;
  name: string;
  segment: string | null;
  deadline: string | null;
  status: keyof typeof MISSION_STATUS_LABEL;
}) {
  const { data: stats } = useQuery({
    queryKey: ["mission-stats", missionId],
    queryFn: async () => {
      const [total, done] = await Promise.all([
        supabase.from("targets").select("id", { count: "exact", head: true }).eq("mission_id", missionId),
        supabase
          .from("targets")
          .select("id", { count: "exact", head: true })
          .eq("mission_id", missionId)
          .eq("status", "collection_complete"),
      ]);
      return { total: total.count ?? 0, done: done.count ?? 0 };
    },
  });
  const total = stats?.total ?? 0;
  const done = stats?.done ?? 0;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const daysLeft = deadline
    ? Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const urgency =
    daysLeft === null
      ? "muted"
      : daysLeft <= 3
      ? "danger"
      : daysLeft <= 7
      ? "warning"
      : "muted";
  const urgencyClass =
    urgency === "danger"
      ? "text-destructive"
      : urgency === "warning"
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-muted-foreground";

  return (
    <Card className="p-5 flex flex-col gap-4 hover:shadow-md transition">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight">{name}</h3>
          <Badge variant="outline" className="shrink-0 text-[10px]">{MISSION_STATUS_LABEL[status]}</Badge>
        </div>
        {segment && <p className="text-xs text-muted-foreground mt-1">{segment}</p>}
      </div>
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">Alvos concluídos</span>
          <span className="font-medium">{done} de {total}</span>
        </div>
        <Progress value={pct} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className={`text-xs flex items-center gap-1 ${urgencyClass}`}>
          <Calendar className="h-3.5 w-3.5" />
          {deadline
            ? daysLeft! >= 0
              ? `${daysLeft} dia${daysLeft === 1 ? "" : "s"} restantes`
              : "Prazo expirado"
            : "Sem prazo definido"}
        </div>
        <Button asChild size="sm">
          <Link to="/missions/$missionId/journey" params={{ missionId }}>
            Continuar missão <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}

function EmptyState({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-4">
      <div className="grid place-items-center h-14 w-14 rounded-xl bg-primary/10 mb-4">
        <TargetIcon className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-lg font-semibold">Nenhuma missão cadastrada</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">
        {canCreate
          ? "Crie a primeira missão para começar a organizar a inteligência de mercado."
          : "Quando uma missão for atribuída a você, ela aparecerá aqui."}
      </p>
      {canCreate && (
        <Button asChild className="mt-4">
          <Link to="/missions/new"><Plus className="h-4 w-4" /> Nova missão</Link>
        </Button>
      )}
    </div>
  );
}