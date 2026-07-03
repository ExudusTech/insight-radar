import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Pencil, Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMission, missionDetailKey, missionsListKey, updateMission } from "@/lib/missions.queries";
import { MISSION_STATUS_LABEL } from "@/lib/target-status";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/missions/$missionId")({
  component: MissionLayout,
});

function MissionLayout() {
  const { missionId } = Route.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: currentUser } = useCurrentUser();
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
  const documentPath = `/missions/${missionId}/document`;
  const comparativePath = `/missions/${missionId}/comparative`;
  const canSeeComparative =
    currentUser?.role === "superadmin" || currentUser?.role === "contractor";
  const canRename = currentUser?.role === "superadmin";

  const tabs = [
    { label: "Visão Geral", href: overviewPath, key: "overview", active: pathname === overviewPath },
    { label: `${targetLabel}s`, href: targetsPath, key: "targets", active: pathname.startsWith(targetsPath) },
    { label: "Documento-base", href: documentPath, key: "doc", active: pathname.startsWith(documentPath) },
    canSeeComparative
      ? {
          label: "Comparativo",
          href: comparativePath,
          key: "comparative",
          active: pathname.startsWith(comparativePath),
        }
      : { label: "Comparativo", href: "#", key: "comparative", disabled: true },
  ];

  return (
    <div className="max-w-7xl mx-auto w-full space-y-5">
      <div>
        <Link to="/missions" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
          <ArrowLeft className="h-3 w-3" /> Voltar para missões
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            {canRename ? (
              <EditableMissionName missionId={missionId} name={mission.name} />
            ) : (
              <h1 className="text-2xl font-bold tracking-tight">{mission.name}</h1>
            )}
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

function EditableMissionName({ missionId, name }: { missionId: string; name: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  const mut = useMutation({
    mutationFn: (newName: string) => updateMission(missionId, { name: newName }),
    onSuccess: () => {
      toast.success("Missão renomeada");
      qc.invalidateQueries({ queryKey: missionDetailKey(missionId) });
      qc.invalidateQueries({ queryKey: missionsListKey });
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Erro ao renomear"),
  });

  if (!editing) {
    return (
      <div className="flex items-center gap-2 group">
        <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => {
            setValue(name);
            setEditing(true);
          }}
          aria-label="Renomear missão"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      return;
    }
    mut.mutate(trimmed);
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="h-9 text-xl font-bold"
        disabled={mut.isPending}
      />
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={submit} disabled={mut.isPending} aria-label="Salvar">
        {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={() => setEditing(false)}
        disabled={mut.isPending}
        aria-label="Cancelar"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
