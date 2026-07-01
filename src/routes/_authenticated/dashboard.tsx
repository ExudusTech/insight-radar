import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser, ROLE_LABEL } from "@/hooks/use-current-user";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, FolderOpen, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ContractorDashboard } from "@/components/dashboard/contractor-dashboard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: user } = useCurrentUser();
  if (user?.role === "contractor") return <ContractorDashboard />;
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
          <h1 className="text-2xl font-bold tracking-tight font-display">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <KpiCard label="Missões ativas" value={fmt(kpis?.activeMissions)} icon={Target} tone="primary" />
        <KpiCard label="Alvos em coleta" value={fmt(kpis?.targetsInProgress)} icon={FolderOpen} tone="info" />
        <KpiCard label="Alvos concluídos" value={fmt(kpis?.targetsComplete)} icon={CheckCircle2} tone="success" />
        <KpiCard label="Pendências críticas" value={fmt(kpis?.critical)} icon={AlertTriangle} tone="warning" />
      </div>

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
  const toneMap = {
    primary: { bg: "from-primary/20 to-primary/5", icon: "bg-primary/15 text-primary", border: "border-primary/20" },
    info:    { bg: "from-secondary/20 to-secondary/5", icon: "bg-secondary/15 text-secondary", border: "border-secondary/20" },
    success: { bg: "from-[oklch(0.625_0.187_145/0.15)] to-[oklch(0.625_0.187_145/0.02)]", icon: "bg-[oklch(0.625_0.187_145/0.15)] text-[oklch(0.45_0.18_145)]", border: "border-[oklch(0.625_0.187_145/0.25)]" },
    warning: { bg: "from-warning/15 to-warning/0", icon: "bg-warning/15 text-[oklch(0.55_0.18_70)]", border: "border-warning/20" },
  }[tone];

  return (
    <Card className={`p-5 border ${toneMap.border} bg-gradient-to-br ${toneMap.bg} hover:shadow-[var(--shadow-elevated)] transition-all duration-200 hover:-translate-y-0.5`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">{label}</div>
          <div className="text-4xl font-bold tracking-tight mt-2 font-display">{value}</div>
        </div>
        <div className={`grid place-items-center h-11 w-11 rounded-xl ${toneMap.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}