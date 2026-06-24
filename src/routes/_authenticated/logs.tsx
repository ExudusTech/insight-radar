import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/logs")({
  component: LogsPage,
});

function LogsPage() {
  const { data: me, isLoading: meLoading } = useCurrentUser();
  if (!meLoading && me?.role !== "superadmin") throw redirect({ to: "/dashboard" });

  const [missionId, setMissionId] = useState("all");
  const [action, setAction] = useState("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["activity-logs", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*, mission:missions(id, name), user:profiles!activity_logs_user_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const missions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) {
      const mm = r.mission as { id: string; name: string } | null;
      if (mm) m.set(mm.id, mm.name);
    }
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [rows]);

  const actions = useMemo(() => Array.from(new Set(rows.map((r) => r.action))), [rows]);

  const filtered = rows.filter((r) => {
    if (missionId !== "all" && r.mission_id !== missionId) return false;
    if (action !== "all" && r.action !== action) return false;
    return true;
  });

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Logs de Atividade</h1>
      <div className="flex flex-wrap gap-2">
        <Select value={missionId} onValueChange={setMissionId}>
          <SelectTrigger className="w-[240px]"><SelectValue placeholder="Missão" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as missões</SelectItem>
            {missions.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-[240px]"><SelectValue placeholder="Ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
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
                <TableHead>Data</TableHead>
                <TableHead>Missão</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>Usuário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const m = r.mission as { id: string; name: string } | null;
                const u = r.user as { full_name: string | null } | null;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>{m?.name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{r.action}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{r.entity_type}</TableCell>
                    <TableCell>{u?.full_name ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum log.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}