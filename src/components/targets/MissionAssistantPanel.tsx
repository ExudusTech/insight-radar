import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Send, Loader2, Camera, Paperclip, X, CheckCircle2, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  ASSISTANT_UNIFIED_BLOCK,
  assistantMessagesKey,
  listAssistantMessages,
  saveAssistantMessage,
} from "@/lib/assistant-messages.queries";
import { missionAssistant, processAssistantHistory } from "@/lib/mission-assistant.functions";
import {
  BLOCK_FIELDS,
  BLOCK_TITLES,
  COLLECTION_BLOCKS,
  collectionByTargetKey,
  countFilledFieldsByBlock,
  listCollectionByTarget,
  upsertCollectionField,
  applyBlockUpdatesFromAssistant,
  type CollectionBlock,
} from "@/lib/collection.queries";
import { logActivity } from "@/lib/activity-log";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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

function useSpeechRecognition(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  const start = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Reconhecimento de voz não suportado neste navegador");
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const text = e.results[0]?.[0]?.transcript ?? "";
      if (text) onResult(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const stop = () => {
    recRef.current?.stop();
    setListening(false);
  };

  return { listening, start, stop };
}

export function MissionAssistantPanel({
  missionId,
  targetId,
  targetName,
}: {
  missionId: string;
  targetId: string;
  targetName?: string;
}) {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const callAssistant = useServerFn(missionAssistant);
  const callProcessHistory = useServerFn(processAssistantHistory);
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { listening, start: startMic, stop: stopMic } = useSpeechRecognition((text) => {
    setInput((prev) => (prev ? prev + " " + text : text));
  });

  const { data: messages = [], isLoading } = useQuery({
    queryKey: assistantMessagesKey(targetId),
    queryFn: () => listAssistantMessages(targetId),
  });

  const { data: collectionRows = [] } = useQuery({
    queryKey: collectionByTargetKey(targetId),
    queryFn: () => listCollectionByTarget(targetId),
  });
  const filledByBlock = countFilledFieldsByBlock(collectionRows);

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
          block: ASSISTANT_UNIFIED_BLOCK,
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
          analystId: user.id,
          conversationHistory: history,
          userMessage: userMessage,
          imageBase64,
          imageMimeType,
        },
      });
      // Assistant message is persisted server-side by missionAssistant (RLS restricts client inserts to role='user').

      // Persist auto-filled block fields
      if (res.blockUpdates) {
        try {
          await applyBlockUpdatesFromAssistant({
            missionId,
            targetId,
            userId: user.id,
            blockUpdates: res.blockUpdates,
          });
        } catch (e) {
          console.warn("[assistant] applyBlockUpdatesFromAssistant failed", e);
        }
      }

      return { message: res.message, blockUpdates: res.blockUpdates };
    },
    onSuccess: ({ message, blockUpdates }) => {
      setInput("");
      setImageFile(null);
      setImagePreview(null);
      qc.invalidateQueries({ queryKey: assistantMessagesKey(targetId) });
      if (blockUpdates) {
        qc.invalidateQueries({ queryKey: collectionByTargetKey(targetId) });
      }
      if (user?.id) {
        logActivity({
          userId: user.id,
          missionId,
          action: "assistant_interaction",
          entityType: "target",
          entityId: targetId,
          details: {
            has_user_message: !!input.trim(),
            fields_updated: blockUpdates
              ? Object.values(blockUpdates).reduce((n, f) => n + Object.keys(f).length, 0)
              : 0,
            research_complete: !!message?.includes("✅ Pesquisa concluída"),
          },
        });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha no assistente"),
  });

  const processMut = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sem usuário");
      const res = await callProcessHistory({
        data: { missionId, targetId, analystId: user.id },
      });
      let count = 0;
      if (res.blockUpdates) {
        for (const [blk, fields] of Object.entries(res.blockUpdates)) {
          if (!COLLECTION_BLOCKS.includes(blk as CollectionBlock)) continue;
          for (const [fieldKey, value] of Object.entries(fields)) {
            try {
              await upsertCollectionField({
                missionId,
                targetId,
                block: blk as CollectionBlock,
                fieldKey,
                value,
                userId: user.id,
              });
              count++;
            } catch (e) {
              console.warn("[assistant] failed to upsert (history)", blk, fieldKey, e);
            }
          }
        }
      }
      return { count };
    },
    onSuccess: ({ count }) => {
      qc.invalidateQueries({ queryKey: collectionByTargetKey(targetId) });
      if (count > 0) {
        toast.success(`${count} campo(s) extraído(s) e salvo(s) com sucesso!`);
      } else {
        toast.info("Nenhum campo novo identificado no histórico.");
      }
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Falha ao processar histórico"),
  });

  const lastAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant"),
    [messages],
  );
  const researchDone = !!lastAssistant?.content?.includes("✅ Pesquisa concluída");
  const evidenceRequested = !!lastAssistant?.content?.includes("📸 Evidência necessária");

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

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) {
        toast.error("Imagem muito grande (máx 8MB)");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          Assistente de pesquisa
        </div>
        {researchDone && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Pesquisa concluída
          </span>
        )}
      </div>

      <BlockProgress filled={filledByBlock} />

      {messages.length > 0 && (
        <div className="px-3 py-2 border-b">
          <Button
            variant="outline"
            size="sm"
            className="text-xs w-full"
            onClick={() => processMut.mutate()}
            disabled={processMut.isPending}
          >
            {processMut.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-1" /> Processando histórico...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 mr-1" /> Extrair campos do histórico
              </>
            )}
          </Button>
        </div>
      )}

      {evidenceRequested && (
        <div className="px-3 py-2 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 text-xs flex items-center gap-1.5 border-b">
          <Camera className="h-3.5 w-3.5" />
          Evidência solicitada — acesse a aba Evidências
        </div>
      )}

      <div
        ref={scrollRef}
        className="max-h-[420px] overflow-y-auto px-3 py-3 space-y-3"
      >
        {isLoading ? (
          <div className="grid place-items-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <WelcomeScreen
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
            htmlFor={`img-upload-${targetId}`}
            className="cursor-pointer p-2 rounded hover:bg-muted"
            aria-label="Anexar imagem"
          >
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            <input
              id={`img-upload-${targetId}`}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
          </label>
          <button
            type="button"
            onClick={listening ? stopMic : startMic}
            className={cn(
              "p-2 rounded hover:bg-muted transition-colors",
              listening ? "text-red-500 animate-pulse" : "text-muted-foreground",
            )}
            aria-label={listening ? "Parar gravação" : "Gravar áudio"}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            onPaste={handlePaste}
            rows={1}
            placeholder="Relate o que encontrou, cole uma conversa ou Ctrl+V para colar um print..."
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
          <p className="text-[10px] text-muted-foreground px-1">
            💡 Cole prints direto aqui com Ctrl+V (ou Cmd+V no Mac)
          </p>
        </div>
      )}
    </div>
  );
}

function BlockProgress({ filled }: { filled: Record<string, number> }) {
  return (
    <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b bg-muted/20">
      {COLLECTION_BLOCKS.map((b) => {
        const total = BLOCK_FIELDS[b].length;
        const got = filled[b] ?? 0;
        const done = got >= total;
        const started = got > 0;
        return (
          <div
            key={b}
            title={`Bloco ${b} — ${BLOCK_TITLES[b]} (${got}/${total})`}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
              done
                ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400"
                : started
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-muted-foreground/20 text-muted-foreground",
            )}
          >
            <span className="font-mono">{b}</span>
            <span className="opacity-70">
              {got}/{total}
            </span>
          </div>
        );
      })}
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

function WelcomeScreen({
  targetName,
  loading,
  onStart,
}: {
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
          Vou te guiar em UMA conversa que cobre os 7 blocos de pesquisa. Faço perguntas
          estratégicas e preencho os campos automaticamente conforme você reporta o que encontrou.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-1.5">
        {COLLECTION_BLOCKS.map((b) => (
          <div
            key={b}
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <div className="h-4 w-4 rounded-full border border-muted-foreground/30 flex items-center justify-center text-[10px]">
              {b}
            </div>
            {BLOCK_TITLES[b]}
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