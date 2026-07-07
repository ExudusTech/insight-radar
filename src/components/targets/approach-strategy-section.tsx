import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Lock, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { targetDetailKey, targetsByMissionKey } from "@/lib/targets.queries";
import { cn } from "@/lib/utils";

type PersonaObject = { nome?: string; contexto?: string; [k: string]: unknown };

function parsePersona(raw: unknown): PersonaObject {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as PersonaObject;
      return { contexto: raw };
    } catch {
      return { contexto: raw };
    }
  }
  if (typeof raw === "object") return raw as PersonaObject;
  return {};
}

const CHANNEL_OPTIONS = [
  "Instagram DM",
  "WhatsApp",
  "Site — formulário",
  "LinkedIn",
  "E-mail",
  "Ligação",
  "Reunião online (videocall)",
  "Reunião online (ligação)",
];

export function ApproachStrategySection({
  targetId,
  canalAbordagem,
  personaLead,
  readonly,
  missionCanais,
}: {
  targetId: string;
  canalAbordagem: string | null;
  personaLead: unknown;
  readonly?: boolean;
  missionCanais?: string[] | null;
}) {
  const qc = useQueryClient();
  const initialPersona = parsePersona(personaLead);
  const parseCanais = (raw: string | null) =>
    (raw ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
  const [canais, setCanais] = useState<string[]>(parseCanais(canalAbordagem));
  const [nome, setNome] = useState(initialPersona.nome ?? "");
  const [contexto, setContexto] = useState(initialPersona.contexto ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCanais(parseCanais(canalAbordagem));
    const p = parsePersona(personaLead);
    setNome(p.nome ?? "");
    setContexto(p.contexto ?? "");
  }, [targetId, canalAbordagem, personaLead]);

  if (readonly) {
    const personaNome = parsePersona(personaLead).nome ?? nome;
    const personaContexto = parsePersona(personaLead).contexto ?? contexto;
    const targetCanais = parseCanais(canalAbordagem);
    const usingFallback = targetCanais.length === 0 && (missionCanais?.length ?? 0) > 0;
    const displayCanais = targetCanais.length > 0 ? targetCanais : (missionCanais ?? []);
    return (
      <div className="space-y-3 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Estratégia de abordagem
          </h3>
          <Lock className="h-3 w-3 text-muted-foreground ml-auto" />
        </div>
        {displayCanais.length > 0 ? (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              {displayCanais.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-amber-500/50 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300"
                >
                  {c}
                </span>
              ))}
            </div>
            {usingFallback && (
              <p className="text-[11px] text-muted-foreground italic">
                Usando canais gerais da missão (nenhum canal específico definido para este alvo).
              </p>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground italic">Canais não definidos no briefing.</p>
        )}
        {(personaNome || personaContexto) && (
          <div className="text-[11px] text-muted-foreground">
            <span className="font-medium">Persona:</span>{" "}
            {personaNome}
            {personaContexto ? ` — ${personaContexto}` : ""}
          </div>
        )}
      </div>
    );
  }

  const toggleCanal = (canal: string) => {
    setCanais((prev) =>
      prev.includes(canal) ? prev.filter((c) => c !== canal) : [...prev, canal],
    );
  };

  const mut = useMutation({
    mutationFn: async () => {
      const persona = { nome: nome.trim() || null, contexto: contexto.trim() || null };
      const canalStr = canais.join(", ");
      const { error, data } = await supabase
        .from("targets")
        .update({
          canal_abordagem: canalStr || null,
          persona_lead: persona as never,
        })
        .eq("id", targetId)
        .select("mission_id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      qc.invalidateQueries({ queryKey: targetDetailKey(targetId) });
      if (data?.mission_id) {
        qc.invalidateQueries({ queryKey: targetsByMissionKey(data.mission_id) });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  return (
    <div className="space-y-3 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Estratégia de abordagem
        </h3>
        {saved && <Check className="h-3.5 w-3.5 text-emerald-600" />}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Rotacione canais e personas por concorrente para evitar exposição do analista em pesquisas paralelas.
      </p>
      <div className="space-y-2">
        <div>
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Canais de abordagem
          </label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {CHANNEL_OPTIONS.map((c) => {
              const active = canais.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCanal(c)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "border-amber-600 bg-amber-600 text-white hover:bg-amber-700"
                      : "border-border bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Persona — nome fictício
            </label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Ana Lima"
              className="h-8 mt-1"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Persona — contexto
            </label>
            <Textarea
              value={contexto}
              onChange={(e) => setContexto(e.target.value)}
              placeholder="Ex: empresária buscando serviço X para empresa de médio porte"
              rows={2}
              className="mt-1 text-sm"
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar estratégia"}
        </Button>
      </div>
    </div>
  );
}