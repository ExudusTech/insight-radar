import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/analyst-metrics")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: auth.user.id,
      _role: "superadmin",
    });
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: AnalystMetricsPage,
});

function formatDuration(seconds: number): string {
  if (!seconds) return "0min";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function AnalystMetricsPage() {
  const [filter, setFilter] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["analyst-time-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analyst_time_metrics")
        .select("*")
        .order("last_interaction", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!filter.trim()) return rows;
    const f = filter.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (r.analyst_name ?? "").toLowerCase().includes(f) ||
        (r.mission_name ?? "").toLowerCase().includes(f) ||
        (r.target_name ?? "").toLowerCase().includes(f),
    );
  }, [rows, filter]);

  const totalSeconds = filtered.reduce((s, r) => s + (r.total_seconds_active ?? 0), 0);
  const totalMessages = filtered.reduce((s, r) => s + (r.total_user_messages ?? 0), 0);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tempo por analista</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tempo ativo estimado por analista, concorrente e missão. Sessões acima de 30 min de inatividade são contabilizadas como nova sessão.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{formatDuration(totalSeconds)}</span>
            <span>total</span>
          </div>
          <div>
            <span className="font-medium text-foreground">{totalMessages}</span> mensagens
          </div>
          <div>
            <span className="font-medium text-foreground">{filtered.length}</span> pares analista/concorrente
          </div>
        </div>
      </div>

      <Card className="p-3">
        <Input
          placeholder="Filtrar por analista, missão ou concorrente…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-9"
        />
      </Card>

      <Card className="overflow-x-auto">
        {isLoading ? (
          <div className="grid place-items-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Missão</TableHead>
                <TableHead>Concorrente</TableHead>
                <TableHead>Analista</TableHead>
                <TableHead className="text-right">Mensagens</TableHead>
                <TableHead className="text-right">Tempo ativo</TableHead>
                <TableHead className="text-right whitespace-nowrap">Primeiro contato</TableHead>
                <TableHead className="text-right whitespace-nowrap">Último contato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r, i) => (
                <TableRow key={`${r.mission_id}-${r.target_id}-${r.analyst_id}-${i}`}>
                  <TableCell className="text-sm">{r.mission_name ?? "—"}</TableCell>
                  <TableCell className="text-sm font-medium">{r.target_name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.analyst_name ?? "—"}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{r.total_user_messages ?? 0}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums font-medium">
                    {formatDuration(r.total_seconds_active ?? 0)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                    {r.first_interaction ? new Date(r.first_interaction).toLocaleString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                    {r.last_interaction ? new Date(r.last_interaction).toLocaleString("pt-BR") : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum dado de tempo registrado ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}