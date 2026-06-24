import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/targets/status-badge";
import { PriorityBadge } from "@/components/targets/priority-badge";
import { TargetDetailSheet } from "@/components/targets/target-detail-sheet";
import {
  TARGET_STATUS_ORDER, TARGET_STATUS_LABEL,
  TARGET_PRIORITY_ORDER, TARGET_PRIORITY_LABEL,
} from "@/lib/target-status";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/targets")({
  component: TargetsPage,
});

function TargetsPage() {
  const [missionId, setMissionId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: targets = [], isLoading } = useQuery({
    queryKey: ["targets", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("targets")
        .select("*, mission:missions(id, name), analyst:profiles!targets_analyst_id_fkey(full_name)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const missions = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of targets) {
      const m = t.mission as { id: string; name: string } | null;
      if (m) map.set(m.id, m.name);
    }
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [targets]);

  const filtered = targets.filter((t) => {
    if (missionId !== "all" && t.mission_id !== missionId) return false;
    if (status !== "all" && t.status !== status) return false;
    if (priority !== "all" && t.priority !== priority) return false;
    return true;
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Alvos</h1>
      <div className="flex flex-wrap gap-2">
        <Select value={missionId} onValueChange={setMissionId}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Missão" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as missões</SelectItem>
            {missions.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {TARGET_STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{TARGET_STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas prioridades</SelectItem>
            {TARGET_PRIORITY_ORDER.map((p) => <SelectItem key={p} value={p}>{TARGET_PRIORITY_LABEL[p]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Card className="overflow-x-auto">
        {isLoading ? (
          <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Missão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Analista</TableHead>
                <TableHead className="text-right">Atualizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => {
                const m = t.mission as { id: string; name: string } | null;
                const a = t.analyst as { full_name: string | null } | null;
                return (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => setOpenId(t.id)}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">{m?.name ?? "—"}</TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
                    <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                    <TableCell className="text-muted-foreground">{a?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{new Date(t.updated_at).toLocaleDateString("pt-BR")}</TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum alvo.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
      <TargetDetailSheet targetId={openId} open={!!openId} onOpenChange={(o) => !o && setOpenId(null)} targetLabel="Alvo" />
    </div>
  );
}