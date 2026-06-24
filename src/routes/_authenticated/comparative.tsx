import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { generateComparative } from "@/lib/ai-analysis.functions";
import { Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/comparative")({
  component: ComparativePage,
});

type TargetAnalysis = {
  positioning?: string;
  offer?: string;
  pricing?: string;
  sales_process?: string;
  overall_score?: number;
};

type Comparative = {
  market_overview?: string;
  price_range?: { min?: number; max?: number; average?: number };
  best_positioning?: string;
  market_gaps?: string[];
  strategic_recommendations?: string[];
  ranking?: Array<{ target: string; score: number; reason: string }>;
};

function ComparativePage() {
  const qc = useQueryClient();
  const [missionId, setMissionId] = useState<string>("");

  const { data: missions = [] } = useQuery({
    queryKey: ["missions", "select"],
    queryFn: async () => {
      const { data } = await supabase.from("missions").select("id, name").order("name");
      return data ?? [];
    },
  });

  const { data: targets = [] } = useQuery({
    queryKey: ["comparative", "targets", missionId],
    queryFn: async () => {
      const { data } = await supabase.from("targets").select("id, name").eq("mission_id", missionId);
      return data ?? [];
    },
    enabled: !!missionId,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["comparative", "reports", missionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("reports")
        .select("*")
        .eq("mission_id", missionId)
        .order("generated_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!missionId,
  });

  const latestByTarget = new Map<string, TargetAnalysis>();
  for (const r of reports) {
    if (r.report_type === "individual" && r.target_id && !latestByTarget.has(r.target_id)) {
      latestByTarget.set(r.target_id, (r.content ?? {}) as TargetAnalysis);
    }
  }
  const latestComparative = reports.find((r) => r.report_type === "comparative");
  const comp = (latestComparative?.content ?? {}) as Comparative;

  const genFn = useServerFn(generateComparative);
  const mut = useMutation({
    mutationFn: () => genFn({ data: { missionId } }),
    onSuccess: () => {
      toast.success("Análise comparativa gerada");
      qc.invalidateQueries({ queryKey: ["comparative", "reports", missionId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const dims: Array<{ key: keyof TargetAnalysis; label: string }> = [
    { key: "positioning", label: "Posicionamento" },
    { key: "offer", label: "Oferta" },
    { key: "pricing", label: "Preços" },
    { key: "sales_process", label: "Processo de venda" },
    { key: "overall_score", label: "Score geral" },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Comparativo</h1>
        <div className="flex gap-2">
          <Select value={missionId} onValueChange={setMissionId}>
            <SelectTrigger className="w-[280px]"><SelectValue placeholder="Selecione uma missão" /></SelectTrigger>
            <SelectContent>
              {missions.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => mut.mutate()} disabled={!missionId || mut.isPending || targets.length === 0}>
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Gerar análise comparativa
          </Button>
        </div>
      </div>

      {missionId && targets.length > 0 && (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Dimensão</TableHead>
                {targets.map((t) => <TableHead key={t.id}>{t.name}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dims.map((d) => (
                <TableRow key={d.key}>
                  <TableCell className="font-medium">{d.label}</TableCell>
                  {targets.map((t) => {
                    const a = latestByTarget.get(t.id);
                    const v = a?.[d.key];
                    return (
                      <TableCell key={t.id} className="text-sm align-top">
                        {v === undefined || v === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : d.key === "overall_score" ? (
                          <Badge>{String(v)}/10</Badge>
                        ) : (
                          String(v)
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {latestComparative && (
        <Card className="p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Análise comparativa</h2>
            <p className="text-xs text-muted-foreground">{new Date(latestComparative.generated_at).toLocaleString("pt-BR")}</p>
          </div>
          {comp.market_overview && (
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Visão geral</div>
              <p className="text-sm">{comp.market_overview}</p>
            </div>
          )}
          {comp.price_range && (
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Faixa de preços</div>
              <p className="text-sm">Min: {comp.price_range.min ?? "—"} · Méd: {comp.price_range.average ?? "—"} · Max: {comp.price_range.max ?? "—"}</p>
            </div>
          )}
          {comp.best_positioning && (
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Melhor posicionamento</div>
              <p className="text-sm">{comp.best_positioning}</p>
            </div>
          )}
          {comp.market_gaps && comp.market_gaps.length > 0 && (
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Gaps de mercado</div>
              <ul className="text-sm list-disc pl-5">{comp.market_gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
            </div>
          )}
          {comp.strategic_recommendations && comp.strategic_recommendations.length > 0 && (
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Recomendações estratégicas</div>
              <ul className="text-sm list-disc pl-5">{comp.strategic_recommendations.map((g, i) => <li key={i}>{g}</li>)}</ul>
            </div>
          )}
          {comp.ranking && comp.ranking.length > 0 && (
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Ranking</div>
              <ol className="text-sm list-decimal pl-5 space-y-1">
                {comp.ranking.map((r, i) => (
                  <li key={i}><span className="font-medium">{r.target}</span> · <Badge variant="secondary">{r.score}/10</Badge> — <span className="text-muted-foreground">{r.reason}</span></li>
                ))}
              </ol>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}