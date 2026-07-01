import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLLM } from "@/lib/llm-router";
import { BLOCK_FIELDS, BLOCK_TITLES, COLLECTION_BLOCKS } from "@/lib/collection.queries";

const InputSchema = z.object({
  missionId: z.string().uuid(),
  targetId: z.string().uuid(),
  analystId: z.string().uuid(),
  conversationHistory: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(10_000),
    }),
  ).max(100),
  userMessage: z.string().max(10_000).nullable(),
  imageBase64: z.string().max(12_000_000).nullable().optional(),
  imageMimeType: z.string().max(80).nullable().optional(),
});

function parseBlockData(raw: string): {
  cleanMessage: string;
  blockUpdates: Record<string, Record<string, string>> | null;
} {
  const marker = "---BLOCK_DATA---";
  const idx = raw.lastIndexOf(marker);
  if (idx === -1) return { cleanMessage: raw.trim(), blockUpdates: null };
  const before = raw.slice(0, idx).trim();
  const jsonPart = raw.slice(idx + marker.length).trim();
  // Try to isolate a JSON object from possible surrounding fences
  const jsonMatch = jsonPart.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { cleanMessage: before, blockUpdates: null };
  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (!parsed || typeof parsed !== "object") return { cleanMessage: before, blockUpdates: null };
    const out: Record<string, Record<string, string>> = {};
    for (const [blk, fields] of Object.entries(parsed as Record<string, unknown>)) {
      if (!COLLECTION_BLOCKS.includes(blk as (typeof COLLECTION_BLOCKS)[number])) continue;
      if (!fields || typeof fields !== "object") continue;
      const allowed = new Set(BLOCK_FIELDS[blk as keyof typeof BLOCK_FIELDS] ?? []);
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(fields as Record<string, unknown>)) {
        if (!allowed.has(k)) continue;
        if (v === null || v === undefined) continue;
        const str = String(v).trim();
        if (!str || str.toLowerCase() === "null" || str === "—") continue;
        clean[k] = str.slice(0, 2000);
      }
      if (Object.keys(clean).length > 0) out[blk] = clean;
    }
    return {
      cleanMessage: before,
      blockUpdates: Object.keys(out).length > 0 ? out : null,
    };
  } catch {
    return { cleanMessage: before, blockUpdates: null };
  }
}

function buildBlocksSchemaSection() {
  return COLLECTION_BLOCKS.map(
    (b) => `${b} (${BLOCK_TITLES[b]}): ${BLOCK_FIELDS[b].join(", ")}`,
  ).join("\n");
}

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
        const label = d.doc_label ? ` - ${d.doc_label}` : "";
        const perBlock = COLLECTION_BLOCKS.map(
          (b) => `  • Bloco ${b}: ${ext.collection_blocks?.[b] ?? "—"}`,
        ).join("\n");
        return `[${(d.doc_type ?? "base").toUpperCase()}${label}] ${d.file_name ?? ""}
Objetivo: ${ext.objective ?? "—"}
Instruções por bloco:
${perBlock}`;
      })
      .join("\n\n");

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

BLOCOS E CAMPOS QUE VOCÊ DEVE PREENCHER (uma única conversa cobre TODOS):
${buildBlocksSchemaSection()}

COMO SE COMPORTAR:
- Você conduz UMA única conversa holística que cobre os 7 blocos (A a G). Nunca peça a mesma coisa duas vezes.
- Dê UMA instrução operacional de cada vez. Seja direta e específica, usando handles/URLs reais.
- Sempre que possível, formule perguntas/tarefas que coletem dados para múltiplos blocos ao mesmo tempo (ex.: "Envie prints da bio do Instagram e da home do site" alimenta A e C).
- Quando pedir evidência, diga explicitamente: "📸 Evidência necessária: [o que capturar]".
- Quando a analista reportar o resultado, valide, complemente se necessário, e siga para o próximo passo mais estratégico dentro dos blocos ainda pendentes.
- Quando julgar que TODOS os blocos foram cobertos com evidências suficientes, encerre com: "✅ Pesquisa concluída. Você pode revisar os dados coletados e salvar."
- Se for a primeira mensagem (sem histórico), abra assim:
  1) Uma linha: "Você está iniciando a pesquisa sobre ${target.name}."
  2) Um bloco "📋 **O que eu já sei sobre este alvo:**" listando Nome/Handle, Instagram, Site, Segmento (use "—" quando faltar).
  3) Uma linha "🎯 **Objetivo da missão:** ${mission.objective ?? "—"}".
  4) "**Passo 1:**" com a primeira instrução operacional que colete o máximo possível dos blocos A e C de uma vez.
