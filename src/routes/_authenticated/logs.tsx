import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Loader2, Download } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/logs")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: auth.user.id,
      _role: "superadmin",
    });
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: LogsPage,
});

const PAGE_SIZE = 50;

const ACTION_COLOR: Record<string, string> = {
  mission_created: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  document_frozen: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  target_collection_complete: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  targets_extracted: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  document_uploaded: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  document_extracted: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  target_created: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  block_saved: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  target_status_changed: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  target_status_changed_manual: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  assistant_interaction: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  assistant_message_sent: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  ai_analysis_generated: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  evidence_uploaded: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  timeline_event_created: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
  report_generated: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  brief_requested: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
  coordination_message_sent: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
  notification_dispatched: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
  mission_status_changed: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  mission_delivered: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  mission_analyst_assigned: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
  user_invited: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  user_login: "bg-muted text-muted-foreground border-border",
  user_logout: "bg-muted text-muted-foreground border-border",
  password_reset_link_generated: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  access_email_sent: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  user_role_changed: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  user_status_changed: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  strategic_access_changed: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  analyst_availability_changed: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
};

const ACTION_GROUPS: { label: string; actions: string[] }[] = [
  { label: "Autenticação", actions: ["user_login", "user_logout"] },
  {
    label: "Administração",
    actions: [
      "user_invited",
      "user_role_changed",
      "user_status_changed",
      "strategic_access_changed",
      "analyst_availability_changed",
      "password_reset_link_generated",
      "access_email_sent",
    ],
  },
  {
    label: "Missão",
    actions: [
      "mission_created",
      "mission_status_changed",
      "mission_delivered",
      "mission_sent_for_acceptance",
      "mission_analyst_assigned",
    ],
  },
  {
    label: "Alvo",
    actions: [
      "target_created",
      "target_status_changed",
      "target_status_changed_manual",
      "target_collection_complete",
      "targets_extracted",
      "block_saved",
      "evidence_uploaded",
      "timeline_event_created",
    ],
  },
  {
    label: "Documento",
    actions: ["document_uploaded", "document_extracted", "document_frozen"],
  },
  {
    label: "IA / Comunicação",
    actions: [
      "assistant_interaction",
      "assistant_message_sent",
      "ai_analysis_generated",
      "report_generated",
      "brief_requested",
      "coordination_message_sent",
      "notification_dispatched",
    ],
  },
];

function summarizeDetails(action: string, details: Record<string, unknown> | null): string | null {
  if (!details) return null;
  const d = details as Record<string, string | number | boolean | null | undefined>;
  const parts: string[] = [];
  if (action.startsWith("ai_") || action === "assistant_interaction" || action === "document_extracted") {
    if (d.model) parts.push(`model=${d.model}`);
    if (d.provider) parts.push(d.provider as string);
    if (d.tokens_in || d.tokens_out) parts.push(`tokens=${d.tokens_in ?? "?"}→${d.tokens_out ?? "?"}`);
  }
  if (action === "user_role_changed") parts.push(`role=${d.new_role}`);
  if (action === "user_status_changed") parts.push(`${d.from}→${d.to}`);
  if (action === "analyst_availability_changed" || action === "strategic_access_changed")
    parts.push(`${d.next ? "on" : "off"}`);
  if (action === "user_invited") parts.push(`${d.email} · ${d.role}`);
  if (action === "notification_dispatched" && d.type) parts.push(String(d.type));
  if (action === "coordination_message_sent" && d.length) parts.push(`${d.length} chars`);
  if (action === "brief_requested" && d.target_name) parts.push(String(d.target_name));
  if (action === "mission_analyst_assigned" && d.analyst_id) parts.push(`analyst=${String(d.analyst_id).slice(0, 8)}`);
  return parts.length ? parts.join(" · ") : null;
}

function toCsv(rows: LogRow[]): string {
  const header = ["timestamp", "user", "action", "entity_type", "entity_id", "mission", "details"];
  const escape = (v: unknown) => {
    const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.created_at,
        r.user?.email ?? r.user?.full_name ?? r.user_id ?? "",
        r.action,
        r.entity_type ?? "",
        r.entity_id ?? "",
        r.mission?.name ?? "",
        r.details ?? {},
      ]
        .map(escape)
        .join(","),
    );
  }
  return lines.join("\n");
}

type LogRow = {
  id: string;
  created_at: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  mission_id: string | null;
  user_id: string | null;
  details: Record<string, unknown> | null;
  user: { full_name: string | null; email: string | null } | null;
  mission: { id: string; name: string } | null;
};

