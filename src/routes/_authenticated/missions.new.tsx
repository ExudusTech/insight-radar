import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { MissionForm } from "@/components/missions/mission-form";

export const Route = createFileRoute("/_authenticated/missions/new")({
  component: NewMissionPage,
});

function NewMissionPage() {
  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <div>
        <Link to="/missions" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
          <ArrowLeft className="h-3 w-3" /> Voltar para missões
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Nova missão</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Preencha os dados essenciais. Você poderá editar e adicionar mais detalhes depois.
        </p>
      </div>
      <MissionForm />
    </div>
  );
}