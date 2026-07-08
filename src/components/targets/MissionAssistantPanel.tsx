import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Send, Loader2, Camera, Paperclip, X, CheckCircle2, Mic, MicOff, Calendar, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  ASSISTANT_UNIFIED_BLOCK,
  assistantMessagesKey,
  listAssistantMessages,
  saveAssistantMessage,
} from "@/lib/assistant-messages.queries";
import { missionAssistant, processAssistantHistory, generateCompetitorBrief, generateMeetingScript } from "@/lib/mission-assistant.functions";
import { requestCompetitorBrief } from "@/lib/report-request.functions";
import {
  BLOCK_FIELDS,
  BLOCK_FIELDS_REQUIRED,
  BLOCK_TITLES,
  COLLECTION_BLOCKS,
  collectionByTargetKey,
  countFilledFieldsByBlock,
  listCollectionByTarget,
  applyBlockUpdatesFromAssistant,
  calcRequiredCompletion,
  type CollectionBlock,
} from "@/lib/collection.queries";
import { targetDetailKey, targetsByMissionKey } from "@/lib/targets.queries";
import { getTarget } from "@/lib/targets.queries";
import { evidencesByTargetKey } from "@/lib/evidences.queries";
import { timelineEventsByTargetKey } from "@/lib/target-timeline.queries";
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
  const callGenerateBrief = useServerFn(generateCompetitorBrief);
  const callGenerateMeetingScript = useServerFn(generateMeetingScript);
  const callRequestBrief = useServerFn(requestCompetitorBrief);
  const [input, setInput] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, 200);
    el.style.height = `${Math.max(next, 56)}px`;
  }, [input]);
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
  const { data: targetData } = useQuery({
    queryKey: targetDetailKey(targetId),
    queryFn: () => getTarget(targetId),
  });
  const { data: missionMeta } = useQuery({
    queryKey: ["missions", "meta-entregavel", missionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("entregavel_esperado, canais_obrigatorios")
        .eq("id", missionId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const entregavel = missionMeta?.entregavel_esperado?.trim() || null;
  const missionCanais = (missionMeta?.canais_obrigatorios ?? []) as string[];
  const canalAbordagem = (targetData as { canal_abordagem?: string | null } | null | undefined)?.canal_abordagem;

  const analystIds = useMemo(
    () =>
      Array.from(
        new Set(
          messages
            .filter((m) => m.role === "user" && m.analyst_id)
            .map((m) => m.analyst_id as string),
        ),
      ),
    [messages],
  );
  const { data: analystProfiles = [] } = useQuery({
    queryKey: ["profiles", "by-ids", analystIds],
    queryFn: async () => {
      if (analystIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", analystIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: analystIds.length > 0,
  });
  const analystNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of analystProfiles) {
      map.set(p.id, p.full_name || p.email || "Analista");
    }
    return map;
  }, [analystProfiles]);

  const filledByBlock = countFilledFieldsByBlock(collectionRows);
  const requiredCompletion = calcRequiredCompletion(collectionRows);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const sendMut = useMutation({
    mutationFn: async (payload: { userMessage: string | null; files: File[] }) => {
      if (!user?.id) throw new Error("Sem usuário");
      const { userMessage, files } = payload;
      const history = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const uploaded: { path: string; mime: string; base64: string }[] = [];
      for (const file of files) {
        const mime = file.type || "image/jpeg";
        const base64 = await fileToBase64(file);
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${missionId}/${targetId}/assistant/${Date.now()}-${uploaded.length}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("mission-evidences")
          .upload(path, file, { contentType: mime, upsert: false });
        if (upErr) throw upErr;
        const { error: evErr } = await supabase.from("evidences").insert({
          mission_id: missionId,
          target_id: targetId,
          evidence_type: "screenshot",
          file_url: path,
          caption: userMessage?.trim() || "Enviado pelo chat do assistente",
          tags: ["assistant_chat"],
          captured_at: new Date().toISOString(),
          created_by: user.id,
        });
        if (evErr) console.error("[assistant] falha ao registrar evidência:", evErr);
        uploaded.push({ path, mime, base64 });
      }

      const firstImage = uploaded[0] ?? null;
      const imageBase64 = firstImage?.base64 ?? null;
      const imageMimeType = firstImage?.mime ?? null;

      if ((userMessage && userMessage.trim()) || uploaded.length > 0) {
        await saveAssistantMessage({
          missionId,
          targetId,
          block: ASSISTANT_UNIFIED_BLOCK,
          analystId: user.id,
          role: "user",
          content: userMessage?.trim() || (uploaded.length > 0 ? "[imagem]" : ""),
          metadata:
            uploaded.length > 0
              ? {
                  image_path: uploaded[0].path,
                  image_mime: uploaded[0].mime,
                  image_paths: uploaded.map((u) => u.path),
                }
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

      return {
        message: res.message,
        blockUpdates: res.blockUpdates,
        timelineEventDetected: res.timelineEventDetected,
      };
    },
    onSuccess: ({ message, blockUpdates, timelineEventDetected }) => {
      setInput("");
      setImageFiles([]);
      setImagePreviews([]);
      qc.invalidateQueries({ queryKey: assistantMessagesKey(targetId) });
      qc.invalidateQueries({ queryKey: evidencesByTargetKey(targetId) });
      if (timelineEventDetected) {
        qc.invalidateQueries({ queryKey: timelineEventsByTargetKey(targetId) });
      }
      if (blockUpdates) {
        qc.invalidateQueries({ queryKey: collectionByTargetKey(targetId) });
        qc.invalidateQueries({ queryKey: targetDetailKey(targetId) });
        qc.invalidateQueries({ queryKey: targetsByMissionKey(missionId) });
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
      console.log("[processMut] blockUpdates:", JSON.stringify(res.blockUpdates));
      const count = res.blockUpdates
        ? await applyBlockUpdatesFromAssistant({
            missionId,
            targetId,
            userId: user.id,
            blockUpdates: res.blockUpdates,
          })
        : 0;
      console.log("[processMut] fields applied:", count);
      return { count };
    },
    onSuccess: ({ count }) => {
      qc.invalidateQueries({ queryKey: collectionByTargetKey(targetId) });
      qc.invalidateQueries({ queryKey: targetDetailKey(targetId) });
      qc.invalidateQueries({ queryKey: targetsByMissionKey(missionId) });
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
  const synthesisReady = !!lastAssistant?.content?.includes("## Perfil do Concorrente");

  const briefMut = useMutation({
    mutationFn: () => callGenerateBrief({ data: { missionId, targetId } }),
    onSuccess: () => toast.success("Parecer salvo em Documentos da missão."),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar parecer"),
  });

  const meetingScriptMut = useMutation({
    mutationFn: () => callGenerateMeetingScript({ data: { missionId, targetId } }),
    onSuccess: () => {
      toast.success("Roteiro de reunião gerado e salvo em Documentos.");
      qc.invalidateQueries({ queryKey: assistantMessagesKey(targetId) });
      qc.invalidateQueries({ queryKey: targetDetailKey(targetId) });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao gerar roteiro"),
  });

  const requestBriefMut = useMutation({
    mutationFn: () =>
      callRequestBrief({
        data: { missionId, targetId, targetName: targetName || "concorrente" },
      }),
    onSuccess: (res) => {
      if (res.notified > 0) {
        toast.success("Solicitação enviada ao coordenador.");
      } else {
        toast.warning("Nenhum coordenador cadastrado para receber a solicitação.");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao enviar solicitação"),
  });

  const handleSend = () => {
    if (sendMut.isPending) return;
    if (!input.trim() && imageFiles.length === 0) return;
    sendMut.mutate({ userMessage: input || null, files: imageFiles });
  };

  const addFiles = (files: File[]) => {
    for (const file of files) {
      if (file.size > 8 * 1024 * 1024) {
        toast.error(`Imagem muito grande (máx 8MB): ${file.name}`);
        continue;
      }
      setImageFiles((prev) => [...prev, file]);
      const reader = new FileReader();
      reader.onload = () =>
        setImagePreviews((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    addFiles(files);
  };

  const removeImageAt = (idx: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageFilesFromPaste = items
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((f): f is File => !!f);
    if (imageFilesFromPaste.length > 0) {
      e.preventDefault();
      addFiles(imageFilesFromPaste);
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

      {entregavel && (
        <div className="px-3 py-2 border-b bg-primary/5 text-xs">
          <div className="flex items-start gap-1.5">
            <span>🎯</span>
            <div className="flex-1 leading-relaxed">
              <span className="font-semibold text-primary uppercase tracking-wide text-[10px] block mb-0.5">
                Entregável esperado
              </span>
              <span className="text-foreground/90">{entregavel}</span>
            </div>
          </div>
        </div>
      )}

      <BlockProgress filled={filledByBlock} required={requiredCompletion.filledByBlock} />
      <div className="px-3 py-2 border-b">
        <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
          <span>Campos essenciais</span>
          <span>
            {requiredCompletion.percent}% ({requiredCompletion.filledRequired}/{requiredCompletion.totalRequired})
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              requiredCompletion.percent >= 100
                ? "bg-emerald-500"
                : requiredCompletion.percent >= 50
                  ? "bg-amber-500"
                  : "bg-red-500",
            )}
            style={{ width: `${requiredCompletion.percent}%` }}
          />
        </div>
      </div>

      {!canalAbordagem && (
        <div className="px-3 pt-3">
          {missionCanais.length > 0 ? (
            <Alert className="border-primary/40 bg-primary/5">
              <AlertDescription className="text-foreground/80 text-sm">
                Usando canais gerais da missão: {missionCanais.join(", ")}.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-600 dark:text-amber-400 text-sm">
                Canal de abordagem não definido para este alvo nem para a missão. A IA usará
                orientações gerais.
                {user?.role === "superadmin" && " Configure os canais na aba Visão Geral."}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {messages.length > 0 && (
        <div className="px-3 py-2 border-b">
          <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs flex-1"
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
          <Button
            variant="outline"
            size="sm"
            className="text-xs flex-1"
            onClick={() => meetingScriptMut.mutate()}
            disabled={meetingScriptMut.isPending}
          >
            {meetingScriptMut.isPending ? (
              <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Preparando reunião...</>
            ) : (
              <><Calendar className="h-3 w-3 mr-1" /> Preparar reunião</>
            )}
          </Button>
          {(user?.role === "coordinator" || user?.role === "superadmin") && (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs w-full"
                      onClick={() => briefMut.mutate()}
                      disabled={briefMut.isPending || !requiredCompletion.readyForSynthesis}
                    >
                      {briefMut.isPending ? (
                        <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Gerando parecer...</>
                      ) : (
                        <><CheckCircle2 className="h-3 w-3 mr-1" /> Gerar parecer</>
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!requiredCompletion.readyForSynthesis && (
                  <TooltipContent>
                    Complete os blocos obrigatórios para gerar o parecer.
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
          {user?.role === "analyst" && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs flex-1"
              onClick={() => requestBriefMut.mutate()}
              disabled={requestBriefMut.isPending}
            >
              {requestBriefMut.isPending ? (
                <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Enviando...</>
              ) : (
                <><CheckCircle2 className="h-3 w-3 mr-1" /> Solicitar Parecer ao Coordenador</>
              )}
            </Button>
          )}
          </div>
        </div>
      )}

      {evidenceRequested && (
        <div className="px-3 py-2 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 text-xs flex items-center gap-1.5 border-b">
          <Camera className="h-3.5 w-3.5" />
          Evidência solicitada — acesse a aba Evidências
        </div>
      )}

      {synthesisReady && (
        <div className="px-3 py-2 border-b bg-emerald-50 dark:bg-emerald-950/30">
          <Button
            size="sm"
            variant="outline"
            className="text-xs w-full"
            onClick={() => briefMut.mutate()}
            disabled={briefMut.isPending}
          >
            {briefMut.isPending ? (
              <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Salvando parecer...</>
            ) : (
              <><CheckCircle2 className="h-3 w-3 mr-1" /> Salvar parecer como documento da missão</>
            )}
          </Button>
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
            onStart={() => sendMut.mutate({ userMessage: null, files: [] })}
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
                {m.role === "assistant"
                  ? "IA"
                  : (m.analyst_id && analystNameById.get(m.analyst_id)) || "Analista"}
                {" · "}
                {new Date(m.created_at).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                  day: "2-digit",
                  month: "2-digit",
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
          {imagePreviews.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {imagePreviews.map((src, idx) => (
                <div key={idx} className="relative inline-block">
                  <img
                    src={src}
                    alt={`preview ${idx + 1}`}
                    className="max-h-24 rounded border"
                  />
                  <button
                    type="button"
                    onClick={() => removeImageAt(idx)}
                    className="absolute -top-2 -right-2 bg-background border rounded-full p-0.5"
                    aria-label="Remover imagem"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
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
              multiple
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
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            onPaste={handlePaste}
            rows={2}
            placeholder="Relate o que encontrou, cole uma conversa ou Ctrl+V para colar um print..."
            className="min-h-[56px] max-h-[200px] text-sm resize-none overflow-y-auto"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={(!input.trim() && imageFiles.length === 0) || sendMut.isPending}
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

function BlockProgress({
  filled,
  required,
}: {
  filled: Record<string, number>;
  required: Record<string, Set<string>>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b bg-muted/20">
      {COLLECTION_BLOCKS.map((b) => {
        const total = BLOCK_FIELDS[b].length;
        const got = filled[b] ?? 0;
        const reqFields = BLOCK_FIELDS_REQUIRED[b] ?? [];
        const reqFilled = reqFields.filter((f) => required[b]?.has(f)).length;
        const reqDone = reqFields.length > 0 && reqFilled === reqFields.length;
        const reqPartial = reqFilled > 0 && !reqDone;
        const started = got > 0;
        return (
          <div
            key={b}
            title={`${b} — ${BLOCK_TITLES[b]} · essenciais ${reqFilled}/${reqFields.length} · total ${got}/${total}`}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
              reqDone
                ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400"
                : reqPartial
                  ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
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