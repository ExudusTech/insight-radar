import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLLM } from "@/lib/llm-router";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1),
  missionName: z.string().trim().min(1).optional(),
});

const SYSTEM_PROMPT = `Você é um assistente especializado em criação de missões de inteligência competitiva para o Radar de Mercado IA.

Seu objetivo é conduzir uma conversa NATURAL e objetiva para entender o escopo da pesquisa e ao final criar a missão no sistema. NUNCA liste todas as perguntas de uma vez.

FLUXO DA CONVERSA (uma pergunta por vez, adaptando-se às respostas):
1. Objetivo principal da pesquisa (ex: entender precificação, mapear funil de vendas, identificar diferenciais, visão 360°).
2. Lista de concorrentes a mapear (aceite nomes, @Instagram, sites, WhatsApp — qualquer identificador). Uma missão pode ter de 1 a 20 concorrentes.
3. Cobertura de canais: "Quer que o analista aborde TODOS os canais que encontrar (360°) ou prefere selecionar canais específicos?"
   - Se selecionar, liste: Instagram DM, WhatsApp, Site — formulário, LinkedIn, E-mail, Ligação, Reunião online.
4. Profundidade autorizada:
   - Apenas observação (conteúdo público, sem contato)
   - Primeiro contato (DM/WhatsApp inicial, sem avançar)
   - Qualificação (avançar no funil, receber propostas)
   - Reunião (agendar calls, sem contratação)
   - Contratação real (cliente autoriza pagar pelo serviço para experiência completa)
5. Prazo — data limite para entrega.
6. Restrições — algo que o analista não deve fazer ou prioridade absoluta.
7. Entregável esperado — pergunte de forma direta: "Para garantir que a equipe de analistas entregue exatamente o que você precisa: **qual é o entregável principal desta missão?** Por exemplo: proposta comercial recebida do concorrente, tabela de preços, deck de vendas, roteiro de atendimento documentado, ou outro?" Aceite descrições livres.

A cada resposta sua, no final da mensagem (após o texto conversacional), inclua SEMPRE um bloco de escopo com o que já foi coletado até agora (pode ter campos vazios). Este bloco é oculto para o usuário — não o comente na mensagem. Formato exato:

---ESCOPO---
{
  "objetivo": "texto ou vazio",
  "concorrentes": ["nome1", "nome2"],
  "cobertura_canais": "360|selecionado|",
  "canais_obrigatorios": ["Instagram DM"],
  "profundidade": "observacao|contato|qualificacao|reuniao|contratacao|",
  "prazo": "YYYY-MM-DD ou vazio",
  "restricoes": "texto ou vazio",
  "entregavel_esperado": "texto ou vazio"
}
---/ESCOPO---

REGRAS:
- Seja conversacional e direto. Aceite respostas incompletas e peça complemento suavemente.
- Infira categoria dos concorrentes pelo contexto.
- Antes de criar, apresente um RESUMO ESTRUTURADO em markdown com todos os campos coletados e pergunte: "Posso criar a missão com estas configurações?"
- Só emita o bloco de criação após a confirmação explícita do usuário.
- Se o entregável esperado ainda não estiver claro na conversa, faça a pergunta 7 ANTES do resumo final. Nunca crie a missão sem ter esse campo preenchido.

Quando o usuário confirmar, responda com uma mensagem curta de confirmação SEGUIDA do bloco JSON EXATAMENTE neste formato (sem cercas de código markdown ao redor do bloco):

---CRIAR_MISSAO---
{
  "title": "título sugerido para a missão",
  "description": "descrição do objetivo",
  "deadline": "YYYY-MM-DD",
  "profundidade": "observacao|contato|qualificacao|reuniao|contratacao",
  "cobertura_canais": "360|selecionado",
  "canais_obrigatorios": ["Instagram DM", "WhatsApp"],
  "targets": [
    { "name": "Nome", "instagram": "@handle", "site": "url", "whatsapp": "numero", "category": "categoria inferida" }
  ],
  "restricoes": "texto livre",
  "entregavel_esperado": "descrição clara do que o cliente espera receber ao final"
}
---/CRIAR_MISSAO---

Campos ausentes podem ser null ou string vazia. Use apenas os valores enumerados para "profundidade" e "cobertura_canais".`;

type MissionPayload = {
  title?: string;
  description?: string;
  deadline?: string | null;
  profundidade?: string;
  cobertura_canais?: string;
  canais_obrigatorios?: string[];
  targets?: Array<{
    name?: string;
    instagram?: string | null;
    site?: string | null;
    whatsapp?: string | null;
    category?: string | null;
  }>;
  restricoes?: string | null;
  entregavel_esperado?: string | null;
};

