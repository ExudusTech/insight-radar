import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser, currentUserQueryKey } from "@/hooks/use-current-user";
import { Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { runLlmFallbackTest } from "@/lib/llm-router-test.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data: user, isLoading } = useCurrentUser();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [phone, setPhone] = useState("");
  const runTest = useServerFn(runLlmFallbackTest);
  const [testing, setTesting] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    scenarioId: string;
    provider: string;
    model: string;
    attempts: Array<{ provider: string; model: string; status: number; ok: boolean; bodySnippet: string }>;
  } | null>(null);

  type Scenario = {
    id: string;
    label: string;
    task: "assistant" | "extraction";
    failProviders: Array<"anthropic" | "openai" | "gemini">;
    expected: string;
  };
  const scenarios: Scenario[] = [
    { id: "a", label: "assistant — sem falha (espera Gemini)", task: "assistant", failProviders: [], expected: "gemini" },
    { id: "b", label: "assistant — falha Gemini (espera Anthropic)", task: "assistant", failProviders: ["gemini"], expected: "anthropic" },
    { id: "c", label: "assistant — falha Gemini+Anthropic (espera OpenAI)", task: "assistant", failProviders: ["gemini", "anthropic"], expected: "openai" },
    { id: "d", label: "extraction — falha Anthropic+OpenAI (espera Gemini)", task: "extraction", failProviders: ["anthropic", "openai"], expected: "gemini" },
  ];

  const handleRun = async (s: Scenario) => {
    setTesting(s.id);
    try {
      const res = await runTest({ data: { task: s.task, failProviders: s.failProviders } });
      const ok = res.provider === s.expected;
      const msg = `${s.label} → ${res.provider}/${res.model}`;
      console.log("[llm-fallback-test]", { scenario: s.id, ...res });
      setLastResult({
        scenarioId: s.id,
        provider: res.provider,
        model: res.model,
        attempts: res.attempts ?? [],
      });
      if (ok) toast.success(msg);
      else toast.warning(`${msg} (esperado: ${s.expected})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no teste");
    } finally {
      setTesting(null);
    }
  };

  useEffect(() => {
    if (user?.profile) {
      setFullName(user.profile.full_name ?? "");
      setOrganization(user.profile.organization ?? "");
      setPhone(user.profile.phone ?? "");
    }
  }, [user]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sem usuário");
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, organization, phone })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: currentUserQueryKey });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  if (isLoading) {
    return <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold">Perfil</h2>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
        <div className="space-y-2">
          <Label>Nome completo</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Organização</Label>
          <Input value={organization} onChange={(e) => setOrganization(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
        </Button>
      </Card>
      <Card className="p-6">
        <h2 className="font-semibold">Segurança</h2>
        <p className="text-sm text-muted-foreground mt-2">Em breve.</p>
      </Card>
      {user?.role === "superadmin" && (
        <Card className="p-6 space-y-3">
          <div>
            <h2 className="font-semibold">Diagnóstico LLM Router</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Força falha em provedores para validar a cadeia de fallback. Resultado no toast e no console.
            </p>
          </div>
          <div className="grid gap-2">
            {scenarios.map((s) => (
              <Button
                key={s.id}
                variant="outline"
                className="justify-start"
                onClick={() => handleRun(s)}
                disabled={testing !== null}
              >
                {testing === s.id && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {s.label}
              </Button>
            ))}
          </div>
          {lastResult && (
            <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-2">
              <div className="font-medium">
                Cenário <code>{lastResult.scenarioId}</code> → vencedor:{" "}
                <code>{lastResult.provider}/{lastResult.model}</code>
              </div>
              <div className="space-y-1">
                {lastResult.attempts.map((a, i) => (
                  <div key={i} className="font-mono">
                    <span className={a.ok ? "text-emerald-500" : "text-rose-500"}>
                      [{a.status}] {a.provider}/{a.model}
                    </span>
                    {!a.ok && a.bodySnippet && (
                      <div className="pl-4 text-muted-foreground break-all">{a.bodySnippet}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}