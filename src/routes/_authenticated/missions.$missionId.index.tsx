import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Upload,
  Rocket,
  FileText,
  AlertTriangle,
  Check,
  CalendarClock,
  Lock,
  MessageSquare,
} from "lucide-react";
import { format } from "date-fns";
import { DatePickerField, parseLocalDate } from "@/components/ui/date-picker";
import {
  getMission,
  listMissionAnalysts,
  listMissionContractors,
  missionAnalystsKey,
  missionContractorsKey,
  missionDetailKey,
  updateMission,
  type Mission,
} from "@/lib/missions.queries";
import { getProduct } from "@/lib/products.queries";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  docVersionsKey,
  listDocumentVersions,
  uploadAndCreateVersion,
} from "@/lib/document-versions.queries";
import { sendNotifications } from "@/lib/notifications.functions";
import { assignAnalystToMission } from "@/lib/missions.functions";
import { useServerFn } from "@tanstack/react-start";
import { logActivity } from "@/lib/activity-log";
import { ChannelRotationCard } from "@/components/missions/channel-rotation-card";
import { ContractorOverview } from "@/components/missions/contractor-overview";
import { isPreAcceptance } from "@/lib/target-status";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { briefingMessagesKey, listBriefingMessages } from "@/lib/briefing-messages.queries";
import { listProfilesWithRole } from "@/lib/missions.queries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/missions/$missionId/")({
  component: MissionOverview,
});

