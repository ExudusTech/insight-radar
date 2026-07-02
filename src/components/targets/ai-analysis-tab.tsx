import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles, RefreshCw, Check, AlertTriangle, Zap, Target as TargetIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { analyzeTarget } from "@/lib/ai-analysis.functions";

type LegacyAnalysis = {
  positioning?: string;
  offer?: string;
  pricing?: string;
  sales_process?: string;
  differentials?: string[];
  weaknesses?: string[];
  opportunities?: string;
  overall_score?: number;
  summary?: string;
};

type Weakness = { texto: string; critico?: boolean };
type Opportunity = { texto: string; prazo?: "quick_win" | "medio_prazo" };
type StrategicAnalysis = {
  score_geral?: number;
  score_breakdown?: Record<string, number>;
  nivel?: string;
  sintese_executiva?: string;
  posicionamento?: string;
  oferta?: string;
  precos?: string;
  processo_venda?: string;
  diferenciais?: string[];
  fraquezas?: Array<string | Weakness>;
  oportunidades?: Array<string | Opportunity>;
  insight_para_cliente?: string[];
};
type Analysis = StrategicAnalysis & LegacyAnalysis;

const DIM_LABELS: Record<string, string> = {
  posicionamento: "Posicionamento",
  funil_aquisicao: "Funil",
  oferta: "Oferta",
  processo_venda: "Processo",
  experiencia_lead: "Experiência",
};

function scoreTone(s: number) {
  if (s <= 4) return { text: "text-red-600 dark:text-red-400", border: "border-l-red-500", bg: "bg-red-500", ring: "border-red-500/40" };
  if (s <= 6) return { text: "text-amber-600 dark:text-amber-400", border: "border-l-amber-500", bg: "bg-amber-500", ring: "border-amber-500/40" };
  return { text: "text-emerald-600 dark:text-emerald-400", border: "border-l-emerald-500", bg: "bg-emerald-500", ring: "border-emerald-500/40" };
}

function normalizeAnalysis(a: Analysis) {
  const score = a.score_geral ?? a.overall_score ?? null;
  const sintese = a.sintese_executiva ?? a.summary;
  const posic = a.posicionamento ?? a.positioning;
  const oferta = a.oferta ?? a.offer;
  const precos = a.precos ?? a.pricing;
  const processo = a.processo_venda ?? a.sales_process;
  const diferenciais = a.diferenciais ?? a.differentials ?? [];
  const fraquezas: Weakness[] = (a.fraquezas ?? a.weaknesses ?? []).map((f) =>
    typeof f === "string" ? { texto: f } : f,
  );
  const rawOps = a.oportunidades ?? (a.opportunities ? [a.opportunities] : []);
  const oportunidades: Opportunity[] = rawOps.map((o) => (typeof o === "string" ? { texto: o } : o));
  return {
    score,
    breakdown: a.score_breakdown ?? null,
    nivel: a.nivel ?? null,
    sintese,
    posic,
    oferta,
    precos,
    processo,
    diferenciais,
    fraquezas,
    oportunidades,
    insights: a.insight_para_cliente ?? [],
  };
}

const reportsKey = (id: string) => ["reports", "by-target", id] as const;

