import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getTarget,
  targetDetailKey,
  targetsByMissionKey,
  updateTargetStatus,
} from "@/lib/targets.queries";
import { StatusBadge } from "./status-badge";
import { PriorityBadge } from "./priority-badge";
import { CollectionTab } from "./collection-tab";
import { TimelineTab } from "./timeline-tab";
import { EvidencesTab } from "./evidences-tab";
import { AiAnalysisTab } from "./ai-analysis-tab";
import {
  Loader2,
  ExternalLink,
  Instagram,
  Linkedin,
  Phone,
  Globe,
  Mail,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { COLLECTION_BLOCKS } from "@/lib/collection.queries";
import { MissionAssistantPanel } from "./MissionAssistantPanel";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  collectionByTargetKey,
  countCompleteBlocks,
  listCollectionByTarget,
} from "@/lib/collection.queries";
import {
  interactionsByTargetKey,
  listInteractionsByTarget,
} from "@/lib/interactions.queries";
import {
  evidencesByTargetKey,
  listEvidencesByTarget,
} from "@/lib/evidences.queries";
import {
  TARGET_STATUS_LABEL,
  TARGET_STATUS_ORDER,
  type TargetStatus,
} from "@/lib/target-status";
import { logActivity } from "@/lib/activity-log";

export function TargetDetailSheet({
  targetId,
  open,
  onOpenChange,
  targetLabel,
  defaultTab,
}: {
  targetId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetLabel: string;
  defaultTab?: "overview" | "collection" | "timeline" | "evidences" | "ai" | "assistant";
}) {
  const { data: currentUser } = useCurrentUser();
  const resolvedDefault =
    defaultTab ?? (currentUser?.role === "analyst" ? "assistant" : "overview");
  const { data: target, isLoading } = useQuery({
    queryKey: targetDetailKey(targetId ?? ""),
    queryFn: () => getTarget(targetId!),
    enabled: !!targetId && open,
  });

  const qc = useQueryClient();

  const { data: collectionRows = [] } = useQuery({
    queryKey: collectionByTargetKey(targetId ?? ""),
    queryFn: () => listCollectionByTarget(targetId!),
    enabled: !!targetId && open,
  });
  const { data: interactions = [] } = useQuery({
    queryKey: interactionsByTargetKey(targetId ?? ""),
    queryFn: () => listInteractionsByTarget(targetId!),
    enabled: !!targetId && open,
  });
  const { data: evidences = [] } = useQuery({
    queryKey: evidencesByTargetKey(targetId ?? ""),
    queryFn: () => listEvidencesByTarget(targetId!),
    enabled: !!targetId && open,
  });

  const blocksDone = countCompleteBlocks(collectionRows);
  const lastInteraction = interactions[0];

  const statusMut = useMutation({
    mutationFn: (next: TargetStatus) => {
      if (!target) throw new Error("Sem alvo");
      return updateTargetStatus(target.id, next, target.status, target.mission_id);
    },
    onSuccess: (_data, next) => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: targetDetailKey(targetId ?? "") });
      if (target) qc.invalidateQueries({ queryKey: targetsByMissionKey(target.mission_id) });
      if (currentUser?.id && target) {
        logActivity({
          userId: currentUser.id,
          missionId: target.mission_id,
          action: "target_status_changed_manual",
          entityType: "target",
          entityId: target.id,
          details: { to: next },
        });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
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
            <Tabs defaultValue={resolvedDefault} className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                <TabsTrigger value="collection">Coleta</TabsTrigger>
                <TabsTrigger value="assistant">
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Assistente IA
                </TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="evidences">Evidências</TabsTrigger>
                <TabsTrigger value="journey" disabled>Jornada</TabsTrigger>
                <TabsTrigger value="ai">Análise IA</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="space-y-5 pt-5">
                <Section title="Status rápido">
                  <div className="col-span-2 space-y-3">
                    <Select
                      value={target.status}
                      onValueChange={(v) => statusMut.mutate(v as TargetStatus)}
                      disabled={statusMut.isPending}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TARGET_STATUS_ORDER.map((s) => (
                          <SelectItem key={s} value={s}>{TARGET_STATUS_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Progresso da coleta</span>
                        <span>{blocksDone}/7 blocos</span>
                      </div>
                      <Progress value={(blocksDone / 7) * 100} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded border p-2">
                        <div className="text-muted-foreground">Última interação</div>
                        <div className="font-medium">
                          {lastInteraction
                            ? new Date(lastInteraction.event_at).toLocaleDateString("pt-BR")
                            : "—"}
                        </div>
                        {lastInteraction?.content && (
                          <div className="text-muted-foreground line-clamp-2 mt-1">
                            {lastInteraction.content}
                          </div>
                        )}
                      </div>
                      <div className="rounded border p-2">
                        <div className="text-muted-foreground">Evidências</div>
                        <div className="font-medium text-lg">{evidences.length}</div>
                      </div>
                    </div>
                  </div>
                </Section>
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
              <TabsContent value="collection" className="pt-5">
                <CollectionTab missionId={target.mission_id} targetId={target.id} />
              </TabsContent>
              <TabsContent value="assistant" className="pt-5">
                <div className="space-y-3">
                  {COLLECTION_BLOCKS.map((block) => (
                    <Collapsible key={block}>
                      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50 group">
                        <span>Bloco {block}</span>
                        <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">
                        <MissionAssistantPanel
                          missionId={target.mission_id}
                          targetId={target.id}
                          block={block}
                          targetName={target.name}
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="timeline" className="pt-5">
                <TimelineTab missionId={target.mission_id} targetId={target.id} />
              </TabsContent>
              <TabsContent value="evidences" className="pt-5">
                <EvidencesTab missionId={target.mission_id} targetId={target.id} />
              </TabsContent>
              <TabsContent value="ai" className="pt-5">
                <AiAnalysisTab targetId={target.id} />
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