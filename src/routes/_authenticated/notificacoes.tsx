import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  component: NotificationsPage,
});

function typeBadgeVariant(type: string): { variant: "secondary" | "destructive" | "default" | "outline"; emoji: string } {
  if (type === "doubt") return { variant: "secondary", emoji: "🟡" };
  if (type === "blocking") return { variant: "destructive", emoji: "🔴" };
  if (type === "feedback") return { variant: "default", emoji: "✅" };
  return { variant: "outline", emoji: "🔵" };
}

function NotificationsPage() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const uid = user?.id ?? "";

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
            />
          ))}
        </div>
      )}
    </div>
  );
}

type NItem = Awaited<ReturnType<typeof listNotifications>>[number];

function NotificationItem({
  n,
  currentUserId,
  onRead,
  onInvalidate,
}: {
  n: NItem;
  currentUserId: string;
  onRead: (id: string) => void;
  onInvalidate: () => void;
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
      onClick={() => unread && onRead(n.id)}
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
        </div>
      </div>
    </Card>
  );
}