import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Send, Loader2, Camera, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  assistantMessagesKey,
  listAssistantMessages,
  saveAssistantMessage,
} from "@/lib/assistant-messages.queries";
import { missionAssistant } from "@/lib/mission-assistant.functions";
import { logActivity } from "@/lib/activity-log";

export function MissionAssistantPanel({
  missionId,
  targetId,
  block,
  onBlockCompleted,
}: {
  missionId: string;
  targetId: string;
  block: string;
  targetName?: string;
  onBlockCompleted?: () => void;
}) {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const callAssistant = useServerFn(missionAssistant);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: assistantMessagesKey(targetId, block),
    queryFn: () => listAssistantMessages(targetId, block),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const autoStartedRef = useRef(false);

  const sendMut = useMutation({
    mutationFn: async (userMessage: string | null) => {
      if (!user?.id) throw new Error("Sem usuário");
      const history = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      if (userMessage && userMessage.trim()) {
        await saveAssistantMessage({
          missionId,
          targetId,
          block,
          analystId: user.id,
          role: "user",
          content: userMessage,
        });
      }
      const res = await callAssistant({
        data: {
          missionId,
          targetId,
          block,
          analystId: user.id,
          conversationHistory: history,
          userMessage: userMessage,
        },
      });
      await saveAssistantMessage({
        missionId,
        targetId,
        block,
        analystId: user.id,
        role: "assistant",
        content: res.message,
      });
      return res.message;
    },
    onSuccess: (aiMessage) => {
      setInput("");
      qc.invalidateQueries({ queryKey: assistantMessagesKey(targetId, block) });
      if (user?.id) {
        logActivity({
          userId: user.id,
          missionId,
          action: "assistant_interaction",
          entityType: "target",
          entityId: targetId,
          details: {
            block,
            has_user_message: !!input.trim(),
            block_completed: !!aiMessage?.includes("✅"),
          },
        });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha no assistente"),
  });

  const lastAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant"),
    [messages],
  );
  const blockDone = !!lastAssistant?.content?.includes(`✅ Bloco ${block} concluído`);
  const evidenceRequested = !!lastAssistant?.content?.includes("📸 Evidência necessária");

  const status = messages.length === 0
    ? "Iniciando"
    : blockDone
      ? "Concluído"
      : "Em andamento";

  const handleSend = () => {
    if (!input.trim() || sendMut.isPending) return;
    sendMut.mutate(input);
  };

  useEffect(() => {
    if (
      !isLoading &&
      messages.length === 0 &&
      !autoStartedRef.current &&
      !sendMut.isPending &&
      user?.id
    ) {
      autoStartedRef.current = true;
      sendMut.mutate(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, messages.length, user?.id]);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          Assistente — Bloco {block}
        </div>
        <Badge variant={blockDone ? "default" : "outline"}>{status}</Badge>
      </div>

      {evidenceRequested && (
        <div className="px-3 py-2 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 text-xs flex items-center gap-1.5 border-b">
          <Camera className="h-3.5 w-3.5" />
          Evidência solicitada — acesse a aba Evidências
        </div>
      )}

      <div
        ref={scrollRef}
        className="max-h-80 overflow-y-auto px-3 py-3 space-y-3"
      >
        {isLoading ? (
          <div className="grid place-items-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-6 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendMut.mutate(null)}
              disabled={sendMut.isPending}
            >
              {sendMut.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Iniciar bloco {block} com assistente
            </Button>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary/10 text-foreground"
                    : "bg-muted/60 text-foreground"
                }`}
              >
                {m.role === "assistant" && (
                  <Sparkles className="inline h-3 w-3 mr-1 text-primary" />
                )}
                {m.content}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))
        )}
        {sendMut.isPending && messages.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Assistente pensando…
          </div>
        )}
      </div>

      {blockDone && onBlockCompleted && (
        <div className="px-3 py-2 border-t bg-green-50 dark:bg-green-950/30">
          <Button size="sm" className="w-full" onClick={onBlockCompleted}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Salvar bloco como concluído
          </Button>
        </div>
      )}

      {messages.length > 0 && (
        <div className="px-3 py-2 border-t flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder="Relate o que encontrou..."
            className="min-h-9 max-h-24 text-sm resize-none"
          />
          <Button size="sm" onClick={handleSend} disabled={!input.trim() || sendMut.isPending}>
            {sendMut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}