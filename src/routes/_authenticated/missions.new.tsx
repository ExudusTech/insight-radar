import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, FileUp, Loader2, Sparkles, AlertTriangle, Send, Bot, User, CheckCircle2, Target as TargetIcon, Radio, Calendar, ShieldAlert, Mic, MicOff, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MissionForm } from "@/components/missions/mission-form";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createMission, updateMissionFromExtraction } from "@/lib/missions.queries";
import { createMissionServer } from "@/lib/missions.functions";
import {
  uploadAndCreateVersion,
  freezeVersion,
  createTargetsFromExtraction,
} from "@/lib/document-versions.queries";
import { extractMissionDocument } from "@/lib/document-versions.functions";
import { missionBriefingAssistant, type BriefingScope } from "@/lib/mission-briefing.functions";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/missions/new")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw redirect({ to: "/auth" });
    const [{ data: isContractor }, { data: isSuperadmin }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: auth.user.id, _role: "contractor" }),
      supabase.rpc("has_role", { _user_id: auth.user.id, _role: "superadmin" }),
    ]);
    if (!isContractor && !isSuperadmin) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: NewMissionPage,
});

type UploadStatus = "idle" | "uploading" | "extracting" | "done" | "error";
type Mode = "ai" | "upload" | "manual";
type ChatMsg = { role: "user" | "assistant"; content: string };

const INITIAL_ASSISTANT_MESSAGE =
  "Olá! Vou ajudá-lo a criar uma nova missão de inteligência competitiva. Para começar: qual é o **principal objetivo** desta pesquisa?";

