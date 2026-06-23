import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { getMission, missionDetailKey } from "@/lib/missions.queries";
import { listTargetsByMission, targetsByMissionKey } from "@/lib/targets.queries";
import { TargetKanban } from "@/components/targets/target-kanban";
import { TargetTable } from "@/components/targets/target-table";
import { NewTargetDialog } from "@/components/targets/new-target-dialog";
import { TargetDetailSheet } from "@/components/targets/target-detail-sheet";

export const Route = createFileRoute("/_authenticated/missions/$missionId/targets")({
  component: TargetsTab,
});

function TargetsTab() {
  const { missionId } = Route.useParams();
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [openTargetId, setOpenTargetId] = useState<string | null>(null);

  const { data: mission } = useQuery({
    queryKey: missionDetailKey(missionId),
    queryFn: () => getMission(missionId),
  });
  const { data: targets, isLoading } = useQuery({
    queryKey: targetsByMissionKey(missionId),
    queryFn: () => listTargetsByMission(missionId),
  });

  const targetLabel = mission?.target_label || "Alvo";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "table")}>
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="table">Tabela</TabsTrigger>
          </TabsList>
        </Tabs>
        <NewTargetDialog missionId={missionId} targetLabel={targetLabel} />
      </div>

      {isLoading ? (
        <Card className="p-16 grid place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </Card>
      ) : view === "kanban" ? (
        <TargetKanban
          missionId={missionId}
          targets={targets ?? []}
          onOpenTarget={setOpenTargetId}
        />
      ) : (
        <TargetTable targets={targets ?? []} onOpenTarget={setOpenTargetId} />
      )}

      <TargetDetailSheet
        targetId={openTargetId}
        open={!!openTargetId}
        onOpenChange={(o) => !o && setOpenTargetId(null)}
        targetLabel={targetLabel}
      />
    </div>
  );
}