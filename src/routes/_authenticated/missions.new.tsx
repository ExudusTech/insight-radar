import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Send, Bot, User, CheckCircle2, Target as TargetIcon, Radio, Calendar, ShieldAlert, Mic, MicOff, Pencil, Paperclip, FileText } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { MissionForm } from "@/components/missions/mission-form";
import { useCurrentUser } from "@/hooks/use-current-user";
import { updateMissionFromExtraction } from "@/lib/missions.queries";
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

type Mode = "ai" | "manual";
type ChatMsg = { role: "user" | "assistant"; content: string };

const INITIAL_ASSISTANT_MESSAGE =
  "Olá! Vou ajudá-lo a criar uma nova missão de inteligência competitiva.\n\nAntes de começarmos: você tem algum **documento de briefing** (PDF ou DOCX) para me enviar? Clique no ícone de 📎 clipe abaixo para anexar — eu leio e extraio tudo automaticamente. Se preferir, é só me responder por aqui que faço as perguntas uma a uma.";

function NewMissionPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("ai");
  const [missionName, setMissionName] = useState<string>("");
  const [nameConfirmed, setNameConfirmed] = useState(false);

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
              Converse com a IA para montar o escopo — anexe um briefing no próprio chat, ou preencha manualmente.
            </p>
            <div className="mt-3 flex gap-2 text-xs">
              <ModeButton active={mode === "ai"} onClick={() => setMode("ai")}>
                <Bot className="h-3 w-3" /> Chat com IA
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
          onCreated={(id) => navigate({ to: "/missions/$missionId", params: { missionId: id } })}
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
  onCreated,
}: {
  missionName: string;
  onCreated: (missionId: string) => void;
}) {
  const briefingFn = useServerFn(missionBriefingAssistant);
  const createMissionFn = useServerFn(createMissionServer);
  const extractFn = useServerFn(extractMissionDocument);
  const { data: user } = useCurrentUser();
  const defaultOpening: ChatMsg = {
    role: "assistant",
    content: missionName
      ? `Ótimo! Vamos montar a missão "**${missionName}**".\n\nAntes de começarmos: você tem algum **documento de briefing** (PDF ou DOCX) para me enviar? Clique no ícone de 📎 clipe abaixo para anexar — eu leio e extraio tudo automaticamente. Se preferir, é só me responder por aqui que faço as perguntas uma a uma.`
      : INITIAL_ASSISTANT_MESSAGE,
  };
  const [messages, setMessages] = useState<ChatMsg[]>([defaultOpening]);
  const [scope, setScope] = useState<BriefingScope | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [uploadStage, setUploadStage] = useState<null | "uploading" | "extracting">(null);
  const [missionId, setMissionId] = useState<string | null>(null);
  const [extractedContext, setExtractedContext] = useState<string | undefined>(undefined);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { listening, start: startMic, stop: stopMic } = useSpeechRecognition((text) => {
    setInput((prev) => (prev ? prev + " " + text : text));
    setTimeout(() => textareaRef.current?.focus(), 0);
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending, uploadStage]);

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
          existingMissionId: missionId ?? undefined,
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

  async function handleAttach(file: File) {
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      toast.error("Apenas PDF ou DOCX");
      return;
    }
    if (!user?.id || pending || uploadStage || createdId) return;

    setMessages((cur) => [
      ...cur,
      { role: "user", content: `📎 Anexei o briefing: **${file.name}**` },
    ]);
    setUploadStage("uploading");

    try {
      // 1. Create draft mission if not already created
      let mid = missionId;
      if (!mid) {
        const result = await createMissionFn({
          data: { name: missionName.trim() || "Nova missão", target_label: "Concorrente" },
        });
        mid = result.missionId;
        setMissionId(mid);
      }

      // 2. Upload document version
      const version = await uploadAndCreateVersion({
        missionId: mid,
        file,
        authorId: user.id,
        docType: "base",
      });

      // 3. Extract
      setUploadStage("extracting");
      await extractFn({ data: { versionId: version.id } });

      const { data: ver } = await supabase
        .from("document_versions")
        .select("extracted_data")
        .eq("id", version.id)
        .single();
      const extracted = (ver?.extracted_data ?? {}) as Parameters<
        typeof updateMissionFromExtraction
      >[1];
      await updateMissionFromExtraction(mid, extracted);
      await freezeVersion(version.id);
      await createTargetsFromExtraction(version.id);

      // 4. Fetch back and build summary for the chat
      const [{ data: created }, { data: tgts }] = await Promise.all([
        supabase
          .from("missions")
          .select(
            "name, description, objective, deadline_final, canais_obrigatorios, cobertura_canais, profundidade_autorizada, entregavel_esperado, restricoes",
          )
          .eq("id", mid)
          .single(),
        supabase
          .from("targets")
          .select("name, instagram, site, whatsapp, category")
          .eq("mission_id", mid),
      ]);

      const { summary, context, missing } = buildExtractionSummary(created, tgts ?? []);
      const openingLine = missing.length > 0
        ? "Li seu documento! Aqui está o que consegui identificar — mas ainda preciso confirmar alguns pontos com você antes de lançar a missão:"
        : "Li seu documento! Identifiquei os dados abaixo. Posso lançar a missão com essas configurações, ou há algo que precise ajustar?";
      const followUp = missing.length > 0
        ? `\n\n**Preciso que você me ajude com:**\n${missing.map((m: string) => `- ${m}`).join("\n")}`
        : "";

      setExtractedContext(context);
      setMessages((cur) => [
        ...cur,
        { role: "assistant", content: `${openingLine}\n\n${summary}${followUp}` },
      ]);
      toast.success("Documento processado!");
    } catch (e) {
      console.error("[missions.new] attach failed:", e);
      const msg = e instanceof Error ? e.message : "Erro ao processar documento";
      toast.error(msg);
      setMessages((cur) => [
        ...cur,
        { role: "assistant", content: `⚠️ Não consegui processar o documento: ${msg}. Podemos continuar aqui pelo chat mesmo — me conte sobre a missão.` },
      ]);
    } finally {
      setUploadStage(null);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const busy = pending || !!uploadStage;

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
          {uploadStage && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-4 w-4" />
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>
                {uploadStage === "uploading"
                  ? "Enviando documento…"
                  : "Lendo e extraindo dados do briefing…"}
              </span>
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
            <input
              type="file"
              ref={fileRef}
              accept=".pdf,.docx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAttach(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10"
              onClick={() => fileRef.current?.click()}
              disabled={busy || !!createdId}
              title="Anexar briefing (PDF ou DOCX)"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={createdId ? "Missão criada — abra para editar detalhes." : "Digite sua resposta… (ou anexe um briefing 📎)"}
              rows={2}
              disabled={busy || !!createdId}
              className="resize-none flex-1"
            />
            <Button
              type="button"
              variant={listening ? "destructive" : "outline"}
              size="icon"
              className="h-10 w-10"
              onClick={listening ? stopMic : startMic}
              disabled={busy || !!createdId}
              title={listening ? "Parar gravação" : "Falar (pt-BR)"}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button onClick={send} disabled={busy || !input.trim() || !!createdId} size="icon" className="h-10 w-10">
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
  // Canais sempre ficam em `missing` (precisam confirmação explícita do cliente),
  // mas quando extraídos do documento, viram sugestão a confirmar.
  if (canais.length > 0) {
    missing.push(
      `Canal de abordagem ativo — o documento menciona ${canais.join(", ")}: confirma esses canais ou quer ajustar?`,
    );
    ctxParts.push(
      `Canais sugeridos pelo documento (aguardando confirmação do cliente): ${canais.join(", ")}`,
    );
  } else {
    missing.push(
      "Canal de abordagem ativo (não identificado no documento — qual canal o analista deve usar?)",
    );
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
    const deadlineDate = new Date(mission.deadline_final);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (deadlineDate < today) {
      missing.push(`Prazo (o encontrado no documento — ${mission.deadline_final} — já passou, precisamos de uma nova data)`);
      ctxParts.push(`CONTEXTO: prazo extraído ${mission.deadline_final} está vencido — perguntar novo prazo ao cliente.`);
    } else {
      lines.push(`- **Prazo final:** ${mission.deadline_final}`);
      ctxParts.push(`Prazo: ${mission.deadline_final}`);
    }
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

