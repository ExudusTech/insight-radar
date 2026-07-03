import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Telescope } from "lucide-react";

export const Route = createFileRoute("/_authenticated/strategic")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw redirect({ to: "/auth" });
    const [{ data: isAdmin }, { data: profile }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: auth.user.id, _role: "superadmin" }),
      supabase.from("profiles").select("can_view_strategic").eq("id", auth.user.id).maybeSingle(),
    ]);
    const canView =
      isAdmin ||
      (profile as { can_view_strategic?: boolean } | null)?.can_view_strategic === true;
    if (!canView) throw redirect({ to: "/dashboard" });
  },
  component: StrategicPage,
});

const UPCOMING = [
  { title: "Tração e Piloto", desc: "Resultados iniciais, métricas de adoção e aprendizados do piloto." },
  { title: "Modelo de Negócio", desc: "Estrutura de receita, precificação e unit economics." },
  { title: "Roadmap", desc: "Prioridades, marcos e visão de produto para os próximos ciclos." },
  { title: "Oportunidade de Parceria", desc: "Formatos de colaboração, investimento e co-construção." },
];

function StrategicPage() {
  const { data: doc, isLoading } = useQuery({
    queryKey: ["strategic-documents", "o-sistema"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strategic_documents")
        .select("id, title, content, is_published")
        .eq("title", "O Sistema")
        .eq("is_published", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Telescope className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Visão Estratégica</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Acesso restrito — informações estratégicas sobre o projeto Radar de Mercado IA.
        </p>
        <Badge variant="outline" className="text-xs">
          Acesso concedido pelo administrador
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>O Sistema</CardTitle>
          <CardDescription>O que é, qual dor resolve e como funciona.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid place-items-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : doc?.content ? (
            <div className="prose prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
              {doc.content}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Documento sendo preparado.</p>
          )}
        </CardContent>
      </Card>

      {UPCOMING.map((s) => (
        <Card key={s.title} className="opacity-80">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">{s.title}</CardTitle>
              <Badge variant="secondary" className="text-[10px]">Em breve</Badge>
            </div>
            <CardDescription>{s.desc}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}