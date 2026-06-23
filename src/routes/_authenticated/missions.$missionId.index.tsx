import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMission, listMissionAnalysts, missionAnalystsKey, missionDetailKey } from "@/lib/missions.queries";

export const Route = createFileRoute("/_authenticated/missions/$missionId/")({
  component: MissionOverview,
});

function MissionOverview() {
  const { missionId } = Route.useParams();
  const { data: mission } = useQuery({
    queryKey: missionDetailKey(missionId),
    queryFn: () => getMission(missionId),
  });
  const { data: analysts = [] } = useQuery({
    queryKey: missionAnalystsKey(missionId),
    queryFn: () => listMissionAnalysts(missionId),
  });

  if (!mission) return null;
  const contractor =
    (mission as { contractor?: { full_name: string | null; email: string | null } | null }).contractor;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-5">
        <Card className="p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Briefing</h2>
          {mission.description ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{mission.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Sem descrição cadastrada.</p>
          )}
        </Card>
        <Card className="p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Objetivo</h2>
          {mission.objective ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{mission.objective}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Sem objetivo definido.</p>
          )}
        </Card>
      </div>
      <div className="space-y-5">
        <Card className="p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Detalhes</h2>
          <KV k="Segmento" v={mission.segment} />
          <KV k="Rótulo dos alvos" v={mission.target_label} />
          <KV k="Contratante" v={contractor?.full_name || contractor?.email} />
          <KV k="Primeira entrega" v={mission.deadline_first ? new Date(mission.deadline_first).toLocaleDateString("pt-BR") : null} />
          <KV k="Entrega final" v={mission.deadline_final ? new Date(mission.deadline_final).toLocaleDateString("pt-BR") : null} />
        </Card>
        <Card className="p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Analistas</h2>
          {analysts.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nenhum analista atribuído.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {analysts.map((a) => {
                const profile =
                  (a as { analyst?: { full_name: string | null; email: string | null } | null }).analyst;
                return (
                  <Badge key={a.analyst_id} variant="outline">
                    {profile?.full_name || profile?.email || a.analyst_id.slice(0, 8)}
                  </Badge>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="text-sm">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</div>
      <div className="text-foreground/90">{v || "—"}</div>
    </div>
  );
}