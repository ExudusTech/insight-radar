import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EVIDENCE_TYPES, EVIDENCE_TYPE_LABEL, getEvidenceSignedUrl } from "@/lib/evidences.queries";
import { Loader2, FileText, Film, Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/evidences")({
  component: EvidencesPage,
});

function EvidencesPage() {
  const [missionId, setMissionId] = useState("all");
  const [type, setType] = useState("all");
  const [targetId, setTargetId] = useState("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["evidences", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evidences")
        .select("*, mission:missions(id, name), target:targets(id, name)")
        .order("captured_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const missions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) {
      const mm = r.mission as { id: string; name: string } | null;
      if (mm) m.set(mm.id, mm.name);
    }
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [rows]);

  const targets = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) {
      const tt = r.target as { id: string; name: string } | null;
      if (tt) m.set(tt.id, tt.name);
    }
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = rows.filter((r) => {
    if (missionId !== "all" && r.mission_id !== missionId) return false;
    if (targetId !== "all" && r.target_id !== targetId) return false;
    if (type !== "all" && r.evidence_type !== type) return false;
    return true;
  });

  const urls = useQueries({
    queries: filtered.map((r) => ({
      queryKey: ["evidence-url", r.id, r.file_url],
      queryFn: () => getEvidenceSignedUrl(r.file_url!),
      enabled: !!r.file_url,
      staleTime: 30 * 60 * 1000,
    })),
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Evidências</h1>
      <div className="flex flex-wrap gap-2">
        <Select value={missionId} onValueChange={setMissionId}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Missão" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as missões</SelectItem>
            {missions.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={targetId} onValueChange={setTargetId}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Alvo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os alvos</SelectItem>
            {targets.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {EVIDENCE_TYPES.map((t) => <SelectItem key={t} value={t}>{EVIDENCE_TYPE_LABEL[t]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((r, i) => {
            const url = urls[i]?.data;
            const m = r.mission as { id: string; name: string } | null;
            const t = r.target as { id: string; name: string } | null;
            const isImg = r.evidence_type === "screenshot" || r.evidence_type === "print";
            const Icon = r.evidence_type === "gravacao" ? Film : FileText;
            return (
              <Card key={r.id} className="overflow-hidden">
                {url && isImg ? (
                  <a href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt={r.caption ?? ""} className="w-full h-32 object-cover" />
                  </a>
                ) : (
                  <a href={url} target="_blank" rel="noreferrer" className="h-32 grid place-items-center bg-muted">
                    {isImg ? <ImageIcon className="h-8 w-8 text-muted-foreground" /> : <Icon className="h-8 w-8 text-muted-foreground" />}
                  </a>
                )}
                <div className="p-2 space-y-1">
                  <Badge variant="outline" className="text-[10px]">{EVIDENCE_TYPE_LABEL[r.evidence_type as never] ?? r.evidence_type}</Badge>
                  {r.caption && <div className="text-xs line-clamp-2">{r.caption}</div>}
                  <div className="text-[10px] text-muted-foreground">{t?.name} · {m?.name}</div>
                </div>
              </Card>
            );
          })}
          {filtered.length === 0 && <div className="col-span-full text-center text-muted-foreground py-8">Nenhuma evidência.</div>}
        </div>
      )}
    </div>
  );
}