function extractCreateBlock(text: string): { cleanText: string; payload: MissionPayload | null } {
  const re = /---CRIAR_MISSAO---([\s\S]*?)---\/CRIAR_MISSAO---/;
  const m = text.match(re);
  if (!m) return { cleanText: text, payload: null };
  let raw = m[1].trim();
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const payload = JSON.parse(raw) as MissionPayload;
    return { cleanText: text.replace(re, "").trim(), payload };
  } catch {
    return { cleanText: text.replace(re, "").trim(), payload: null };
  }
}

export type BriefingScope = {
  objetivo?: string;
  concorrentes?: string[];
  cobertura_canais?: string;
  canais_obrigatorios?: string[];
  profundidade?: string;
  prazo?: string;
  restricoes?: string;
  entregavel_esperado?: string;
};

function extractScopeBlock(text: string): { cleanText: string; scope: BriefingScope | null } {
  const re = /---ESCOPO---([\s\S]*?)---\/ESCOPO---/;
  const m = text.match(re);
  if (!m) return { cleanText: text, scope: null };
  let raw = m[1].trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const scope = JSON.parse(raw) as BriefingScope;
    return { cleanText: text.replace(re, "").trim(), scope };
  } catch {
    return { cleanText: text.replace(re, "").trim(), scope: null };
  }
}

function isValidDate(d?: string | null): d is string {
  if (!d) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export const missionBriefingAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const [{ data: isContractor }, { data: isSuperadmin }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "contractor" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "superadmin" }),
    ]);
    if (!isContractor && !isSuperadmin) {
      throw new Error("Forbidden: only contractors or superadmins can create missions");
    }

    const { text } = await callLLM({
      task: "assistant",
      systemPrompt: SYSTEM_PROMPT,
      messages: data.messages,
      maxTokens: 1800,
      tracking: {
        userId: context.userId,
        taskLabel: "briefing_assistant",
      },
    });

    const { cleanText: t1, payload } = extractCreateBlock(text);
    const { cleanText, scope } = extractScopeBlock(t1);

    if (!payload) {
      return { text: cleanText || text, missionCreated: false as const, scope };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const canais = Array.isArray(payload.canais_obrigatorios)
      ? payload.canais_obrigatorios.filter((c) => typeof c === "string" && c.trim().length > 0)
      : [];

    const { data: mission, error: mErr } = await supabaseAdmin
      .from("missions")
      .insert({
        name: data.missionName?.trim() || payload.title?.trim() || "Nova missão",
        description: payload.description ?? null,
        objective: payload.description ?? null,
        deadline_final: isValidDate(payload.deadline) ? payload.deadline : null,
        status: "draft",
        created_by: context.userId,
        contractor_id: context.userId,
        target_label: "Concorrente",
        profundidade_autorizada: payload.profundidade ?? null,
        cobertura_canais: payload.cobertura_canais ?? null,
        canais_obrigatorios: canais.length > 0 ? canais : null,
        restricoes: payload.restricoes ?? null,
        entregavel_esperado: payload.entregavel_esperado?.trim() || null,
      })
      .select("id")
      .single();
    if (mErr) throw mErr;

    const targets = (payload.targets ?? [])
      .filter((t) => t && (t.name?.trim() || t.instagram || t.site || t.whatsapp))
      .slice(0, 20)
      .map((t) => ({
        mission_id: mission.id,
        name: (t.name?.trim() || t.instagram || t.site || t.whatsapp || "Concorrente")!,
        instagram: t.instagram || null,
        site: t.site || null,
        whatsapp: t.whatsapp || null,
        category: t.category || null,
        status: "not_started" as const,
        canal_abordagem: canais.length > 0 ? canais.join(", ") : null,
      }));

    if (targets.length > 0) {
      const { error: tErr } = await supabaseAdmin.from("targets").insert(targets);
      if (tErr) throw tErr;
    }

    await supabaseAdmin.from("activity_logs").insert({
      mission_id: mission.id,
      user_id: context.userId,
      action: "mission_created",
      entity_type: "mission",
      entity_id: mission.id,
      details: { source: "briefing_chat", name: payload.title ?? null },
    });

    return {
      text: cleanText || "Missão criada com sucesso!",
      missionCreated: true as const,
      missionId: mission.id,
      scope,
      preview: {
        title: payload.title ?? null,
        description: payload.description ?? null,
        deadline: isValidDate(payload.deadline) ? payload.deadline : null,
        profundidade: payload.profundidade ?? null,
        cobertura_canais: payload.cobertura_canais ?? null,
        canais_obrigatorios: canais,
        targets: targets.map((t) => ({ name: t.name, instagram: t.instagram, site: t.site })),
        restricoes: payload.restricoes ?? null,
      },
    };
  });