function NewMissionPage() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const extractFn = useServerFn(extractMissionDocument);
  const createMissionFn = useServerFn(createMissionServer);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("ai");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [missionName, setMissionName] = useState<string>("");
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [postUpload, setPostUpload] = useState<null | {
    missionId: string;
    initialMessages: ChatMsg[];
    extractedContext: string;
  }>(null);

  async function handleFile(file: File) {
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      toast.error("Apenas PDF ou DOCX");
      return;
    }
    if (!user?.id) return;

    setErrorMsg(null);
    setStatus("uploading");

    let mission: Awaited<ReturnType<typeof createMission>> | null = null;

    try {
      const result = await createMissionFn({
        data: {
          name: missionName.trim() || "Nova missão",
          target_label: "Concorrente",
        },
      });
      mission = { id: result.missionId } as Awaited<ReturnType<typeof createMission>>;
    } catch (e) {
      console.error("[missions.new] createMission failed:", e);
      const msg = (e as any)?.message ?? String(e) ?? "Erro ao criar missão no banco";
      setStatus("error");
      setErrorMsg(`Passo 1/4 (criar missão): ${msg}`);
      toast.error(msg);
      return;
    }

    let version: Awaited<ReturnType<typeof uploadAndCreateVersion>> | null = null;

    try {
      version = await uploadAndCreateVersion({
        missionId: mission.id,
        file,
        authorId: user.id,
        docType: "base",
      });
    } catch (e) {
      console.error("[missions.new] uploadAndCreateVersion failed:", e);
      const msg = (e as any)?.message ?? String(e) ?? "Erro ao enviar arquivo";
      setStatus("error");
      setErrorMsg(`Passo 2/4 (upload): ${msg}`);
      toast.error(msg);
      return;
    }

    setStatus("extracting");
    try {
      await extractFn({ data: { versionId: version.id } });
      const { data: ver } = await supabase
        .from("document_versions")
        .select("extracted_data")
        .eq("id", version.id)
        .single();
      const extracted = (ver?.extracted_data ?? {}) as Parameters<
        typeof updateMissionFromExtraction
      >[1];
      await updateMissionFromExtraction(mission.id, extracted);
      await freezeVersion(version.id);
      await createTargetsFromExtraction(version.id);

      // Fetch back all extracted mission fields + targets to seed the IA conversation.
      const [{ data: created }, { data: tgts }] = await Promise.all([
        supabase
          .from("missions")
          .select(
            "name, description, objective, deadline_final, canais_obrigatorios, cobertura_canais, profundidade_autorizada, entregavel_esperado, restricoes",
          )
          .eq("id", mission.id)
          .single(),
        supabase
          .from("targets")
          .select("name, instagram, site, whatsapp, category")
          .eq("mission_id", mission.id),
      ]);

      const { summary, context, missing } = buildExtractionSummary(created, tgts ?? []);
      const openingLine = missing.length > 0
        ? `Li seu documento! Aqui está o que consegui identificar — mas ainda preciso confirmar alguns pontos com você antes de lançar a missão:`
        : `Li seu documento! Identifiquei os dados abaixo. Posso lançar a missão com essas configurações, ou há algo que precise ajustar?`;
      const followUp = missing.length > 0
        ? `\n\n**Preciso que você me ajude com:**\n${missing.map((m) => `- ${m}`).join("\n")}`
        : "";

      setPostUpload({
        missionId: mission.id,
        initialMessages: [
          { role: "assistant", content: `${openingLine}\n\n${summary}${followUp}` },
        ],
        extractedContext: context,
      });
      setStatus("done");
      setMode("ai");
      return;
    } catch (e) {
      console.error("[missions.new] extraction/freeze failed:", e);
      toast.warning("Não consegui extrair tudo automaticamente. Edite os campos manualmente.");
    }

    setStatus("done");
    setTimeout(
      () => navigate({ to: "/missions/$missionId", params: { missionId: mission!.id } }),
      800,
    );
  }

  return (
    <div className={`${mode === "ai" ? "max-w-6xl" : "max-w-3xl"} mx-auto w-full space-y-6`}>
      <div>
        <Link
          to="/missions"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar para missões
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Nova missão</h1>
        {nameConfirmed ? (
          <>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Missão:</span>
              <span className="font-medium">{missionName}</span>
              <button
                type="button"
                onClick={() => setNameConfirmed(false)}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline"
              >
                <Pencil className="h-3 w-3" /> Alterar nome
              </button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Converse com a IA para montar o escopo — ou envie um briefing / preencha manualmente.
            </p>
            <div className="mt-3 flex gap-2 text-xs">
              <ModeButton active={mode === "ai"} onClick={() => setMode("ai")}>
                <Sparkles className="h-3 w-3" /> Chat com IA
              </ModeButton>
              <ModeButton active={mode === "upload"} onClick={() => setMode("upload")}>
                <FileUp className="h-3 w-3" /> Enviar briefing
              </ModeButton>
              <ModeButton active={mode === "manual"} onClick={() => setMode("manual")}>
                Formulário manual
              </ModeButton>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground mt-1">
            Comece dando um nome para a missão. Você poderá alterá-lo depois.
          </p>
        )}
      </div>

      {!nameConfirmed ? (
        <NameGate
          initial={missionName}
          onConfirm={(name) => {
            setMissionName(name);
            setNameConfirmed(true);
          }}
        />
      ) : mode === "ai" ? (
        <AiChatMode
          missionName={missionName}
          existingMissionId={postUpload?.missionId}
          initialMessages={postUpload?.initialMessages}
          extractedContext={postUpload?.extractedContext}
          onCreated={(id) => navigate({ to: "/missions/$missionId", params: { missionId: id } })}
        />
      ) : mode === "upload" ? (
        <UploadMode
          status={status}
          errorMsg={errorMsg}
          fileRef={fileRef}
          onFile={handleFile}
          onSwitchManual={() => setMode("manual")}
          onRetry={() => {
            setStatus("idle");
            setErrorMsg(null);
          }}
        />
      ) : (
        <div className="space-y-4">
          <MissionForm initialName={missionName} />
        </div>
      )}
    </div>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}

