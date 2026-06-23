import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "./status-badge";
import { PriorityBadge } from "./priority-badge";
import type { Target } from "@/lib/targets.queries";

type Row = Target & { analyst?: { full_name: string | null } | null };

export function TargetTable({ targets, onOpenTarget }: { targets: Row[]; onOpenTarget: (id: string) => void }) {
  if (targets.length === 0) {
    return (
      <div className="text-center py-16 text-sm text-muted-foreground">Nenhum item cadastrado ainda.</div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Marca / categoria</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead className="text-right">Atualizado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {targets.map((t) => (
            <TableRow key={t.id} className="cursor-pointer" onClick={() => onOpenTarget(t.id)}>
              <TableCell className="font-medium">{t.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {[t.brand, t.category].filter(Boolean).join(" · ") || "—"}
              </TableCell>
              <TableCell><StatusBadge status={t.status} /></TableCell>
              <TableCell><PriorityBadge priority={t.priority} /></TableCell>
              <TableCell className="text-muted-foreground">{t.analyst?.full_name ?? "—"}</TableCell>
              <TableCell className="text-right text-muted-foreground text-xs">
                {new Date(t.updated_at).toLocaleDateString("pt-BR")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}