function MissionOverview() {
  const { missionId } = Route.useParams();
  const { data: currentUser } = useCurrentUser();
  const { data: mission } = useQuery({
    queryKey: missionDetailKey(missionId),
    queryFn: () => getMission(missionId),
  });
  const { data: analysts = [] } = useQuery({
    queryKey: missionAnalystsKey(missionId),
    queryFn: () => listMissionAnalysts(missionId),
  });
  const { data: extraContractors = [] } = useQuery({
    queryKey: missionContractorsKey(missionId),
    queryFn: () => listMissionContractors(missionId),
  });
  const productId = (mission as { product_id?: string | null } | undefined)?.product_id ?? null;
  const { data: product } = useQuery({
    queryKey: ["products", "detail", productId],
    queryFn: () => getProduct(productId!),
    enabled: !!productId,
  });

  if (!mission) return null;
  const contractor =
    (mission as { contractor?: { full_name: string | null; email: string | null } | null }).contractor;

  const preAcceptance = isPreAcceptance(mission.status);
  const canEditBriefing =
    preAcceptance &&
    (currentUser?.role === "contractor" ||
      currentUser?.role === "superadmin" ||
      currentUser?.role === "coordinator");
  const canStartMission =
    currentUser?.role === "contractor" ||
    currentUser?.role === "superadmin" ||
    currentUser?.role === "coordinator";
  const canEditDetails =
    preAcceptance &&
    (currentUser?.role === "contractor" ||
      currentUser?.role === "superadmin" ||
      currentUser?.role === "coordinator");
  const isAnalystOfMission =
    !!currentUser && analysts.some((a) => a.analyst_id === currentUser.id);
  const canAssignAnalysts =
    currentUser?.role === "superadmin" || currentUser?.role === "coordinator";
  const showLockedBanner =
    !preAcceptance && currentUser?.role === "contractor";

  const isContractorExecutionView =
    currentUser?.role === "contractor" && !preAcceptance;

  if (isContractorExecutionView) {
    return (
      <div className="space-y-5">
        {showLockedBanner && (
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Missão em execução — os campos não podem mais ser alterados. Para
              ajustes, abra uma solicitação de mudança.
            </AlertDescription>
          </Alert>
        )}
        <ContractorOverview mission={mission as Mission} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-5">
        {showLockedBanner && (
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Missão em execução — os campos não podem mais ser alterados. Para
              ajustes, abra uma solicitação de mudança.
            </AlertDescription>
          </Alert>
        )}
        {canEditBriefing ? (
          <BriefingEnrichPanel
            missionId={missionId}
            missionName={mission.name}
            initialDescription={mission.description}
            canStart={canStartMission}
            currentUserId={currentUser?.id ?? null}
            mission={mission as Mission}
          />
        ) : (
          <Card className="p-6 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Briefing</h2>
            {mission.description ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{mission.description}</p>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-3">
                <Lock className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O briefing desta missão foi definido internamente. Em caso de dúvidas, entre em
                  contato com o coordenador.
                </p>
              </div>
            )}
            <ComplementsList missionId={missionId} readOnly />
          </Card>
        )}

        {currentUser?.role === "analyst" &&
          mission.status === "pending_acceptance" &&
          isAnalystOfMission && (
            <AnalystActionPanel mission={mission as Mission} />
          )}

        {(currentUser?.role === "contractor" || currentUser?.role === "superadmin") &&
          mission.status === "date_negotiation" &&
          mission.proposal_from === "analyst" && (
            <DateNegotiationPanel mission={mission as Mission} />
          )}

        {currentUser?.role === "analyst" &&
          mission.status === "date_negotiation" &&
          mission.proposal_from === "contractor" &&
          isAnalystOfMission && (
            <AnalystActionPanel mission={mission as Mission} showingCounterProposal />
          )}

        <Card className="p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Objetivo</h2>
          {mission.objective ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{mission.objective}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Sem objetivo definido.</p>
          )}
        </Card>

        {(mission as { entregavel_esperado?: string | null }).entregavel_esperado && (
          <Card className="p-6 space-y-2 border-primary/40 bg-primary/5">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">
                Entregável esperado
              </h2>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {(mission as { entregavel_esperado: string }).entregavel_esperado}
            </p>
            <p className="text-[11px] text-muted-foreground">
              A missão só é considerada concluída para cada concorrente quando este entregável for obtido e registrado.
            </p>
          </Card>
        )}

        <BriefingConversationCard missionId={missionId} />
      </div>
      <div className="space-y-5">
        {currentUser?.role === "superadmin" && (
          <ChannelRotationCard missionId={missionId} />
        )}
        <Card className="p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Detalhes</h2>
          {canEditDetails ? (
            <EditableDetails mission={mission as Mission} />
          ) : (
            <>
              <KV k="Segmento" v={mission.segment} />
              <KV k="Rótulo dos alvos" v={mission.target_label} />
              <KV k="Cliente principal" v={contractor?.full_name || contractor?.email} />
              <KV
                k="Primeira entrega"
                v={mission.deadline_first ? parseLocalDate(mission.deadline_first).toLocaleDateString("pt-BR") : null}
              />
              <KV
                k="Entrega final"
                v={mission.deadline_final ? parseLocalDate(mission.deadline_final).toLocaleDateString("pt-BR") : null}
              />
            </>
          )}
          {product && <KV k="Produto / Serviço" v={product.name} />}
          <KV
            k="Criada em"
            v={new Date(mission.created_at).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })}
          />
          {extraContractors.length > 0 && (
            <div className="text-sm">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Acesso adicional</div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {extraContractors.map((c) => {
                  const p = (c as { contractor?: { full_name: string | null; email: string | null } | null }).contractor;
                  return (
                    <Badge key={c.contractor_id} variant="outline">
                      {p?.full_name || p?.email || c.contractor_id.slice(0, 8)}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
        <Card className="p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Analistas</h2>
          {analysts.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nenhum analista atribuído.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {analysts.map((a) => {
                const profile =
                  (a as { analyst?: { full_name: string | null; email: string | null } | null }).analyst;
                return (
                  <Badge key={a.analyst_id} variant="outline">
                    {profile?.full_name || profile?.email || a.analyst_id.slice(0, 8)}
                  </Badge>
                );
              })}
            </div>
          )}
          {canAssignAnalysts && (
            <AssignAnalystControl
              missionId={missionId}
              alreadyAssigned={analysts.map((a) => a.analyst_id)}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function AssignAnalystControl({
  missionId,
  alreadyAssigned,
}: {
  missionId: string;
  alreadyAssigned: string[];
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>("");
  const { data: analystProfiles = [] } = useQuery({
    queryKey: ["profiles", "with-role", "analyst"],
    queryFn: () => listProfilesWithRole("analyst"),
  });
  const available = analystProfiles.filter((p) => !alreadyAssigned.includes(p.id));

  const mut = useMutation({
    mutationFn: async (analystId: string) => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase
        .from("mission_analysts")
        .insert({ mission_id: missionId, analyst_id: analystId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Analista atribuído.");
      setSelected("");
      qc.invalidateQueries({ queryKey: missionAnalystsKey(missionId) });
    },
    onError: (e: Error) => toast.error(e.message ?? "Erro ao atribuir"),
  });

  return (
    <div className="pt-2 border-t border-border/50 space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Atribuir analista
      </div>
      <div className="flex gap-2">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue placeholder="Selecionar analista..." />
          </SelectTrigger>
          <SelectContent>
            {available.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                Nenhum analista disponível
              </div>
            ) : (
              available.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name || p.email || p.id.slice(0, 8)}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={() => selected && mut.mutate(selected)}
          disabled={!selected || mut.isPending}
        >
          {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Atribuir"}
        </Button>
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="text-sm">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</div>
      <div className="text-foreground/90">{v || "—"}</div>
    </div>
  );
}

function BriefingConversationCard({ missionId }: { missionId: string }) {
  const { data: messages = [] } = useQuery({
    queryKey: briefingMessagesKey(missionId),
    queryFn: () => listBriefingMessages(missionId),
  });

  if (messages.length === 0) return null;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Conversa de Briefing
        </h2>
      </div>
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function EditableField({
  label,
  value,
  type = "text",
  onSave,
  hint,
  hintTone,
}: {
  label: string;
  value: string;
  type?: "text" | "date";
  onSave: (v: string) => Promise<void>;
  hint?: string | null;
  hintTone?: "error" | "warning";
}) {
  const [local, setLocal] = useState(value);
  const [saved, setSaved] = useState(false);
  useEffect(() => setLocal(value), [value]);
  return (
    <div className="text-sm space-y-1">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        {label}
        {saved && <Check className="h-3 w-3 text-emerald-600" />}
      </div>
      <Input
        type={type}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={async () => {
          if (local === value) return;
          try {
            await onSave(local);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erro ao salvar");
          }
        }}
        className="h-8"
      />
      {hint && (
        <p
          className={`text-[11px] ${
            hintTone === "error"
              ? "text-destructive"
              : "text-yellow-600 dark:text-yellow-400"
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function EditableDetails({ mission }: { mission: Mission }) {
  const qc = useQueryClient();
  const save = async (patch: {
    segment?: string | null;
    target_label?: string;
    deadline_first?: string | null;
    deadline_final?: string | null;
  }) => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase.from("missions").update(patch).eq("id", mission.id);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: missionDetailKey(mission.id) });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const finalHint = (() => {
    if (!mission.deadline_final) return null;
    const d = parseLocalDate(mission.deadline_final);
    const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
    if (diff < 0) return { text: "Esta data já passou.", tone: "error" as const };
    if (diff < 7)
      return { text: "Prazo muito curto (mínimo 7 dias).", tone: "warning" as const };
    return null;
  })();

  const partialHint = (() => {
    if (!mission.deadline_first) return null;
    const d = parseLocalDate(mission.deadline_first);
    if (d < today) return { text: "Esta data já passou.", tone: "error" as const };
    if (
      mission.deadline_final &&
      d >= parseLocalDate(mission.deadline_final)
    )
      return {
        text: "1ª entrega deve ser antes da entrega final.",
        tone: "error" as const,
      };
    return null;
  })();

  return (
    <div className="space-y-3">
      <EditableField
        label="Segmento"
        value={mission.segment ?? ""}
        onSave={(v) => save({ segment: v || null })}
      />
      <EditableField
        label="Rótulo dos alvos"
        value={mission.target_label ?? ""}
        onSave={(v) => save({ target_label: v || "Alvo" })}
      />
      <DatePickerField
        label="Primeira entrega"
        value={mission.deadline_first ?? ""}
        onChange={(v) => {
          save({ deadline_first: v || null }).catch((e) =>
            toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
          );
        }}
        error={partialHint?.text ?? null}
        disablePast
        size="sm"
      />
      <DatePickerField
        label="Entrega final"
        value={mission.deadline_final ?? ""}
        onChange={(v) => {
          save({ deadline_final: v || null }).catch((e) =>
            toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
          );
        }}
        error={finalHint?.tone === "error" ? finalHint.text : null}
        warning={finalHint?.tone === "warning" ? finalHint.text : null}
        disablePast
        size="sm"
      />
    </div>
  );
}

function validateBeforeStart(mission: Mission): string[] {
  const issues: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (mission.deadline_final) {
    const df = parseLocalDate(mission.deadline_final);
    const diff = Math.ceil((df.getTime() - today.getTime()) / 86400000);
    if (diff < 0)
      issues.push(
        `A data de entrega final (${format(df, "dd/MM/yyyy")}) já passou. Defina uma nova data.`,
      );
    else if (diff < 7)
      issues.push(
        `A entrega final está a apenas ${diff} dia(s). O mínimo recomendado é 7 dias para que o analista consiga conduzir todas as etapas da pesquisa.`,
      );
  } else {
    issues.push("Defina a data de entrega final antes de iniciar.");
  }

  if (mission.deadline_first) {
    const dp = parseLocalDate(mission.deadline_first);
    if (dp < today)
      issues.push(
        `A data da 1ª entrega (${format(dp, "dd/MM/yyyy")}) já passou. Atualize para uma data futura.`,
      );
    if (mission.deadline_final && dp >= parseLocalDate(mission.deadline_final))
      issues.push("A 1ª entrega deve ocorrer antes da entrega final.");
  }

  return issues;
}

function BriefingEnrichPanel({
  missionId,
  missionName,
  initialDescription,
  canStart,
  currentUserId,
  mission,
}: {
  missionId: string;
  missionName: string;
  initialDescription: string | null;
  canStart: boolean;
  currentUserId: string | null;
  mission: Mission;
}) {
  const qc = useQueryClient();
  const [description, setDescription] = useState(initialDescription ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const sendNotificationsFn = useServerFn(sendNotifications);
  const assignAnalystFn = useServerFn(assignAnalystToMission);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);

  useEffect(() => {
    setDescription(initialDescription ?? "");
  }, [initialDescription]);

  const saveMut = useMutation({
    mutationFn: () => updateMission(missionId, { description }),
    onSuccess: () => {
      toast.success("Rascunho salvo");
      qc.invalidateQueries({ queryKey: missionDetailKey(missionId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startMut = useMutation({
    mutationFn: async () => {
      await updateMission(missionId, { description });

      const { assignedId: assignedAnalystId } = await assignAnalystFn({
        data: { missionId },
      });

      const { supabase } = await import("@/integrations/supabase/client");
      const { error: statusErr } = await supabase
        .from("missions")
        .update({ status: "pending_acceptance" })
        .eq("id", missionId);
      if (statusErr) throw statusErr;

      if (assignedAnalystId) {
        await sendNotificationsFn({
          data: {
            notifications: [
              {
                user_id: assignedAnalystId,
                mission_id: missionId,
                type: "mission_pending_acceptance",
                message: `Nova missão para revisar: "${missionName}". Aceite ou proponha novos prazos.`,
              },
            ],
          },
        });
      }
      if (currentUserId) {
        await logActivity({
          userId: currentUserId,
          missionId,
          action: "mission_sent_for_acceptance",
          entityType: "mission",
          entityId: missionId,
        });
      }
    },
    onSuccess: () => {
      toast.success("Missão enviada ao analista. Aguardando aceite.");
      qc.invalidateQueries({ queryKey: missionDetailKey(missionId) });
      qc.invalidateQueries({ queryKey: missionAnalystsKey(missionId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleStartClick = () => {
    const issues = validateBeforeStart(mission);
    if (issues.length > 0) {
      setValidationIssues(issues);
      setShowValidationDialog(true);
      return;
    }
    startMut.mutate();
  };

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !currentUserId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadAndCreateVersion({
          missionId,
          file,
          authorId: currentUserId,
          docType: "complement",
          docLabel: "Complemento do cliente",
        });
      }
      toast.success("Arquivo(s) enviado(s)");
      qc.invalidateQueries({ queryKey: docVersionsKey(missionId) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Enriquecer Briefing
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Adicione contexto e materiais complementares antes de iniciar a missão.
          </p>
        </div>
        <Badge variant="outline">Rascunho</Badge>
      </div>
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Contexto adicional, instruções específicas, observações..."
        rows={6}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
        >
          {saveMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Salvar rascunho
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Anexar arquivo
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      <div className="flex">
        {canStart && (
          <Button
            size="sm"
            className="ml-auto"
            onClick={handleStartClick}
            disabled={startMut.isPending}
          >
            {startMut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Rocket className="h-3.5 w-3.5" />
            )}
            Iniciar missão
          </Button>
        )}
      </div>
      <ComplementsList missionId={missionId} readOnly={false} />
    </Card>
    <Dialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verifique as informações antes de iniciar</DialogTitle>
          <DialogDescription>
            Encontramos pontos que precisam ser ajustados para garantir que a missão possa ser
            executada com sucesso.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {validationIssues.map((issue, i) => (
            <div
              key={i}
              className="flex gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-md p-3"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{issue}</span>
            </div>
          ))}
          <p className="text-sm text-muted-foreground pt-1">
            Ajuste os campos na lateral e tente novamente.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowValidationDialog(false)}>
            Voltar e corrigir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

function AnalystActionPanel({
  mission,
  showingCounterProposal,
}: {
  mission: Mission;
  showingCounterProposal?: boolean;
}) {
  const [showDateForm, setShowDateForm] = useState(false);
  const [propPartial, setPropPartial] = useState(
    mission.proposed_deadline_partial ?? mission.deadline_first ?? "",
  );
  const [propFinal, setPropFinal] = useState(
    mission.proposed_deadline_final ?? mission.deadline_final ?? "",
  );
  const qc = useQueryClient();
  const sendNotificationsFn = useServerFn(sendNotifications);
  const { data: currentUser } = useCurrentUser();

  const acceptMut = useMutation({
    mutationFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const patch = showingCounterProposal
        ? {
            status: "execution_started" as const,
            deadline_first: mission.proposed_deadline_partial,
            deadline_final: mission.proposed_deadline_final,
            proposed_deadline_partial: null,
            proposed_deadline_final: null,
            proposal_from: null,
          }
        : { status: "execution_started" as const };
      const { error } = await supabase.from("missions").update(patch).eq("id", mission.id);
      if (error) throw error;
      if (currentUser?.id) {
        await logActivity({
          userId: currentUser.id,
          missionId: mission.id,
          action: "mission_status_changed",
          entityType: "mission",
          entityId: mission.id,
          details: { from: mission.status, to: "execution_started" },
        });
      }
      if (mission.contractor_id) {
        await sendNotificationsFn({
          data: {
            notifications: [
              {
                user_id: mission.contractor_id,
                mission_id: mission.id,
                type: "mission_accepted",
                message: `Sua missão "${mission.name}" foi aceita e a coleta de dados iniciou.`,
              },
            ],
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("Missão aceita!");
      qc.invalidateQueries({ queryKey: missionDetailKey(mission.id) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const proposeDateMut = useMutation({
    mutationFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase
        .from("missions")
        .update({
          status: "date_negotiation",
          proposed_deadline_partial: propPartial || null,
          proposed_deadline_final: propFinal || null,
          proposal_from: "analyst",
        })
        .eq("id", mission.id);
      if (error) throw error;
      if (currentUser?.id) {
        await logActivity({
          userId: currentUser.id,
          missionId: mission.id,
          action: "mission_status_changed",
          entityType: "mission",
          entityId: mission.id,
          details: { from: mission.status, to: "date_negotiation", proposal_from: "analyst" },
        });
      }
      if (mission.contractor_id) {
        await sendNotificationsFn({
          data: {
            notifications: [
              {
                user_id: mission.contractor_id,
                mission_id: mission.id,
                type: "date_proposal",
                message: `O analista da missão "${mission.name}" sugeriu novos prazos: 1ª entrega em ${propPartial ? format(parseLocalDate(propPartial), "dd/MM/yyyy") : "-"} e entrega final em ${propFinal ? format(parseLocalDate(propFinal), "dd/MM/yyyy") : "-"}.`,
              },
            ],
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("Proposta enviada ao cliente.");
      qc.invalidateQueries({ queryKey: missionDetailKey(mission.id) });
      setShowDateForm(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/20 dark:border-blue-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">
          {showingCounterProposal ? "Cliente propôs novos prazos" : "Nova missão atribuída"}
        </CardTitle>
        <CardDescription className="text-xs">
          {showingCounterProposal
            ? "O cliente propôs estas datas em resposta à sua sugestão."
            : "Revise os detalhes e confirme sua disponibilidade."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {showingCounterProposal && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">1ª Entrega proposta</p>
              <p className="font-medium">
                {mission.proposed_deadline_partial
                  ? format(parseLocalDate(mission.proposed_deadline_partial), "dd/MM/yyyy")
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Entrega final proposta</p>
              <p className="font-medium">
                {mission.proposed_deadline_final
                  ? format(parseLocalDate(mission.proposed_deadline_final), "dd/MM/yyyy")
                  : "—"}
              </p>
            </div>
          </div>
        )}
        {!showDateForm ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => acceptMut.mutate()} disabled={acceptMut.isPending}>
              {acceptMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <Check className="h-3.5 w-3.5" />{" "}
              {showingCounterProposal ? "Aceitar proposta" : "Aceitar missão"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowDateForm(true)}>
              <CalendarClock className="h-3.5 w-3.5" /> Propor{" "}
              {showingCounterProposal ? "outras datas" : "novos prazos"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Sugira datas alternativas para o cliente avaliar:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <DatePickerField
                label="1ª Entrega"
                value={propPartial}
                onChange={setPropPartial}
                disablePast
              />
              <DatePickerField
                label="Entrega Final"
                value={propFinal}
                onChange={setPropFinal}
                disablePast
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => proposeDateMut.mutate()}
                disabled={proposeDateMut.isPending}
              >
                {proposeDateMut.isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Enviar proposta
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowDateForm(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DateNegotiationPanel({ mission }: { mission: Mission }) {
  const [counter, setCounter] = useState({
    partial: mission.deadline_first ?? "",
    final: mission.deadline_final ?? "",
  });
  const [showCounter, setShowCounter] = useState(false);
  const qc = useQueryClient();
  const sendNotificationsFn = useServerFn(sendNotifications);

  const acceptProposalMut = useMutation({
    mutationFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase
        .from("missions")
        .update({
          status: "execution_started",
          deadline_first: mission.proposed_deadline_partial,
          deadline_final: mission.proposed_deadline_final,
          proposed_deadline_partial: null,
          proposed_deadline_final: null,
          proposal_from: null,
        })
        .eq("id", mission.id);
      if (error) throw error;
      const { data: ma } = await supabase
        .from("mission_analysts")
        .select("analyst_id")
        .eq("mission_id", mission.id);
      if (ma?.length) {
        await sendNotificationsFn({
          data: {
            notifications: ma.map((a) => ({
              user_id: a.analyst_id,
              mission_id: mission.id,
              type: "mission_accepted",
              message: `Cliente aceitou os novos prazos para "${mission.name}". A missão está em andamento.`,
            })),
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("Prazos aceitos. Missão iniciada!");
      qc.invalidateQueries({ queryKey: missionDetailKey(mission.id) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counterProposeMut = useMutation({
    mutationFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase
        .from("missions")
        .update({
          proposed_deadline_partial: counter.partial || null,
          proposed_deadline_final: counter.final || null,
          proposal_from: "contractor",
          status: "date_negotiation",
        })
        .eq("id", mission.id);
      if (error) throw error;
      const { data: ma } = await supabase
        .from("mission_analysts")
        .select("analyst_id")
        .eq("mission_id", mission.id);
      if (ma?.length) {
        await sendNotificationsFn({
          data: {
            notifications: ma.map((a) => ({
              user_id: a.analyst_id,
              mission_id: mission.id,
              type: "date_proposal",
              message: `O cliente propôs novos prazos para "${mission.name}": 1ª entrega em ${counter.partial ? format(parseLocalDate(counter.partial), "dd/MM/yyyy") : "-"}, entrega final em ${counter.final ? format(parseLocalDate(counter.final), "dd/MM/yyyy") : "-"}.`,
            })),
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("Contraproposta enviada ao analista.");
      qc.invalidateQueries({ queryKey: missionDetailKey(mission.id) });
      setShowCounter(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const proposed_partial = mission.proposed_deadline_partial;
  const proposed_final = mission.proposed_deadline_final;

  return (
    <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-amber-600" />
          Proposta de novos prazos
        </CardTitle>
        <CardDescription className="text-xs">
          O analista responsável sugeriu ajustar os prazos desta missão.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1">1ª Entrega proposta</p>
            <p className="font-medium">
              {proposed_partial ? format(parseLocalDate(proposed_partial), "dd/MM/yyyy") : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Entrega final proposta</p>
            <p className="font-medium">
              {proposed_final ? format(parseLocalDate(proposed_final), "dd/MM/yyyy") : "—"}
            </p>
          </div>
        </div>
        {!showCounter ? (
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => acceptProposalMut.mutate()}
              disabled={acceptProposalMut.isPending}
            >
              {acceptProposalMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <Check className="h-3.5 w-3.5" /> Aceitar proposta
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCounter(true)}>
              Propor outras datas
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <DatePickerField
                label="1ª Entrega"
                value={counter.partial}
                onChange={(v) => setCounter((c) => ({ ...c, partial: v }))}
                disablePast
              />
              <DatePickerField
                label="Entrega Final"
                value={counter.final}
                onChange={(v) => setCounter((c) => ({ ...c, final: v }))}
                disablePast
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => counterProposeMut.mutate()}
                disabled={counterProposeMut.isPending}
              >
                Enviar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCounter(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ComplementsList({ missionId, readOnly }: { missionId: string; readOnly: boolean }) {
  const { data: versions = [] } = useQuery({
    queryKey: docVersionsKey(missionId),
    queryFn: () => listDocumentVersions(missionId),
  });
  const complements = versions.filter(
    (v) => (v as { doc_type?: string | null }).doc_type === "complement",
  );
  if (complements.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic">
        {readOnly ? "Sem materiais complementares." : "Nenhum arquivo complementar enviado ainda."}
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Materiais complementares
      </div>
      {complements.map((v) => (
        <div
          key={v.id}
          className="flex items-center gap-2 text-sm border rounded px-2 py-1.5"
        >
          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{v.file_name}</span>
          <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
            {new Date(v.created_at).toLocaleDateString("pt-BR")}
          </span>
        </div>
      ))}
    </div>
  );
}