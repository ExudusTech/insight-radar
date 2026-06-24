import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const qc = useQueryClient();
  const [missionId, setMissionId] = useState("all");
  const [type, setType] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["reports", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*, mission:missions(id, name), target:targets(id, name)")
        .order("generated_at", { ascending: false });
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

  const filtered = rows.filter((r) => {
    if (missionId !== "all" && r.mission_id !== missionId) return false;
    if (type !== "all" && r.report_type !== type) return false;
    return true;
  });

  const deliver = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reports").update({ status: "delivered" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marcado como entregue");
      qc.invalidateQueries({ queryKey: ["reports", "all"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const open = openId ? rows.find((r) => r.id === openId) : null;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
      <div className="flex flex-wrap gap-2">
        <Select value={missionId} onValueChange={setMissionId}>
          <SelectTrigger className="w-[240px]"><SelectValue placeholder="Missão" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as missões</SelectItem>
            {missions.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="individual">Individual</SelectItem>
            <SelectItem value="comparative">Comparativo</SelectItem>
            <SelectItem value="strategic">Estratégico</SelectItem>
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
                <TableHead>Missão</TableHead>
                <TableHead>Alvo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Gerado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const m = r.mission as { id: string; name: string } | null;
                const t = r.target as { id: string; name: string } | null;
                return (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
                    <TableCell className="font-medium">{m?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{t?.name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{r.report_type}</Badge></TableCell>
                    <TableCell><Badge>{r.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.generated_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {r.status !== "delivered" && (
                        <Button size="sm" variant="outline" onClick={() => deliver.mutate(r.id)}>Marcar como entregue</Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum relatório.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto print:max-w-none print:max-h-none">
          <DialogHeader>
            <DialogTitle>Relatório {open?.report_type}</DialogTitle>
          </DialogHeader>
          {open && (
            <div className="space-y-3 print:bg-white print:text-black">
              <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded">
                {JSON.stringify(open.content, null, 2)}
              </pre>
              {open.report_type === "comparative" && (
                <Button onClick={() => window.print()} variant="outline">
                  <Printer className="h-4 w-4" /> Exportar como PDF
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}