- Responda sempre em português brasileiro
- Seja direta e objetiva — a analista está em campo

PROCESSAMENTO DE EVIDÊNCIAS:
- Ao receber um print (imagem): descreva de forma estruturada o que vê (plataforma, conteúdo, métricas, texto visível), extraia dados relevantes para QUALQUER bloco aplicável, resuma em bullets e avance para o próximo passo.
- Ao receber texto colado de conversa (WhatsApp, DM, e-mail, chat): identifique padrões de exportação (hora, nome, mensagem), aponte quem atendeu, o tom (rápido/robótico/consultivo), e extraia preços/planos/condições. Resuma em bullets e avance.
- Sempre confirme o que ficou registrado antes de pedir a próxima ação.

PREENCHIMENTO AUTOMÁTICO DOS CAMPOS (obrigatório sempre que houver dados novos):
- Ao final da mensagem, quando você identificar valores para campos dos blocos, adicione o marcador exato \`---BLOCK_DATA---\` em uma nova linha e, na linha seguinte, um JSON puro (sem cercas de código) no formato:
  {"A": {"canal_principal": "Instagram"}, "C": {"preco": "R$ 497/mês"}}
- Use APENAS os campos definidos na lista acima. Só inclua um campo quando tiver evidência concreta na conversa. Nunca invente. Não inclua o marcador se não houver nada novo a registrar.
- O JSON não deve aparecer na parte visível da mensagem — coloque-o SOMENTE após o marcador \`---BLOCK_DATA---\`.`;

    const messages: Array<{
      role: "user" | "assistant";
      content:
        | string
        | Array<
            | { type: "text"; text: string }
            | { type: "image_base64"; mediaType: string; data: string }
          >;
    }> = [...data.conversationHistory];

    const hasImage = !!data.imageBase64;
    if (hasImage) {
      const text = data.userMessage?.trim() || "Veja o print que enviei:";
      messages.push({
        role: "user",
        content: [
          { type: "text", text },
          {
            type: "image_base64",
            mediaType: data.imageMimeType || "image/jpeg",
            data: data.imageBase64!,
          },
        ],
      });
    } else if (data.userMessage && data.userMessage.trim()) {
      messages.push({ role: "user", content: data.userMessage });
    } else if (messages.length === 0) {
      messages.push({ role: "user", content: `Iniciar pesquisa sobre ${target.name}.` });
    }

    const { text: rawMessage, provider, model: usedModel } = await callLLM({
      task: "assistant",
      systemPrompt: system,
      messages,
      maxTokens: 2048,
    });
    console.log(`[assistant] used ${provider}/${usedModel}`);
    const { cleanMessage, blockUpdates } = parseBlockData(rawMessage);

    // Persist the assistant message server-side (RLS blocks client inserts
    // with role='assistant'). Verified caller is authenticated + owns the analyst_id.
    if (data.analystId !== context.userId) {
      throw new Error("analystId não corresponde ao usuário autenticado");
    }
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: insErr } = await supabaseAdmin.from("assistant_messages").insert({
        mission_id: data.missionId,
        target_id: data.targetId,
        block: "all",
        analyst_id: data.analystId,
        role: "assistant",
        content: cleanMessage,
      });
      if (insErr) console.warn("[assistant] failed to persist assistant message", insErr);
    } catch (e) {
      console.warn("[assistant] persist error", e);
    }

    return { message: cleanMessage, blockUpdates };
  });