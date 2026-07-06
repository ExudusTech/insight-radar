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
  existingMissionId: z.string().uuid().optional(),
  extractedContext: z.string().trim().min(1).optional(),
});

const SYSTEM_PROMPT = `Você é um assistente especializado em criação de missões de inteligência competitiva para o Radar de Mercado IA.

Seu objetivo é conduzir uma conversa NATURAL e objetiva para entender o escopo da pesquisa e ao final criar a missão no sistema. NUNCA liste todas as perguntas de uma vez.

FLUXO DA CONVERSA (uma pergunta por vez, adaptando-se às respostas):
0. **PRIMEIRA MENSAGEM SEMPRE**: antes de qualquer outra pergunta, pergunte se o cliente tem um documento de briefing para anexar. Use uma frase como: "Antes de começarmos: você tem algum **documento de briefing** (PDF ou DOCX) para me enviar? Se sim, clique no ícone de clipe abaixo do chat para anexar — eu leio e extraio as informações automaticamente. Se preferir, podemos começar com perguntas mesmo — é só me dizer." NÃO faça outras perguntas nesta primeira mensagem.
   - Se o usuário disser que NÃO tem documento (ou responder qualquer coisa que não seja anexar), siga para a pergunta 1.
   - Se o usuário anexar um documento, você receberá o conteúdo extraído como contexto de sistema. Nesse caso, siga a **ORDEM PÓS-EXTRAÇÃO** obrigatória (ver abaixo). Não repita todas as perguntas — apenas peça complemento dos campos que ficaram em branco, respeitando a ordem definida.
1. Objetivo principal da pesquisa (ex: entender precificação, mapear funil de vendas, identificar diferenciais, visão 360°).
2. Lista de concorrentes a mapear (aceite nomes, @Instagram, sites, WhatsApp — qualquer identificador). Uma missão pode ter de 1 a 20 concorrentes.
3. Canal de abordagem (SEMPRE perguntar explicitamente ao cliente — nunca inferir do documento): "Por qual canal você quer que o analista **inicie o contato ativo** com cada concorrente? Pode indicar 1 ou mais." Opções sugeridas: Instagram DM, WhatsApp, Site — formulário, LinkedIn, E-mail, Ligação, Reunião online. **Nunca ofereça "Cobertura 360°" por padrão.** Só use "360" se o cliente pedir EXPLICITAMENTE para explorar todos os canais disponíveis do concorrente; caso contrário, use "selecionado" com a lista informada pelo cliente.
4. Profundidade autorizada:
   - Apenas observação (conteúdo público, sem contato)
   - Primeiro contato (DM/WhatsApp inicial, sem avançar)
   - Qualificação (avançar no funil, receber propostas)
   - Reunião (agendar calls, sem contratação)
   - Contratação real (cliente autoriza pagar pelo serviço para experiência completa)
5. Prazo — data limite para entrega.
6. Restrições — algo que o analista não deve fazer ou prioridade absoluta.
7. Entregável esperado — pergunte de forma direta: "Para garantir que a equipe de analistas entregue exatamente o que você precisa: **qual é o entregável principal desta missão?** Por exemplo: proposta comercial recebida do concorrente, tabela de preços, deck de vendas, roteiro de atendimento documentado, ou outro?" Aceite descrições livres.

DISTINÇÃO OBRIGATÓRIA ENTRE CANAIS:
- **Canal de exposição** (onde o concorrente aparece publicamente — Instagram, site, YouTube, blog etc.): serve apenas para observação. O analista coleta prints e a IA interpreta. **Não precisa ser definido no briefing** e **não vai** para \`canais_obrigatorios\`.
- **Canal de abordagem** (onde o analista **inicia contato ativo** com o concorrente — DM, WhatsApp, e-mail, formulário, ligação etc.): **DEVE** ser definido explicitamente pelo cliente. Mesmo que o documento liste WhatsApp/Instagram/Email como canais de evidência, presença ou deliverables, **NUNCA** assuma isso como canal de abordagem. Sempre pergunte. A resposta do cliente é o que vai para \`canais_obrigatorios\` e será usada pela IA do analista para orientar a abordagem.

ORDEM PÓS-EXTRAÇÃO DE DOCUMENTO (obrigatória, uma etapa por vez):
1. Apresente um RESUMO ESTRUTURADO em markdown do que foi extraído (concorrentes, objetivo, profundidade se houver, entregável se houver, prazo, restrições). **Não inclua canal de abordagem no resumo mesmo que o documento mencione canais** — deixe isso para a pergunta da etapa 2.
2. IMEDIATAMENTE em seguida, na MESMA mensagem, pergunte SEMPRE sobre o **canal de abordagem** (obrigatório, independentemente do que o documento diga). Se o prazo extraído for anterior à data atual, pergunte também: "O prazo encontrado no documento já passou. Qual é o novo prazo para entrega?"
3. Após a resposta, pergunte sobre quaisquer campos ainda ausentes: profundidade autorizada e/ou entregável esperado.
4. Só depois de ter TODAS as respostas (canal de abordagem confirmado pelo cliente + profundidade + entregável + prazo válido), apresente o escopo completo em markdown e peça a confirmação final: "Posso criar a missão com estas configurações?"

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
- Ao interpretar datas mencionadas pelo cliente sem ano explícito (ex: "17 de julho", "próxima sexta"), sempre assuma o ano 2026. Nunca assuma ano anterior ao atual (2026). Se a data resultante com ano 2026 ainda estiver no passado, pergunte ao cliente para confirmar o ano.
- **NUNCA** preencha \`canais_obrigatorios\` ou \`cobertura_canais\` com base no documento. Só preencha depois que o cliente responder explicitamente à pergunta de canal de abordagem.
- \`cobertura_canais\` só pode ser "360" se o cliente pedir explicitamente para explorar todos os canais do concorrente. Padrão: "selecionado".
- Se o prazo extraído for anterior a hoje, trate como vazio e peça um novo prazo antes do resumo final.
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

    // If updating an existing draft, validate the user owns it.
    if (data.existingMissionId) {
      const { data: m, error } = await context.supabase
        .from("missions")
        .select("id, contractor_id")
        .eq("id", data.existingMissionId)
        .maybeSingle();
      if (error || !m) throw new Error("Missão não encontrada");
      if (!isSuperadmin && m.contractor_id !== context.userId) {
        throw new Error("Sem permissão para editar esta missão");
      }
    }

    const systemPrompt = data.extractedContext
      ? `${SYSTEM_PROMPT}\n\nCONTEXTO JÁ EXTRAÍDO DE UM DOCUMENTO ENVIADO PELO CLIENTE (use isto como base, valide com o cliente, e complete os campos ausentes antes de emitir o bloco CRIAR_MISSAO):\n${data.extractedContext}`
      : SYSTEM_PROMPT;

    const { text } = await callLLM({
      task: "assistant",
      systemPrompt,
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

    // Update existing draft mission instead of creating a new one.
    if (data.existingMissionId) {
      const updates: {
        name?: string;
        description?: string | null;
        objective?: string | null;
        deadline_final?: string | null;
        profundidade_autorizada?: string;
        cobertura_canais?: string;
        canais_obrigatorios?: string[];
        restricoes?: string | null;
        entregavel_esperado?: string;
      } = {};
      if (payload.title?.trim()) updates.name = payload.title.trim();
      if (payload.description !== undefined) {
        updates.description = payload.description ?? null;
        updates.objective = payload.description ?? null;
      }
      if (isValidDate(payload.deadline)) updates.deadline_final = payload.deadline;
      if (payload.profundidade) updates.profundidade_autorizada = payload.profundidade;
      if (payload.cobertura_canais) updates.cobertura_canais = payload.cobertura_canais;
      if (canais.length > 0) updates.canais_obrigatorios = canais;
      if (payload.restricoes !== undefined) updates.restricoes = payload.restricoes ?? null;
      if (payload.entregavel_esperado?.trim()) updates.entregavel_esperado = payload.entregavel_esperado.trim();

      if (Object.keys(updates).length > 0) {
        const { error: uErr } = await supabaseAdmin
          .from("missions")
          .update(updates)
          .eq("id", data.existingMissionId);
        if (uErr) throw uErr;
      }

      await supabaseAdmin.from("activity_logs").insert({
        mission_id: data.existingMissionId,
        user_id: context.userId,
        action: "mission_updated",
        entity_type: "mission",
        entity_id: data.existingMissionId,
        details: { source: "briefing_chat_post_upload", fields: Object.keys(updates) },
      });

      await saveBriefingMessages(supabaseAdmin, data.existingMissionId, context.userId, data.messages);

      return {
        text: cleanText || "Missão atualizada com sucesso!",
        missionCreated: true as const,
        missionId: data.existingMissionId,
        scope,
        preview: {
          title: payload.title ?? null,
          description: payload.description ?? null,
          deadline: isValidDate(payload.deadline) ? payload.deadline : null,
          profundidade: payload.profundidade ?? null,
          cobertura_canais: payload.cobertura_canais ?? null,
          canais_obrigatorios: canais,
          targets: [],
          restricoes: payload.restricoes ?? null,
        },
      };
    }

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

    await saveBriefingMessages(supabaseAdmin, mission.id, context.userId, data.messages);

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