export function AiAnalysisTab({ targetId }: { targetId: string }) {
  const qc = useQueryClient();
  const { data: reports = [], isLoading } = useQuery({
    queryKey: reportsKey(targetId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("target_id", targetId)
        .eq("report_type", "individual")
        .order("generated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const analyze = useServerFn(analyzeTarget);
  const mut = useMutation({
    mutationFn: () => analyze({ data: { targetId } }),
    onSuccess: () => {
      toast.success("Análise gerada");
      qc.invalidateQueries({ queryKey: reportsKey(targetId) });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const latest = reports[0];
  const a = (latest?.content ?? {}) as Analysis;
  const v = normalizeAnalysis(a);
  const tone = v.score !== null ? scoreTone(v.score) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {latest
            ? `Última análise: ${new Date(latest.generated_at).toLocaleString("pt-BR")}`
            : "Nenhuma análise ainda."}
        </div>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : latest ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {latest ? "Regenerar análise" : "Sugerir análise com IA"}
        </Button>
      </div>

      {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}

      {latest && (
        <div className="space-y-4">
          {v.score !== null && tone && (
            <Card className="p-6">
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Score geral</div>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className={`text-6xl font-bold ${tone.text}`}>{v.score}</span>
                    <span className="text-lg text-muted-foreground">/10</span>
                  </div>
                  {v.nivel && <div className={`mt-2 text-sm font-semibold ${tone.text}`}>{v.nivel}</div>}
                </div>
                {v.breakdown && (
                  <div className="flex flex-wrap gap-2 flex-1 justify-end">
                    {Object.entries(v.breakdown).map(([k, val]) => {
                      const t = scoreTone(val);
                      return (
                        <div key={k} className={`px-3 py-1.5 rounded-full border ${t.ring} text-xs flex items-center gap-1.5`}>
                          <span className="text-muted-foreground">{DIM_LABELS[k] ?? k}</span>
                          <span className={`font-bold ${t.text}`}>{val}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          )}

          {v.sintese && (
            <Card className={`p-5 border-l-4 ${tone?.border ?? "border-l-primary"}`}>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Síntese executiva</div>
              <div className="text-sm leading-relaxed space-y-2 whitespace-pre-wrap">{v.sintese}</div>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Block title="Posicionamento" text={v.posic} />
            <Block title="Oferta" text={v.oferta} />
            <Block title="Preços" text={v.precos} />
            <Block title="Processo de venda" text={v.processo} />
          </div>

          {v.diferenciais.length > 0 && (
            <Card className="p-5 border-emerald-500/40 bg-emerald-500/5">
              <div className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mb-3 font-semibold">
                Diferenciais
              </div>
              <ul className="space-y-2">
                {v.diferenciais.map((it, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {v.fraquezas.length > 0 && (
            <Card className="p-5 border-red-500/40 bg-red-500/5">
              <div className="text-xs uppercase tracking-wide text-red-700 dark:text-red-400 mb-3 font-semibold">
                Fraquezas / Falhas críticas
              </div>
              <ul className="space-y-2">
                {v.fraquezas.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm items-start">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="flex-1">{f.texto}</span>
                    {f.critico && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">CRÍTICO</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {v.oportunidades.length > 0 && (() => {
            const quick = v.oportunidades.filter((o) => o.prazo === "quick_win");
            const medium = v.oportunidades.filter((o) => o.prazo === "medio_prazo");
            const other = v.oportunidades.filter((o) => !o.prazo);
            const groups: Array<[string, Opportunity[]]> = [];
            if (quick.length) groups.push(["Quick wins", quick]);
            if (medium.length) groups.push(["Médio prazo", medium]);
            if (other.length) groups.push([groups.length ? "Outras" : "Oportunidades", other]);
            return (
              <Card className="p-5 border-amber-500/40 bg-amber-500/5">
                <div className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-3 font-semibold flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5" /> Oportunidades
                </div>
                <div className="space-y-4">
                  {groups.map(([label, items]) => (
                    <div key={label}>
                      <div className="text-xs font-medium text-muted-foreground mb-2">{label}</div>
                      <ul className="space-y-2">
                        {items.map((o, i) => (
                          <li key={i} className="flex gap-2 text-sm">
                            <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <span>{o.texto}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })()}

          {v.insights.length > 0 && (
            <Card className="p-5 border-primary/40 bg-primary/5">
              <div className="text-xs uppercase tracking-wide text-primary mb-3 font-semibold flex items-center gap-2">
                <TargetIcon className="h-3.5 w-3.5" /> Ações estratégicas para o cliente
              </div>
              <ul className="space-y-2">
                {v.insights.map((it, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-primary font-bold">→</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Block({ title, text }: { title: string; text?: string }) {
  if (!text) return null;
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{title}</div>
      <p className="text-sm">{text}</p>
    </Card>
  );
}

function ListBlock({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{title}</div>
      <ul className="text-sm list-disc pl-4 space-y-1">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </Card>
  );
}