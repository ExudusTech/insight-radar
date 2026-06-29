import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLLM } from "@/lib/llm-router";

const InputSchema = z.object({
  missionId: z.string().uuid(),
  targetId: z.string().uuid(),
  block: z.string().min(1).max(80),
  analystId: z.string().uuid(),
  conversationHistory: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(10_000),
    }),
  ).max(100),
  userMessage: z.string().max(10_000).nullable(),
});

export const missionAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [{ data: mission }, { data: docs }, { data: target }] = await Promise.all([
      supabase
        .from("missions")
        .select("name, objective, segment")
        .eq("id", data.missionId)
        .single(),
      supabase
        .from("document_versions")
        .select("doc_type, doc_label, file_name, extracted_data")
        .eq("mission_id", data.missionId)
        .eq("status", "frozen"),
      supabase
        .from("targets")
        .select("name, brand, category, site, instagram, linkedin, whatsapp, email")
        .eq("id", data.targetId)
        .single(),
    ]);

    if (!mission) throw new Error("Missão não encontrada");
    if (!target) throw new Error("Alvo não encontrado");

    const frozenDocs = docs ?? [];

    const docsSection = frozenDocs
      .map((d) => {
        const ext = (d.extracted_data ?? {}) as {
          objective?: string;
          collection_blocks?: Record<string, string>;
        };
        const blockText = ext.collection_blocks?.[data.block] ?? "";
        const label = d.doc_label ? ` - ${d.doc_label}` : "";
        return `[${(d.doc_type ?? "base").toUpperCase()}${label}] ${d.file_name ?? ""}
Objetivo: ${ext.objective ?? "—"}
Instruções bloco ${data.block}: ${blockText || "—"}`;
      })
      .join("\n\n");

    const blockInstructions = frozenDocs
      .map((d) => {
        const ext = (d.extracted_data ?? {}) as { collection_blocks?: Record<string, string> };
        return ext.collection_blocks?.[data.block] ?? "";
      })
      .filter(Boolean)
      .join("\n---\n");

    const system = `Você é o Assistente de Missão do Radar de Mercado IA. Coordena analistas de cliente oculto em campo.

MISSÃO: ${mission.name}
OBJETIVO: ${mission.objective ?? "—"}
SEGMENTO: ${mission.segment ?? "—"}

BASE DE CONHECIMENTO (${frozenDocs.length} documentos):
${docsSection || "Nenhum documento congelado ainda."}

ALVO: ${target.name} ${target.brand ?? ""}
Categoria: ${target.category ?? "—"}
Site: ${target.site ?? "—"}
Instagram: ${target.instagram ?? "—"}
LinkedIn: ${target.linkedin ?? "—"}
WhatsApp: ${target.whatsapp ?? "—"}

INSTRUÇÕES DO BLOCO ${data.block}:
${blockInstructions || "—"}

COMO SE COMPORTAR:
- Dê UMA instrução operacional de cada vez. Seja direta e específica.
- Use os dados reais do alvo (handles, URLs) nas instruções
- Exemplos de instruções boas: "Acesse ${target.instagram ?? "{instagram}"} e envie uma mensagem direta perguntando sobre planos e preços. Aguarde resposta e registre aqui o que responderam." ou "Abra o site ${target.site ?? "{site}"}, navegue até a página de preços e tire um print. Cole abaixo o que encontrou sobre valores."
- Quando pedir evidência, diga explicitamente: "📸 Evidência necessária: [o que capturar]"
- Quando a analista reportar o resultado, valide, complemente se necessário, e dê a próxima instrução
- Quando julgar que o bloco está suficientemente coberto, encerre com: "✅ Bloco ${data.block} concluído. Você pode salvar e avançar."
- Se for a primeira mensagem do bloco (sem histórico), apresente brevemente o objetivo do bloco e dê a primeira instrução
- Responda sempre em português brasileiro
- Seja direta e objetiva — a analista está em campo`;

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...data.conversationHistory,
    ];
    if (data.userMessage && data.userMessage.trim()) {
      messages.push({ role: "user", content: data.userMessage });
    } else if (messages.length === 0) {
      messages.push({ role: "user", content: `Iniciar bloco ${data.block}.` });
    }

    const { text: message, provider, model: usedModel } = await callLLM({
      task: "assistant",
      systemPrompt: system,
      messages,
      maxTokens: 2048,
    });
    console.log(`[assistant] used ${provider}/${usedModel}`);
    return { message };
  });