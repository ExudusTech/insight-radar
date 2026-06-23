import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser, ROLE_LABEL } from "@/hooks/use-current-user";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, FolderOpen, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: user } = useCurrentUser();
  const greeting = user?.profile?.full_name?.split(" ")[0] ?? "";
  const { data: kpis } = useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: fetchKpis,
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="font-medium">
              {user?.role ? ROLE_LABEL[user.role] : "—"}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Bem-vindo{greeting ? `, ${greeting}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Painel de comando para suas missões de inteligência de mercado.
          </p>
        </div>
        <Button asChild>
          <Link to="/missions">
            Ver missões <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Missões ativas" value={fmt(kpis?.activeMissions)} icon={Target} tone="primary" />
        <KpiCard label="Alvos em coleta" value={fmt(kpis?.targetsInProgress)} icon={FolderOpen} tone="info" />
        <KpiCard label="Alvos concluídos" value={fmt(kpis?.targetsComplete)} icon={CheckCircle2} tone="success" />
        <KpiCard label="Pendências críticas" value={fmt(kpis?.critical)} icon={AlertTriangle} tone="warning" />
      </div>

      <Card className="p-8">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Sua plataforma está pronta</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Fases 1 e 2 concluídas (fundação, missões e alvos com Kanban). Fase 3 — documento-base
            com extração por IA — em andamento. Próximas: coleta guiada, timeline, evidências e
            relatórios automatizados.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="outline">Fase 1 · Fundação ✓</Badge>
            <Badge variant="outline">Fase 2 · Missões + Alvos ✓</Badge>
            <Badge variant="default">Fase 3 · IA de extração ●</Badge>
            <Badge variant="outline" className="opacity-60">Fase 4 · Coleta Guiada</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}

async function fetchKpis() {
  const today = new Date();
  const in3 = new Date();
  in3.setDate(today.getDate() + 3);
  const isoToday = today.toISOString().slice(0, 10);
  const iso3 = in3.toISOString().slice(0, 10);

  const [active, inProgress, complete, critical] = await Promise.all([
    supabase
      .from("missions")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(closed,cancelled)"),
    supabase
      .from("targets")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(not_started,collection_complete,incomplete,discarded)"),
    supabase
      .from("targets")
      .select("id", { count: "exact", head: true })
      .eq("status", "collection_complete"),
    supabase
      .from("missions")
      .select("id", { count: "exact", head: true })
      .gte("deadline_final", isoToday)
      .lte("deadline_final", iso3),
  ]);

  return {
    activeMissions: active.count ?? 0,
    targetsInProgress: inProgress.count ?? 0,
    targetsComplete: complete.count ?? 0,
    critical: critical.count ?? 0,
  };
}

function fmt(n: number | undefined) {
  if (n == null) return "—";
  return n.toString();
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "info" | "success" | "warning";
}) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    info: "bg-secondary/15 text-secondary",
    success: "bg-[oklch(0.625_0.187_145/0.12)] text-[oklch(0.45_0.18_145)]",
    warning: "bg-warning/15 text-[oklch(0.55_0.18_70)]",
  }[tone];

  return (
    <Card className="p-5 hover:shadow-[var(--shadow-elevated)] transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </div>
          <div className="text-3xl font-bold tracking-tight mt-2">{value}</div>
        </div>
        <div className={`grid place-items-center h-10 w-10 rounded-lg ${toneClasses}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}