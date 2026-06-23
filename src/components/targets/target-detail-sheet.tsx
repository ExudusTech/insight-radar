import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getTarget, targetDetailKey } from "@/lib/targets.queries";
import { StatusBadge } from "./status-badge";
import { PriorityBadge } from "./priority-badge";
import { Loader2, ExternalLink, Instagram, Linkedin, Phone, Globe, Mail } from "lucide-react";

export function TargetDetailSheet({
  targetId,
  open,
  onOpenChange,
  targetLabel,
}: {
  targetId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetLabel: string;
}) {
  const { data: target, isLoading } = useQuery({
    queryKey: targetDetailKey(targetId ?? ""),
    queryFn: () => getTarget(targetId!),
    enabled: !!targetId && open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{target?.name ?? targetLabel}</SheetTitle>
        </SheetHeader>
        {isLoading || !target ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-4">
              <StatusBadge status={target.status} />
              <PriorityBadge priority={target.priority} />
            </div>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                <TabsTrigger value="collection" disabled>Coleta</TabsTrigger>
                <TabsTrigger value="timeline" disabled>Timeline</TabsTrigger>
                <TabsTrigger value="evidences" disabled>Evidências</TabsTrigger>
                <TabsTrigger value="journey" disabled>Jornada</TabsTrigger>
                <TabsTrigger value="ai" disabled>Análise IA</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="space-y-5 pt-5">
                <Section title="Identificação">
                  <KV k="Nome" v={target.name} />
                  <KV k="Marca" v={target.brand} />
                  <KV k="Categoria" v={target.category} />
                </Section>
                <Section title="Contatos e links">
                  <KVLink k="Site" v={target.site} icon={Globe} />
                  <KVLink k="Instagram" v={target.instagram} icon={Instagram} />
                  <KVLink k="LinkedIn" v={target.linkedin} icon={Linkedin} />
                  <KV k="WhatsApp" v={target.whatsapp} icon={Phone} />
                  <KV k="Email" v={target.email} icon={Mail} />
                  <KV k="Outros links" v={target.other_links} />
                </Section>
                {target.notes && (
                  <Section title="Observações">
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap">{target.notes}</p>
                  </Section>
                )}
                <Section title="Metadados">
                  <KV k="Progresso" v={`${target.progress}%`} />
                  <KV k="Criado em" v={new Date(target.created_at).toLocaleString("pt-BR")} />
                  <KV k="Atualizado em" v={new Date(target.updated_at).toLocaleString("pt-BR")} />
                </Section>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">{children}</div>
    </div>
  );
}

function KV({ k, v, icon: Icon }: { k: string; v: string | number | null | undefined; icon?: React.ComponentType<{ className?: string }> }) {
  if (v === null || v === undefined || v === "") return null;
  return (
    <div className="text-sm">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</div>
      <div className="flex items-center gap-1.5 text-foreground/90">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span>{v}</span>
      </div>
    </div>
  );
}

function KVLink({ k, v, icon: Icon }: { k: string; v: string | null; icon: React.ComponentType<{ className?: string }> }) {
  if (!v) return null;
  return (
    <div className="text-sm">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</div>
      <a href={v} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
        <Icon className="h-3.5 w-3.5" />
        <span className="truncate">{v}</span>
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}