function LogsPage() {
  const [page, setPage] = useState(0);
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [entityFilter, setEntityFilter] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["activity-logs", page, actionFilter, entityFilter, from, to, userFilter],
    queryFn: async () => {
      let q = supabase
        .from("activity_logs")
        .select(
          "*, user:profiles!activity_logs_user_id_fkey(full_name, email), mission:missions(id, name)",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (actionFilter) q = q.eq("action", actionFilter);
      if (entityFilter) q = q.eq("entity_type", entityFilter);
      if (from) q = q.gte("created_at", new Date(from).toISOString());
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        q = q.lte("created_at", end.toISOString());
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as LogRow[], count: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;

  const filteredRows = useMemo(() => {
    if (!userFilter.trim()) return rows;
    const f = userFilter.trim().toLowerCase();
    return rows.filter((r) => {
      const name = r.user?.full_name?.toLowerCase() ?? "";
      const email = r.user?.email?.toLowerCase() ?? "";
      return name.includes(f) || email.includes(f);
    });
  }, [rows, userFilter]);

  const { data: actionList = [] } = useQuery({
    queryKey: ["activity-logs", "distinct-actions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("action")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return Array.from(new Set((data ?? []).map((r) => r.action))).sort();
    },
  });

  const { data: entityList = [] } = useQuery({
    queryKey: ["activity-logs", "distinct-entities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("entity_type")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return Array.from(new Set((data ?? []).map((r) => r.entity_type).filter(Boolean) as string[])).sort();
    },
  });

  function downloadCsv() {
    const csv = toCsv(filteredRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const groupedActionSet = new Set(ACTION_GROUPS.flatMap((g) => g.actions));
  const ungroupedActions = actionList.filter((a) => !groupedActionSet.has(a));

  const toggle = (id: string) => {
    const n = new Set(expanded);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setExpanded(n);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Logs de Atividade</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {total} eventos · página {page + 1} / {totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={downloadCsv} disabled={filteredRows.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <Card className="p-3 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Usuário</label>
          <Input
            placeholder="Nome ou email…"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="mt-1 h-9"
          />
        </div>
        <div className="min-w-[220px]">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Ação</label>
          <Select
            value={actionFilter || "__all"}
            onValueChange={(v) => {
              setActionFilter(v === "__all" ? "" : v);
              setPage(0);
            }}
          >
            <SelectTrigger className="mt-1 h-9">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent className="max-h-[400px]">
              <SelectItem value="__all">Todas</SelectItem>
              {ACTION_GROUPS.map((g) => {
                const items = g.actions.filter((a) => actionList.includes(a));
                if (items.length === 0) return null;
                return (
                  <SelectGroup key={g.label}>
                    <SelectLabel>{g.label}</SelectLabel>
                    {items.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
              {ungroupedActions.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Outros</SelectLabel>
                  {ungroupedActions.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[160px]">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Entidade</label>
          <Select
            value={entityFilter || "__all"}
            onValueChange={(v) => {
              setEntityFilter(v === "__all" ? "" : v);
              setPage(0);
            }}
          >
            <SelectTrigger className="mt-1 h-9">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas</SelectItem>
              {entityList.map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">De</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(0); }}
            className="mt-1 h-9"
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Até</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(0); }}
            className="mt-1 h-9"
          />
        </div>
        {(actionFilter || entityFilter || from || to || userFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActionFilter("");
              setEntityFilter("");
              setFrom("");
              setTo("");
              setUserFilter("");
              setPage(0);
            }}
          >
            Limpar filtros
          </Button>
        )}
      </Card>

      <Card className="overflow-x-auto">
        {isLoading ? (
          <div className="grid place-items-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Data/hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Missão</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((r) => {
                const isOpen = expanded.has(r.id);
                const color = ACTION_COLOR[r.action] ?? "bg-muted text-foreground border-border";
                const userLabel = r.user?.full_name?.trim() || r.user?.email || (r.user_id ? r.user_id.slice(0, 8) : "—");
                const summary = summarizeDetails(r.action, r.details);
                return (
                  <>
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => toggle(r.id)}>
                      <TableCell className="py-2">
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-sm">{userLabel}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-mono text-[10px] ${color}`}>
                          {r.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.mission ? (
                          <Link
                            to="/missions/$missionId"
                            params={{ missionId: r.mission.id }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary hover:underline"
                          >
                            {r.mission.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.entity_type ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono max-w-[280px] truncate">
                        {summary ?? "—"}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow key={`${r.id}-d`}>
                        <TableCell colSpan={7} className="bg-muted/30">
                          <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed">
                            {JSON.stringify(r.details ?? {}, null, 2)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum log encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" disabled={page === 0 || isFetching} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          Anterior
        </Button>
        <span className="text-xs text-muted-foreground">
          {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
        </span>
        <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total || isFetching} onClick={() => setPage((p) => p + 1)}>
          Próxima
        </Button>
      </div>
    </div>
  );
}