import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Bell, Check, MessageSquare } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
  notificationsKey,
  notificationsUnreadKey,
  createNotification,
  NOTIFICATION_TYPE_LABEL,
} from "@/lib/notifications.queries";
import { sendNotifications } from "@/lib/notifications.functions";
import { getMission, type Mission } from "@/lib/missions.queries";
import { parseLocalDate } from "@/components/ui/date-picker";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  component: NotificationsPage,
});

function typeBadgeVariant(type: string): { variant: "secondary" | "destructive" | "default" | "outline"; emoji: string } {
  if (type === "doubt") return { variant: "secondary", emoji: "🟡" };
  if (type === "blocking") return { variant: "destructive", emoji: "🔴" };
  if (type === "feedback") return { variant: "default", emoji: "✅" };
  if (type === "date_proposal") return { variant: "secondary", emoji: "📅" };
  if (type === "mission_accepted") return { variant: "default", emoji: "✅" };
  if (type === "mission_declined") return { variant: "destructive", emoji: "🚫" };
  return { variant: "outline", emoji: "🔵" };
}

function NotificationsPage() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const uid = user?.id ?? "";
  const sendNotificationsFn = useServerFn(sendNotifications);
  const [refuseDialog, setRefuseDialog] = useState<{
    open: boolean;
    missionId: string | null;
    mission: Mission | null;
  }>({ open: false, missionId: null, mission: null });

  const { data: items = [], isLoading } = useQuery({
    queryKey: notificationsKey(uid),
    queryFn: () => listNotifications(uid),
    enabled: !!uid,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: notificationsKey(uid) });
    qc.invalidateQueries({ queryKey: notificationsUnreadKey(uid) });
  };

  const readMut = useMutation({
    mutationFn: (id: string) => markAsRead(id),
    onSuccess: invalidate,
  });

  const readAllMut = useMutation({
    mutationFn: () => markAllAsRead(uid),
    onSuccess: () => {
      invalidate();
      toast.success("Todas marcadas como lidas");
    },
  });

  async function notifyAnalysts(
    missionId: string,
    type: string,
    message: string,
  ) {
    const { data: analysts } = await supabase
      .from("mission_analysts")
      .select("analyst_id")
      .eq("mission_id", missionId);
    if (!analysts?.length) return;
    await sendNotificationsFn({
      data: {
        notifications: analysts.map((a) => ({
          user_id: a.analyst_id,
          mission_id: missionId,
          type,
          message,
        })),
      },
    });
  }

  const acceptProposalMut = useMutation({
    mutationFn: async ({
      missionId,
      mission,
      notificationId,
    }: {
      missionId: string;
      mission: Mission;
      notificationId: string;
    }) => {
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
        .eq("id", missionId);
      if (error) throw error;
      await notifyAnalysts(
        missionId,
        "mission_accepted",
        `Cliente aceitou os novos prazos para "${mission.name}". A missão está em andamento.`,
      );
      await markAsRead(notificationId);
    },
    onSuccess: () => {
      toast.success("Prazos aceitos. Missão iniciada!");
      invalidate();
      qc.invalidateQueries({ queryKey: ["missions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refuseProposalMut = useMutation({
    mutationFn: async ({
      missionId,
      mission,
      notificationId,
    }: {
      missionId: string;
      mission: Mission;
      notificationId: string;
    }) => {
      const { error } = await supabase
        .from("missions")
        .update({
          status: "pending_acceptance",
          proposed_deadline_partial: null,
          proposed_deadline_final: null,
          proposal_from: null,
        })
        .eq("id", missionId);
      if (error) throw error;
      await notifyAnalysts(
        missionId,
        "date_proposal",
        `O cliente recusou sua proposta de prazos para "${mission.name}". Aguarde novas instruções.`,
      );
      await markAsRead(notificationId);
    },
    onSuccess: (_data, vars) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["missions"] });
      setRefuseDialog({ open: true, missionId: vars.missionId, mission: vars.mission });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const acceptOriginalMut = useMutation({
    mutationFn: async ({ missionId, mission }: { missionId: string; mission: Mission }) => {
      const { error } = await supabase
        .from("missions")
        .update({ status: "execution_started" })
        .eq("id", missionId);
      if (error) throw error;
      await notifyAnalysts(
        missionId,
        "mission_accepted",
        `O cliente aceitou os prazos originais para "${mission.name}". A missão está em andamento.`,
      );
    },
    onSuccess: () => {
      toast.success("Missão retomada com os prazos originais.");
      setRefuseDialog({ open: false, missionId: null, mission: null });
      invalidate();
      qc.invalidateQueries({ queryKey: ["missions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMissionMut = useMutation({
    mutationFn: async ({ missionId, mission }: { missionId: string; mission: Mission }) => {
      const { error } = await supabase
        .from("missions")
        .update({ status: "cancelled" })
        .eq("id", missionId);
      if (error) throw error;
      await notifyAnalysts(
        missionId,
        "status_update",
        `O cliente encerrou a missão "${mission.name}". Ela foi cancelada.`,
      );
    },
    onSuccess: () => {
      toast.success("Missão encerrada.");
      setRefuseDialog({ open: false, missionId: null, mission: null });
      invalidate();
      qc.invalidateQueries({ queryKey: ["missions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-4xl mx-auto w-full space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-5 w-5" /> Notificações
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dúvidas, observações e feedbacks da sua operação.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => readAllMut.mutate()} disabled={readAllMut.isPending}>
          <Check className="h-4 w-4" /> Marcar todas como lidas
        </Button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Nenhuma notificação ainda.
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <NotificationItem
              key={n.id}
              n={n}
              currentUserId={uid}
              onRead={(id) => readMut.mutate(id)}
              onInvalidate={invalidate}
              onAcceptProposal={(missionId, mission) => {
                acceptProposalMut.mutate({ missionId, mission, notificationId: n.id });
              }}
              onRefuseProposal={(missionId, mission) => {
                refuseProposalMut.mutate({ missionId, mission, notificationId: n.id });
              }}
              proposalPending={acceptProposalMut.isPending || refuseProposalMut.isPending}
            />
          ))}
        </div>
      )}

      <Dialog
        open={refuseDialog.open}
        onOpenChange={(o) =>
          !o && setRefuseDialog({ open: false, missionId: null, mission: null })
        }
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Proposta recusada</DialogTitle>
            <DialogDescription>
              O analista foi notificado. O que você deseja fazer agora?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Você pode aceitar os prazos originais da missão e continuar, ou
              encerrar a missão.
            </p>
            <div className="grid grid-cols-1 gap-2">
              <Button
                variant="outline"
                className="justify-start h-auto py-3 px-4"
                disabled={acceptOriginalMut.isPending}
                onClick={() => {
                  if (refuseDialog.missionId && refuseDialog.mission) {
                    acceptOriginalMut.mutate({
                      missionId: refuseDialog.missionId,
                      mission: refuseDialog.mission,
                    });
                  }
                }}
              >
                <div className="text-left">
                  <p className="font-medium text-sm">
                    Aceitar datas originais e continuar
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    1ª entrega:{" "}
                    {refuseDialog.mission?.deadline_first
                      ? parseLocalDate(refuseDialog.mission.deadline_first).toLocaleDateString("pt-BR")
                      : "—"}{" "}
                    · Final:{" "}
                    {refuseDialog.mission?.deadline_final
                      ? parseLocalDate(refuseDialog.mission.deadline_final).toLocaleDateString("pt-BR")
                      : "—"}
                  </p>
                </div>
              </Button>
              <Button
                variant="destructive"
                className="justify-start"
                disabled={cancelMissionMut.isPending}
                onClick={() => {
                  if (refuseDialog.missionId && refuseDialog.mission) {
                    cancelMissionMut.mutate({
                      missionId: refuseDialog.missionId,
                      mission: refuseDialog.mission,
                    });
                  }
                }}
              >
                Desistir da missão
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() =>
                setRefuseDialog({ open: false, missionId: null, mission: null })
              }
            >
              Fechar (decidir depois)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type NItem = Awaited<ReturnType<typeof listNotifications>>[number];

function NotificationItem({
  n,
  currentUserId,
  onRead,
  onInvalidate,
  onAcceptProposal,
  onRefuseProposal,
  proposalPending,
}: {
  n: NItem;
  currentUserId: string;
  onRead: (id: string) => void;
  onInvalidate: () => void;
  onAcceptProposal: (missionId: string, mission: Mission) => void;
  onRefuseProposal: (missionId: string, mission: Mission) => void;
  proposalPending: boolean;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [resolveBlock, setResolveBlock] = useState(true);
  const unread = !n.read_at;
  const { variant, emoji } = typeBadgeVariant(n.type);
  const origin = (n as unknown as { origin?: { full_name?: string | null; email?: string | null } | null }).origin;
  const mission = (n as unknown as { mission?: { id: string; name: string } | null }).mission;
  const target = (n as unknown as { target?: { id: string; name: string } | null }).target;

  const isDoubt = n.type === "doubt" || n.type === "blocking";
  const isDateProposal = n.type === "date_proposal" && !!n.mission_id;

  const { data: missionData } = useQuery({
    queryKey: ["missions", "detail", n.mission_id ?? ""],
    queryFn: () => getMission(n.mission_id as string),
    enabled: isDateProposal,
    staleTime: 0,
  });

  const showProposalActions =
    isDateProposal &&
    !n.read_at &&
    !!missionData &&
    missionData.status !== "execution_started" &&
    missionData.status !== "cancelled";

  const replyMut = useMutation({
    mutationFn: async () => {
      if (!n.origin_user_id) throw new Error("Origem desconhecida");
      await createNotification({
        user_id: n.origin_user_id,
        origin_user_id: currentUserId,
        mission_id: n.mission_id,
        target_id: n.target_id,
        block: n.block,
        type: "feedback",
        message: reply,
      });
      // resolve blocking
      if (n.type === "blocking" && resolveBlock && n.target_id && n.block && n.mission_id) {
        await supabase
          .from("collection_data")
          .upsert(
            {
              mission_id: n.mission_id,
              target_id: n.target_id,
              block: n.block as never,
              field_key: "doubt_blocking",
              field_value: false as never,
              updated_by: currentUserId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "target_id,block,field_key" },
          );
        // try restoring previous status from activity_logs
        const { data: log } = await supabase
          .from("activity_logs")
          .select("details")
          .eq("entity_id", n.target_id)
          .eq("action", "target_status_changed")
          .order("created_at", { ascending: false })
          .limit(5);
        const prev = (log ?? [])
          .map((l) => (l.details as { from?: string; to?: string })?.from)
          .find((s) => s && s !== "incomplete");
        if (prev) {
          await supabase.from("targets").update({ status: prev as never }).eq("id", n.target_id);
        }
      }
      await markAsRead(n.id);
    },
    onSuccess: () => {
      toast.success("Resposta enviada");
      setReply("");
      setReplyOpen(false);
      onInvalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <Card
      className={`p-4 ${unread ? "border-primary/40 bg-primary/[0.02]" : ""}`}
      onClick={() => unread && !isDateProposal && onRead(n.id)}
    >
      <div className="flex items-start gap-3">
        <div className="text-lg leading-none mt-0.5">{emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant={variant}>{NOTIFICATION_TYPE_LABEL[n.type] ?? n.type}</Badge>
            {n.block && <Badge variant="outline" className="font-mono">Bloco {n.block}</Badge>}
            {mission && (
              <Link
                to="/missions/$missionId"
                params={{ missionId: mission.id }}
                className="text-xs text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {mission.name}
              </Link>
            )}
            {target && <span className="text-xs text-muted-foreground">· {target.name}</span>}
            {unread && <Badge variant="secondary" className="ml-auto">Nova</Badge>}
          </div>
          <p className="text-sm whitespace-pre-wrap">{n.message}</p>
          <div className="text-[11px] text-muted-foreground mt-2 flex items-center gap-2">
            <span>{origin?.full_name || origin?.email || "Sistema"}</span>
            <span>·</span>
            <span>{new Date(n.created_at).toLocaleString("pt-BR")}</span>
          </div>

          {isDoubt && n.origin_user_id && (
            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
              {!replyOpen ? (
                <Button size="sm" variant="outline" onClick={() => setReplyOpen(true)}>
                  <MessageSquare className="h-3.5 w-3.5" /> Responder
                </Button>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                    placeholder="Digite o feedback..."
                  />
                  {n.type === "blocking" && (
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={resolveBlock}
                        onCheckedChange={(v) => setResolveBlock(v === true)}
                      />
                      Esta resposta resolve o bloqueio
                    </label>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => replyMut.mutate()}
                      disabled={!reply.trim() || replyMut.isPending}
                    >
                      {replyMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Enviar"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setReplyOpen(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {showProposalActions && missionData && (
            <div
              className="flex gap-2 mt-3"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size="sm"
                disabled={proposalPending}
                onClick={() => onAcceptProposal(missionData.id, missionData as Mission)}
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Aceitar proposta
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={proposalPending}
                onClick={() => onRefuseProposal(missionData.id, missionData as Mission)}
              >
                Recusar
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}