function NameGate({
  initial,
  onConfirm,
}: {
  initial: string;
  onConfirm: (name: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      toast.error("Dê um nome para a missão para continuar");
      return;
    }
    onConfirm(trimmed);
  };
  return (
    <Card className="p-8 max-w-xl mx-auto space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Nome da missão</h2>
        <p className="text-sm text-muted-foreground">
          Escolha um nome claro. Ex: &quot;Concorrentes de plano odontológico — SP&quot;.
        </p>
      </div>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Nome da missão"
        className="h-10"
      />
      <div className="flex justify-end">
        <Button onClick={submit} disabled={!value.trim()}>
          Continuar
        </Button>
      </div>
    </Card>
  );
}

function AiChatMode({
  missionName,
  existingMissionId,
  initialMessages,
  extractedContext,
  onCreated,
}: {
  missionName: string;
  existingMissionId?: string;
  initialMessages?: ChatMsg[];
  extractedContext?: string;
  onCreated: (missionId: string) => void;
}) {
  const briefingFn = useServerFn(missionBriefingAssistant);
  const defaultOpening: ChatMsg = {
    role: "assistant",
    content: missionName
      ? `Ótimo! Vamos montar a missão "**${missionName}**". Para começar: qual é o **principal objetivo** desta pesquisa?`
      : INITIAL_ASSISTANT_MESSAGE,
  };
  const [messages, setMessages] = useState<ChatMsg[]>(
    initialMessages && initialMessages.length > 0 ? initialMessages : [defaultOpening],
  );
  const [scope, setScope] = useState<BriefingScope | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { listening, start: startMic, stop: stopMic } = useSpeechRecognition((text) => {
    setInput((prev) => (prev ? prev + " " + text : text));
    setTimeout(() => textareaRef.current?.focus(), 0);
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || pending || createdId) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setPending(true);
    try {
      const res = await briefingFn({
        data: {
          messages: next,
          missionName: missionName || undefined,
          existingMissionId,
          extractedContext,
        },
      });
      setMessages((cur) => [...cur, { role: "assistant", content: res.text }]);
      if (res.scope) setScope(res.scope);
      if (res.missionCreated) {
        setCreatedId(res.missionId);
        toast.success("Missão criada!");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao processar mensagem";
      toast.error(msg);
      setMessages((cur) => [...cur, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setPending(false);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
      <Card className="flex flex-col h-[70vh] min-h-[520px] overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <ChatBubble key={i} role={m.role} content={m.content} />
          ))}
          {pending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Bot className="h-4 w-4" />
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Pensando…</span>
            </div>
          )}
          {createdId && (
            <Card className="p-4 border-emerald-500/40 bg-emerald-500/5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                <div>
                  <div className="font-semibold text-sm">Missão criada</div>
                  <div className="text-xs text-muted-foreground">Pronto para começar a coleta.</div>
                </div>
              </div>
              <Button onClick={() => onCreated(createdId)}>Ver minha missão</Button>
            </Card>
          )}
        </div>
        <div className="border-t bg-muted/20 p-3">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={createdId ? "Missão criada — abra para editar detalhes." : "Digite sua resposta… (Enter para enviar)"}
              rows={2}
              disabled={pending || !!createdId}
              className="resize-none flex-1"
            />
            <Button
              type="button"
              variant={listening ? "destructive" : "outline"}
              size="icon"
              className="h-10 w-10"
              onClick={listening ? stopMic : startMic}
              disabled={pending || !!createdId}
              title={listening ? "Parar gravação" : "Falar (pt-BR)"}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button onClick={send} disabled={pending || !input.trim() || !!createdId} size="icon" className="h-10 w-10">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </Card>

      <ScopePreview scope={scope} />
    </div>
  );
}

function ChatBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {content}
      </div>
      {isUser && (
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

const PROFUNDIDADE_LABEL: Record<string, string> = {
  observacao: "Observação",
  contato: "Primeiro contato",
  qualificacao: "Qualificação",
  reuniao: "Reunião",
  contratacao: "Contratação real",
};

type ExtractedMission = {
  name?: string | null;
  description?: string | null;
  objective?: string | null;
  deadline_final?: string | null;
  canais_obrigatorios?: string[] | null;
  cobertura_canais?: string | null;
  profundidade_autorizada?: string | null;
  entregavel_esperado?: string | null;
  restricoes?: string | null;
};

type ExtractedTarget = {
  name: string | null;
  instagram: string | null;
  site: string | null;
  whatsapp: string | null;
  category: string | null;
};

function buildExtractionSummary(
  mission: ExtractedMission | null,
  targets: ExtractedTarget[],
): { summary: string; context: string; missing: string[] } {
  const lines: string[] = [];
  const ctxParts: string[] = [];
  const missing: string[] = [];

  const objective = mission?.objective ?? mission?.description ?? "";
  if (objective.trim()) {
    lines.push(`- **Objetivo:** ${objective.trim()}`);
    ctxParts.push(`Objetivo: ${objective.trim()}`);
  } else {
    missing.push("Objetivo principal da pesquisa");
  }

  if (targets.length > 0) {
    const names = targets
      .map((t) => t.name || t.instagram || t.site || t.whatsapp)
      .filter(Boolean)
      .slice(0, 8);
    const extra = targets.length > names.length ? ` (+${targets.length - names.length})` : "";
    lines.push(`- **Concorrentes (${targets.length}):** ${names.join(", ")}${extra}`);
    ctxParts.push(`Concorrentes: ${targets.map((t) => t.name || t.instagram || t.site).filter(Boolean).join(", ")}`);
  } else {
    missing.push("Lista de concorrentes a mapear");
  }

  const canais = mission?.canais_obrigatorios ?? [];
  const cobertura = mission?.cobertura_canais ?? "";
  if (cobertura === "360") {
    lines.push(`- **Canais:** Cobertura 360° (todos os canais disponíveis)`);
    ctxParts.push(`Cobertura de canais: 360`);
  } else if (canais.length > 0) {
    lines.push(`- **Canais obrigatórios:** ${canais.join(", ")}`);
    ctxParts.push(`Canais obrigatórios: ${canais.join(", ")}`);
  } else {
    missing.push("Canais de abordagem (360° ou lista específica)");
  }

  if (mission?.profundidade_autorizada) {
    const label = PROFUNDIDADE_LABEL[mission.profundidade_autorizada] ?? mission.profundidade_autorizada;
    lines.push(`- **Profundidade autorizada:** ${label}`);
    ctxParts.push(`Profundidade: ${mission.profundidade_autorizada}`);
  } else {
    missing.push("Profundidade autorizada (observação, contato, qualificação, reunião ou contratação)");
  }

  if (mission?.entregavel_esperado?.trim()) {
    lines.push(`- **Entregável esperado:** ${mission.entregavel_esperado.trim()}`);
    ctxParts.push(`Entregável esperado: ${mission.entregavel_esperado.trim()}`);
  } else {
    missing.push("Entregável esperado (ex: proposta comercial, tabela de preços, deck de vendas)");
  }

  if (mission?.deadline_final) {
    lines.push(`- **Prazo final:** ${mission.deadline_final}`);
    ctxParts.push(`Prazo: ${mission.deadline_final}`);
  } else {
    missing.push("Prazo final para entrega");
  }

  if (mission?.restricoes?.trim()) {
    lines.push(`- **Restrições:** ${mission.restricoes.trim()}`);
    ctxParts.push(`Restrições: ${mission.restricoes.trim()}`);
  }

  return {
    summary: lines.join("\n") || "_(nenhum campo foi extraído com clareza)_",
    context: ctxParts.join("\n"),
    missing,
  };
}

function ScopePreview({ scope }: { scope: BriefingScope | null }) {
  const empty = !scope || (
    !scope.objetivo &&
    (!scope.concorrentes || scope.concorrentes.length === 0) &&
    !scope.cobertura_canais &&
    (!scope.canais_obrigatorios || scope.canais_obrigatorios.length === 0) &&
    !scope.profundidade &&
    !scope.prazo &&
    !scope.restricoes
  );
  return (
    <Card className="p-4 h-fit sticky top-4 space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Escopo em construção
      </div>
      {empty && (
        <p className="text-xs text-muted-foreground">
          Os campos aparecem aqui conforme você responde as perguntas do assistente.
        </p>
      )}
      {scope?.objetivo && (
        <Section icon={<TargetIcon className="h-3.5 w-3.5" />} label="Objetivo">
          <p className="text-sm">{scope.objetivo}</p>
        </Section>
      )}
      {scope?.concorrentes && scope.concorrentes.length > 0 && (
        <Section icon={<TargetIcon className="h-3.5 w-3.5" />} label={`Concorrentes (${scope.concorrentes.length})`}>
          <div className="flex flex-wrap gap-1.5">
            {scope.concorrentes.map((c) => (
              <Badge key={c} variant="secondary" className="text-[11px]">{c}</Badge>
            ))}
          </div>
        </Section>
      )}
      {(scope?.cobertura_canais || (scope?.canais_obrigatorios && scope.canais_obrigatorios.length > 0)) && (
        <Section icon={<Radio className="h-3.5 w-3.5" />} label="Canais">
          {scope?.cobertura_canais === "360" && (
            <Badge className="text-[11px] bg-primary/10 text-primary border-primary/30" variant="outline">Cobertura 360°</Badge>
          )}
          {scope?.canais_obrigatorios && scope.canais_obrigatorios.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {scope.canais_obrigatorios.map((c) => (
                <Badge key={c} variant="outline" className="text-[11px]">{c}</Badge>
              ))}
            </div>
          )}
        </Section>
      )}
      {scope?.profundidade && (
        <Section icon={<ShieldAlert className="h-3.5 w-3.5" />} label="Profundidade">
          <Badge variant="outline" className="text-[11px]">
            {PROFUNDIDADE_LABEL[scope.profundidade] ?? scope.profundidade}
          </Badge>
        </Section>
      )}
      {scope?.prazo && (
        <Section icon={<Calendar className="h-3.5 w-3.5" />} label="Prazo">
          <p className="text-sm">{scope.prazo}</p>
        </Section>
      )}
      {scope?.restricoes && (
        <Section icon={<ShieldAlert className="h-3.5 w-3.5" />} label="Restrições">
          <p className="text-sm text-muted-foreground">{scope.restricoes}</p>
        </Section>
      )}
    </Card>
  );
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
        {icon}
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

function UploadMode({
  status,
  errorMsg,
  fileRef,
  onFile,
  onSwitchManual,
  onRetry,
}: {
  status: UploadStatus;
  errorMsg: string | null;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFile: (f: File) => void;
  onSwitchManual: () => void;
  onRetry: () => void;
}) {
  if (status === "uploading" || status === "extracting" || status === "done") {
    const message =
      status === "uploading"
        ? "Enviando arquivo…"
        : status === "extracting"
          ? "IA lendo o documento e extraindo dados da missão…"
          : "Missão criada! Redirecionando…";
    return (
      <Card className="p-12 flex flex-col items-center justify-center gap-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <div>
          <p className="font-medium">{message}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Isso pode levar alguns segundos. Não feche a página.
          </p>
        </div>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card className="p-8 flex flex-col items-center text-center gap-4">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <div>
          <p className="font-medium">Não foi possível criar a missão</p>
          {errorMsg && <p className="text-xs text-muted-foreground mt-1">{errorMsg}</p>}
        </div>
        <div className="flex gap-2">
          <Button onClick={onRetry}>Tentar novamente</Button>
          <Button variant="ghost" onClick={onSwitchManual}>
            Preencher manualmente
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card
        className="p-12 border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-4 text-center cursor-pointer"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add("border-primary");
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove("border-primary");
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("border-primary");
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
      >
        <FileUp className="h-12 w-12 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Enviar briefing da missão</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            A IA lê o documento e cria a missão automaticamente. Você edita os detalhes depois.
          </p>
        </div>
        <Button type="button" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
          <Sparkles className="h-4 w-4 mr-2" />
          Selecionar arquivo (PDF ou DOCX)
        </Button>
        <p className="text-[11px] text-muted-foreground">ou arraste o arquivo aqui</p>
        <input
          type="file"
          ref={fileRef}
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </Card>

      <div className="text-center">
        <button
          type="button"
          onClick={onSwitchManual}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Prefere preencher manualmente?{" "}
          <span className="text-primary underline">Abrir formulário</span>
        </button>
      </div>
    </div>
  );
}

const CANAL_OPTIONS = [
  "Instagram DM",
  "WhatsApp",
  "Email",
  "Site",
  "LinkedIn",
  "Ligação",
  "Reunião online",
  "Formulário",
] as const;

const PROFUNDIDADE_OPTIONS: { value: string; label: string }[] = [
  { value: "observacao", label: "Observação (sem contato)" },
  { value: "contato", label: "Primeiro contato" },
  { value: "qualificacao", label: "Qualificação" },
  { value: "reuniao", label: "Reunião / demo" },
  { value: "contratacao", label: "Contratação real" },
];

function MissingFieldsDialog({
  state,
  onCancel,
  onSaved,
}: {
  state: {
    missionId: string;
    canais_obrigatorios: string[];
    profundidade_autorizada: string;
    entregavel_esperado: string;
  };
  onCancel: () => void;
  onSaved: (missionId: string) => void;
}) {
  const [canais, setCanais] = useState<string[]>(state.canais_obrigatorios ?? []);
  const [profundidade, setProfundidade] = useState<string>(state.profundidade_autorizada ?? "");
  const [entregavel, setEntregavel] = useState<string>(state.entregavel_esperado ?? "");
  const [saving, setSaving] = useState(false);

  const missingCanais = canais.length === 0;
  const missingProf = !profundidade;
  const missingEntreg = !entregavel.trim();
  const canSubmit = !missingCanais && !missingProf && !missingEntreg && !saving;

  function toggleCanal(c: string) {
    setCanais((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function save() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("missions")
        .update({
          canais_obrigatorios: canais,
          profundidade_autorizada: profundidade,
          entregavel_esperado: entregavel.trim(),
        })
        .eq("id", state.missionId);
      if (error) throw error;
      toast.success("Campos salvos.");
      onSaved(state.missionId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Revise os campos obrigatórios
          </DialogTitle>
          <DialogDescription>
            A IA não encontrou as informações abaixo no documento. Preencha antes de continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label className={missingCanais ? "text-destructive" : ""}>
              Canais obrigatórios de abordagem
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {CANAL_OPTIONS.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={canais.includes(c)}
                    onCheckedChange={() => toggleCanal(c)}
                  />
                  <span>{c}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className={missingProf ? "text-destructive" : ""}>
              Profundidade autorizada
            </Label>
            <Select value={profundidade} onValueChange={setProfundidade}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione até onde o analista pode ir" />
              </SelectTrigger>
              <SelectContent>
                {PROFUNDIDADE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className={missingEntreg ? "text-destructive" : ""}>
              Entregável esperado
            </Label>
            <Textarea
              value={entregavel}
              onChange={(e) => setEntregavel(e.target.value)}
              rows={3}
              placeholder="Ex: proposta comercial recebida, tabela de preços, deck de vendas..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Pular e abrir missão
          </Button>
          <Button onClick={save} disabled={!canSubmit}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar e continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}