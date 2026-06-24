import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/documents")({
  component: DocumentsPage,
});

function DocumentsPage() {
  const [status, setStatus] = useState<string>("all");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["documents", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_versions")
        .select("*, mission:missions(id, name), author:profiles!document_versions_author_id_fkey(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const filtered = status === "all" ? rows : rows.filter((r) => r.status === status);

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Documento-base</h1>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="reviewing">Em revisão</SelectItem>
            <SelectItem value="frozen">Congelado</SelectItem>
            <SelectItem value="replaced">Substituído</SelectItem>
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
                <TableHead>Versão</TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead className="text-right">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const m = r.mission as { id: string; name: string } | null;
                const a = r.author as { full_name: string | null } | null;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      {m ? (
                        <Link to="/missions/$missionId/document" params={{ missionId: m.id }} className="font-medium hover:underline">{m.name}</Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell>v{r.version_number}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{r.file_name}</TableCell>
                    <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{a?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum documento.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}