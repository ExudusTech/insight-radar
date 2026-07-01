import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Send, Loader2, Camera, CheckCircle2, Paperclip, X } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function MissionAssistantPanel({
  missionId,
  targetId,
  block,
  targetName,
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: assistantMessagesKey(targetId, block),
    queryFn: () => listAssistantMessages(targetId, block),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const sendMut = useMutation({
    mutationFn: async (payload: { userMessage: string | null; file: File | null }) => {
      if (!user?.id) throw new Error("Sem usuário");
      const { userMessage, file } = payload;
      const history = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      let imageBase64: string | null = null;
      let imageMimeType: string | null = null;
      let imagePath: string | null = null;

      if (file) {
        imageMimeType = file.type || "image/jpeg";
        imageBase64 = await fileToBase64(file);
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        imagePath = `${missionId}/${targetId}/assistant/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("mission-evidences")
          .upload(imagePath, file, { contentType: imageMimeType, upsert: false });
        if (upErr) throw upErr;
      }

      if ((userMessage && userMessage.trim()) || file) {
        await saveAssistantMessage({
          missionId,
          targetId,
          block,
          analystId: user.id,
          role: "user",
          content: userMessage?.trim() || (file ? "[imagem]" : ""),
          metadata: imagePath
            ? { image_path: imagePath, image_mime: imageMimeType }
            : undefined,
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
          imageBase64,
          imageMimeType,
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
      setImageFile(null);
      setImagePreview(null);
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
    if (sendMut.isPending) return;
    if (!input.trim() && !imageFile) return;
    sendMut.mutate({ userMessage: input || null, file: imageFile });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 8MB)");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

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
          <WelcomeScreen
            block={block}
            targetName={targetName}
            loading={sendMut.isPending}
            onStart={() => sendMut.mutate({ userMessage: null, file: null })}
          />
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
                <MessageImage metadata={m.metadata as { image_path?: string } | null} />
                {m.content && m.content !== "[imagem]" ? m.content : null}
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
        <div className="px-3 py-2 border-t space-y-2">
          {imagePreview && (
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt="preview"
                className="max-h-24 rounded border"
              />
              <button
                type="button"
                onClick={() => {
                  setImageFile(null);
                  setImagePreview(null);
                }}
                className="absolute -top-2 -right-2 bg-background border rounded-full p-0.5"
                aria-label="Remover imagem"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
          <label
            htmlFor={`img-upload-${targetId}-${block}`}
            className="cursor-pointer p-2 rounded hover:bg-muted"
            aria-label="Anexar imagem"
          >
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            <input
              id={`img-upload-${targetId}-${block}`}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
          </label>
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
            placeholder="Relate o que encontrou ou cole uma conversa..."
            className="min-h-9 max-h-24 text-sm resize-none"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={(!input.trim() && !imageFile) || sendMut.isPending}
          >
            {sendMut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageImage({ metadata }: { metadata: { image_path?: string } | null }) {
  const path = metadata?.image_path;
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    let active = true;
    supabase.storage
      .from("mission-evidences")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active && data?.signedUrl) setUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [path]);
  if (!path) return null;
  if (!url) {
    return (
      <div className="h-24 w-32 rounded bg-muted animate-pulse mb-1" />
    );
  }
  return (
    <img
      src={url}
      alt="evidência"
      className="max-w-full max-h-64 rounded border mb-1"
    />
  );
}

const BLOCK_STEPS: Array<{ letter: string; label: string }> = [
  { letter: "A", label: "Pesquisa pública (redes sociais, site)" },
  { letter: "B", label: "Primeiro contato" },
  { letter: "C", label: "Análise de funil e oferta" },
  { letter: "D", label: "Prova social" },
  { letter: "E", label: "Atendimento" },
  { letter: "F", label: "Materiais enviados" },
  { letter: "G", label: "Síntese final" },
];

function WelcomeScreen({
  block,
  targetName,
  loading,
  onStart,
}: {
  block: string;
  targetName?: string;
  loading: boolean;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] space-y-6 p-4">
      <div className="text-center space-y-2">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold text-lg">
          Pesquisa de {targetName ?? "alvo"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Vou te guiar pela coleta de inteligência sobre este alvo. Vamos trabalhar juntos passo a passo.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-1.5">
        {BLOCK_STEPS.map((s) => (
          <div
            key={s.letter}
            className={`flex items-center gap-2 text-xs ${
              s.letter === block ? "text-foreground font-medium" : "text-muted-foreground"
            }`}
          >
            <div
              className={`h-4 w-4 rounded-full border flex items-center justify-center text-[10px] ${
                s.letter === block
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-muted-foreground/30"
              }`}
            >
              {s.letter}
            </div>
            {s.label}
          </div>
        ))}
      </div>

      <Button size="lg" onClick={onStart} disabled={loading} className="w-full max-w-sm">
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4 mr-2" />
        )}
        Iniciar pesquisa com IA
      </Button>
    </div>
  );
}