import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { analyzeTarget } from "@/lib/ai-analysis.functions";

type Analysis = {
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
  const score = a.overall_score ?? null;

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
        <div className="space-y-3">
          {score !== null && (
            <Card className="p-4 flex items-center justify-between">
              <div className="text-sm font-medium">Score geral</div>
              <Badge
                variant={score >= 8 ? "default" : score >= 5 ? "secondary" : "destructive"}
                className="text-base"
              >
                {score}/10
              </Badge>
            </Card>
          )}
          {a.summary && (
            <Card className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Síntese executiva
              </div>
              <p className="text-sm leading-relaxed">{a.summary}</p>
            </Card>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Block title="Posicionamento" text={a.positioning} />
            <Block title="Oferta" text={a.offer} />
            <Block title="Preços" text={a.pricing} />
            <Block title="Processo de venda" text={a.sales_process} />
            <ListBlock title="Diferenciais" items={a.differentials} />
            <ListBlock title="Fraquezas" items={a.weaknesses} />
          </div>
          {a.opportunities && (
            <Card className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Oportunidades
              </div>
              <p className="text-sm">{a.opportunities}</p>
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