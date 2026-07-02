import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Send, Search, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { queryMissionIntelligence } from "@/lib/mission-assistant.functions";

export const Route = createFileRoute("/_authenticated/missions/$missionId/comparative")({
  component: ComparativeTab,
});

type Msg = { role: "user" | "assistant"; content: string };

const EXAMPLES = [
  "Quem tem o melhor atendimento?",
  "Compare a precificação de todos os concorrentes.",
  "Qual é o principal diferencial de cada um?",
  "Que pontos fracos são comuns a todos?",
];

function ComparativeTab() {
  const { missionId } = Route.useParams();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const callQuery = useServerFn(queryMissionIntelligence);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  const mut = useMutation({
    mutationFn: async (question: string) => {
      const history = messages.slice(-10);
      const res = await callQuery({ data: { missionId, question, history } });
      return res.answer;
    },
    onSuccess: (answer, question) => {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: question },
        { role: "assistant", content: answer },
      ]);
      setInput("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha na consulta"),
  });

  const send = (q?: string) => {
    const question = (q ?? input).trim();
    if (!question || mut.isPending) return;
    mut.mutate(question);
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Pergunte sobre os concorrentes desta missão</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          A IA responde usando apenas os dados coletados pelos analistas nos blocos A–G de cada concorrente.
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => send(ex)}
              disabled={mut.isPending}
              className="text-[11px] rounded-full border px-2 py-1 hover:bg-muted transition-colors disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div
          ref={scrollRef}
          className="max-h-[520px] min-h-[280px] overflow-y-auto px-4 py-4 space-y-3"
        >
          {messages.length === 0 && !mut.isPending && (
            <div className="text-center text-sm text-muted-foreground py-10">
              <Sparkles className="h-5 w-5 mx-auto mb-2 text-primary/60" />
              Faça uma pergunta ou clique em um dos exemplos acima.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user" ? "bg-primary/10" : "bg-muted/60"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {mut.isPending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Analisando...
            </div>
          )}
        </div>
        <div className="border-t p-3 flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Pergunte algo sobre os concorrentes..."
            className="min-h-9 max-h-24 text-sm resize-none"
          />
          <Button size="sm" onClick={() => send()} disabled={!input.trim() || mut.isPending}>
            {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </Card>
    </div>
  );
}