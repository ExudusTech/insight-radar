import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  coordinationInboxKey,
  coordinationThreadKey,
  coordinationUnreadKey,
  listThread,
  markThreadRead,
  sendMessage,
} from "@/lib/coordination-messages.queries";
import { notificationsUnreadKey } from "@/lib/notifications.queries";

function initials(name?: string | null) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export type CoordinationThreadProps = {
  missionId: string;
  otherUserId: string;
  otherUserName?: string | null;
};

export function CoordinationThread({
  missionId,
  otherUserId,
  otherUserName,
}: CoordinationThreadProps) {
  const { data: me } = useCurrentUser();
  const meId = me?.id ?? "";
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [targetId, setTargetId] = useState<string>("none");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: coordinationThreadKey(missionId, otherUserId),
    queryFn: () => listThread(missionId, otherUserId, meId),
    enabled: !!meId,
    refetchInterval: 15_000,
  });

  const { data: targets } = useQuery({
    queryKey: ["coordination-thread-targets", missionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("targets")
        .select("id, name")
        .eq("mission_id", missionId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Mark unread messages from the other user as read
  useEffect(() => {
    if (!meId || !messages) return;
    const anyUnread = messages.some(
      (m) => m.receiver_id === meId && !m.read_at,
    );
    if (!anyUnread) return;
    markThreadRead(missionId, otherUserId, meId)
      .then(() => {
        qc.invalidateQueries({ queryKey: coordinationUnreadKey(meId) });
        qc.invalidateQueries({ queryKey: coordinationInboxKey(meId) });
        qc.invalidateQueries({
          queryKey: coordinationThreadKey(missionId, otherUserId),
        });
      })
      .catch(() => {});
  }, [messages, meId, missionId, otherUserId, qc]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages?.length]);

  const sendMut = useMutation({
    mutationFn: async () =>
      sendMessage({
        mission_id: missionId,
        receiver_id: otherUserId,
        content: content.trim(),
        target_id: targetId === "none" ? null : targetId,
      }),
    onSuccess: () => {
      setContent("");
      qc.invalidateQueries({
        queryKey: coordinationThreadKey(missionId, otherUserId),
      });
      qc.invalidateQueries({ queryKey: coordinationInboxKey(meId) });
      qc.invalidateQueries({ queryKey: notificationsUnreadKey(otherUserId) });
    },
  });

  const canSend = content.trim().length > 0 && !sendMut.isPending;

  const rendered = useMemo(() => messages ?? [], [messages]);

  return (
    <div className="flex flex-col h-[420px] border rounded-lg bg-background">
      <div className="px-3 py-2 border-b flex items-center gap-2">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="text-[10px]">
            {initials(otherUserName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">
            {otherUserName ?? "Usuário"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Canal interno da missão
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <div className="grid place-items-center h-full">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : rendered.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center pt-8">
            Nenhuma mensagem ainda. Envie a primeira.
          </div>
        ) : (
          rendered.map((m) => {
            const mine = m.sender_id === meId;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {m.content}
                  </div>
                  <div
                    className={`text-[10px] mt-1 flex items-center gap-1 ${
                      mine
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    }`}
                  >
                    {m.target?.name && (
                      <span className="italic">· {m.target.name} ·</span>
                    )}
                    <span>{formatTime(m.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t p-2 space-y-2">
        {targets && targets.length > 0 && (
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Contexto (concorrente opcional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem concorrente específico</SelectItem>
              {targets.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escreva uma mensagem…"
            rows={2}
            className="text-sm resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSend) {
                e.preventDefault();
                sendMut.mutate();
              }
            }}
          />
          <Button
            size="sm"
            disabled={!canSend}
            onClick={() => sendMut.mutate()}
          >
            {sendMut.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
