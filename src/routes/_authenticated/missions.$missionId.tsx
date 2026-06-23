import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getMission, missionDetailKey } from "@/lib/missions.queries";
import { MISSION_STATUS_LABEL } from "@/lib/target-status";

export const Route = createFileRoute("/_authenticated/missions/$missionId")({
  component: MissionLayout,
});

function MissionLayout() {
  const { missionId } = Route.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: mission, isLoading } = useQuery({
    queryKey: missionDetailKey(missionId),
    queryFn: () => getMission(missionId),
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!mission) {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center">
        <h2 className="text-lg font-semibold">Missão não encontrada</h2>
        <Link to="/missions" className="text-sm text-primary hover:underline mt-2 inline-block">
          Voltar para missões
        </Link>
      </div>
    );
  }

  const targetLabel = mission.target_label || "Alvo";
  const targetsPath = `/missions/${missionId}/targets`;
  const overviewPath = `/missions/${missionId}`;

  const tabs = [
    { label: "Visão Geral", href: overviewPath, key: "overview", active: pathname === overviewPath },
    { label: `${targetLabel}s`, href: targetsPath, key: "targets", active: pathname.startsWith(targetsPath) },
    { label: "Documento-base", href: "#", key: "doc", disabled: true },
    { label: "Timeline", href: "#", key: "timeline", disabled: true },
    { label: "Jornada", href: "#", key: "journey", disabled: true },
    { label: "Comparativo", href: "#", key: "comparative", disabled: true },
  ];

  return (
    <div className="max-w-7xl mx-auto w-full space-y-5">
      <div>
        <Link to="/missions" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
          <ArrowLeft className="h-3 w-3" /> Voltar para missões
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{mission.name}</h1>
            {mission.objective && (
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{mission.objective}</p>
            )}
          </div>
          <Badge variant="outline">{MISSION_STATUS_LABEL[mission.status]}</Badge>
        </div>
      </div>

      <div className="border-b border-border">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {tabs.map((t) =>
            t.disabled ? (
              <span
                key={t.key}
                className="px-3 py-2 text-sm text-muted-foreground/50 cursor-not-allowed whitespace-nowrap"
                title="Disponível em fases posteriores"
              >
                {t.label}
              </span>
            ) : (
              <Link
                key={t.key}
                to={t.href}
                className={`px-3 py-2 text-sm border-b-2 whitespace-nowrap transition-colors ${
                  t.active
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            ),
          )}
        </nav>
      </div>

      <Outlet />
    </div>
  );
}