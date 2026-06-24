import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/pending")({
  component: () => (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">pending</h1>
        <Badge variant="secondary">Em breve</Badge>
      </div>
      <Card className="p-8 text-sm text-muted-foreground">
        Este módulo será disponibilizado em uma próxima fase.
      </Card>
    </div>
  ),
});
