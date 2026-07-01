import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, Rocket, FileText } from "lucide-react";
import {
  getMission,
  listMissionAnalysts,
  listMissionContractors,
  missionAnalystsKey,
  missionContractorsKey,
  missionDetailKey,
  updateMission,
} from "@/lib/missions.queries";
import { getProduct } from "@/lib/products.queries";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  docVersionsKey,
  listDocumentVersions,
  uploadAndCreateVersion,
} from "@/lib/document-versions.queries";
import { sendNotifications } from "@/lib/notifications.functions";
import { useServerFn } from "@tanstack/react-start";
import { logActivity } from "@/lib/activity-log";

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

  const isDraft = mission.status === "draft";
  const canEditBriefing =
    isDraft && (currentUser?.role === "contractor" || currentUser?.role === "superadmin");
  const canStartMission =
    currentUser?.role === "contractor" || currentUser?.role === "superadmin";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-5">
        {canEditBriefing ? (
          <BriefingEnrichPanel
            missionId={missionId}
            missionName={mission.name}
            initialDescription={mission.description}
            canStart={canStartMission}
            currentUserId={currentUser?.id ?? null}
            deadlineFinal={mission.deadline_final}
          />
        ) : (
          <Card className="p-6 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Briefing</h2>
            {mission.description ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{mission.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Sem descrição cadastrada.</p>
            )}
            <ComplementsList missionId={missionId} readOnly />
          </Card>
        )}
        <Card className="p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Objetivo</h2>
          {mission.objective ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{mission.objective}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Sem objetivo definido.</p>
          )}
        </Card>
      </div>
      <div className="space-y-5">
        <Card className="p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Detalhes</h2>
          <KV k="Segmento" v={mission.segment} />
          <KV k="Rótulo dos alvos" v={mission.target_label} />
          <KV k="Cliente principal" v={contractor?.full_name || contractor?.email} />
          {product && <KV k="Produto / Serviço" v={product.name} />}
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
          <KV k="Primeira entrega" v={mission.deadline_first ? new Date(mission.deadline_first).toLocaleDateString("pt-BR") : null} />
          <KV k="Entrega final" v={mission.deadline_final ? new Date(mission.deadline_final).toLocaleDateString("pt-BR") : null} />
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
        </Card>
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

function BriefingEnrichPanel({
  missionId,
  missionName,
  initialDescription,
  canStart,
  currentUserId,
  deadlineFinal,
}: {
  missionId: string;
  missionName: string;
  initialDescription: string | null;
  canStart: boolean;
  currentUserId: string | null;
  deadlineFinal: string | null;
}) {
  const qc = useQueryClient();
  const [description, setDescription] = useState(initialDescription ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const sendNotificationsFn = useServerFn(sendNotifications);

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
      if (deadlineFinal) {
        const deadline = new Date(deadlineFinal);
        const today = new Date();
        const diffDays = Math.ceil(
          (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (diffDays < 0) {
          throw new Error(
            "A data de entrega já passou. Atualize o prazo antes de iniciar a missão.",
          );
        }
        if (diffDays < 7) {
          throw new Error(
            `Prazo insuficiente: ${diffDays} dia(s) restante(s). O mínimo para condução da pesquisa é 7 dias, pois algumas etapas dependem de resposta dos alvos.`,
          );
        }
        if (diffDays < 14) {
          toast.warning(
            `Atenção: apenas ${diffDays} dias até o prazo. Se a missão envolver agendamento de reuniões ou aguardo de respostas, considere estender para pelo menos 2 semanas.`,
          );
        }
      }
      await updateMission(missionId, { description });

      const { autoAssignAnalyst } = await import("@/lib/missions.queries");
      const assignedAnalystId = await autoAssignAnalyst(missionId);

      const { supabase } = await import("@/integrations/supabase/client");
      const { error: statusErr } = await supabase
        .from("missions")
        .update({ status: "execution_started" })
        .eq("id", missionId);
      if (statusErr) throw statusErr;

      if (assignedAnalystId) {
        await sendNotificationsFn({
          data: {
            notifications: [
              {
                user_id: assignedAnalystId,
                mission_id: missionId,
                type: "mission_started",
                message: `Nova missão atribuída: "${missionName}". Acesse para iniciar a estratégia.`,
              },
            ],
          },
        });
      }
      if (currentUserId) {
        await logActivity({
          userId: currentUserId,
          missionId,
          action: "mission_started",
          entityType: "mission",
          entityId: missionId,
        });
      }
    },
    onSuccess: () => {
      toast.success("Missão enviada! Nossa equipe de análise será acionada em breve.");
      qc.invalidateQueries({ queryKey: missionDetailKey(missionId) });
      qc.invalidateQueries({ queryKey: missionAnalystsKey(missionId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
            onClick={() => startMut.mutate()}
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