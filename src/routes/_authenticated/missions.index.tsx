import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/missions/")({
  component: MissionsPage,
});

function MissionsPage() {
  return (
    <div className="max-w-7xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Missões</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre, acompanhe e gerencie missões de inteligência de mercado.
        </p>
      </div>
      <Card className="p-12">
        <div className="flex flex-col items-center text-center max-w-md mx-auto">
          <div className="grid place-items-center h-14 w-14 rounded-xl bg-primary/10 mb-4">
            <Target className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Módulo de Missões — Fase 2</h2>
          <p className="text-sm text-muted-foreground mt-2">
            CRUD completo, filtros, kanban de alvos e dashboards específicos chegam na próxima fase.
            Avise quando estiver pronto para seguir.
          </p>
        </div>
      </Card>
    </div>
  );
}