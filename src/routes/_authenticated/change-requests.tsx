import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/change-requests")({
  component: () => (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Solicitações de Mudança</h1>
        <Badge variant="secondary">Em breve</Badge>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Missão</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma solicitação ainda.</TableCell></TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  ),
});