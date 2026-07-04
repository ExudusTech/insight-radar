import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLLM, type LLMContentBlock, type LLMMessage } from "@/lib/llm-router";
import {
  BLOCK_FIELDS,
  BLOCK_FIELDS_CONDITIONAL,
  BLOCK_FIELDS_REQUIRED,
  BLOCK_TITLES,
  COLLECTION_BLOCKS,
  calcRequiredCompletion,
} from "@/lib/collection.queries";

// Best-effort server-side activity log. Uses admin client (RLS bypass) so we
// can attribute records to the authenticated user without needing a policy
// carve-out. Never throws — logging must not break the primary operation.
async function logAdminActivity(params: {
  userId: string;
  missionId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("activity_logs").insert({
      user_id: params.userId,
      mission_id: params.missionId ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      details: (params.details ?? {}) as never,
    });
  } catch (e) {
    console.warn("[activity_logs] insert failed", params.action, e);
  }
}

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

    const [
      { data: mission },
      { data: docs },
      { data: target },
      { data: filledRows },
      { data: lastTimeline },
      { data: priorMessages },
    ] = await Promise.all([
      supabase
        .from("missions")
        .select("name, objective, segment, canais_obrigatorios, entregavel_esperado")
        .eq("id", data.missionId)
        .single(),
      supabase
        .from("document_versions")
        .select("doc_type, doc_label, file_name, extracted_data")
        .eq("mission_id", data.missionId)
        .eq("status", "frozen"),
      supabase
        .from("targets")
        .select("name, brand, category, site, instagram, linkedin, whatsapp, email, canal_abordagem, persona_lead")
        .eq("id", data.targetId)
        .single(),
      supabase
        .from("collection_data")
        .select("block, field_key, field_value")
        .eq("target_id", data.targetId),
      supabase
        .from("target_timeline_events")
        .select("event_type, event_date, description")
        .eq("target_id", data.targetId)
        .order("event_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("assistant_messages")
        .select("role, content, created_at")
        .eq("target_id", data.targetId)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    if (!mission) throw new Error("Missão não encontrada");
    if (!target) throw new Error("Alvo não encontrado");

    // Compute filled fields and gaps
    const filled: Record<string, Set<string>> = {};
    for (const row of filledRows ?? []) {
      const v = row.field_value;
      const hasValue = v !== null && v !== undefined && String(v).trim() !== "" && String(v).trim() !== "null";
      if (!hasValue) continue;
      if (!filled[row.block]) filled[row.block] = new Set();
      filled[row.block].add(row.field_key);
    }
    const filledSummary: string[] = [];
    for (const blk of COLLECTION_BLOCKS) {
      const done = Array.from(filled[blk] ?? []);
      if (done.length > 0) {
        filledSummary.push(`${blk} (${BLOCK_TITLES[blk]}): ${done.join(", ")}`);
      }
    }
    const filledBlock = filledSummary.length > 0
      ? `\nJÁ COLETADO:\n${filledSummary.map((s) => `- ${s}`).join("\n")}`
      : "\nJÁ COLETADO: (nada ainda)";

    const completion = calcRequiredCompletion(filledRows ?? []);
    const gapsByBlock: string[] = [];
    for (const [blk, fields] of Object.entries(BLOCK_FIELDS_REQUIRED)) {
      if (fields.length === 0) continue;
      const missing = fields.filter((f) => !completion.filledByBlock[blk]?.has(f));
      if (missing.length > 0) {
        gapsByBlock.push(
          `  ${blk} (${BLOCK_TITLES[blk as keyof typeof BLOCK_TITLES]}): faltam → ${missing.map((f) => f.replace(/_/g, " ")).join(", ")}`,
        );
      }
    }
    const hasContact = (filled["B"]?.size ?? 0) > 0;
    const conditionalGaps: string[] = [];
    if (hasContact) {
      for (const [blk, fields] of Object.entries(BLOCK_FIELDS_CONDITIONAL)) {
        for (const f of fields) {
          if (!filled[blk]?.has(f)) {
            conditionalGaps.push(`- ${blk} (${BLOCK_TITLES[blk as keyof typeof BLOCK_TITLES]}): ${f.replace(/_/g, " ")}`);
          }
        }
      }
    }
    const gapsSummary = completion.readyForSynthesis
      ? `\n✅ CAMPOS OBRIGATÓRIOS COMPLETOS (${completion.filledRequired}/${completion.totalRequired}). Este concorrente está PRONTO PARA SÍNTESE. Ao final desta mensagem, informe a analista que pode digitar "síntese" para gerar o parecer final.`
      : `\nCOMPLETUDE: ${completion.percent}% dos campos obrigatórios preenchidos (${completion.filledRequired}/${completion.totalRequired}).

LACUNAS OBRIGATÓRIAS POR BLOCO:
${gapsByBlock.join("\n")}
${hasContact && conditionalGaps.length > 0 ? `\nLACUNAS CONDICIONAIS (${conditionalGaps.length} — só se o concorrente cooperar):\n${conditionalGaps.join("\n")}` : ""}

INSTRUÇÃO: Ao final desta resposta, diga explicitamente ao analista quais campos estão faltando e qual a próxima ação concreta para obtê-los. Use linguagem direta: "Para completar o Bloco B, preciso saber: [campo 1] e [campo 2]. Você tem essa informação ou consegue obtê-la?"`;

    const isResuming = data.conversationHistory.length > 0 && !data.userMessage && !data.imageBase64;

    // ---- CONTINUIDADE INTELIGENTE ----
    // Monta um bloco de contexto quando já houve trabalho anterior neste concorrente.
    const priorCount = (priorMessages ?? []).length;
    const hasPriorWork =
      priorCount > 0 || (filledRows ?? []).length > 0 || !!lastTimeline;
    const blocksWithData = COLLECTION_BLOCKS.filter((b) => (filled[b]?.size ?? 0) > 0);
    const missingRequiredFlat: string[] = [];
    for (const [blk, fields] of Object.entries(BLOCK_FIELDS_REQUIRED)) {
      for (const f of fields) {
        if (!completion.filledByBlock[blk]?.has(f)) {
          missingRequiredFlat.push(`${blk}.${f}`);
        }
      }
    }
    const last3 = (priorMessages ?? [])
      .slice(0, 3)
      .reverse()
      .map((m) => `  - [${m.role}] ${String(m.content ?? "").replace(/\s+/g, " ").slice(0, 180)}`)
      .join("\n");
    const entregavel = (mission as { entregavel_esperado?: string | null }).entregavel_esperado ?? "";
    const priorContextBlock = hasPriorWork
      ? `
CONTEXTO DO TRABALHO ANTERIOR NESTE CONCORRENTE:
- Blocos com dados: ${blocksWithData.length > 0 ? blocksWithData.join(", ") : "(nenhum)"}
- Último evento no timeline: ${
          lastTimeline
            ? `${lastTimeline.event_type} em ${new Date(lastTimeline.event_date).toLocaleDateString("pt-BR")}${lastTimeline.description ? ` — ${String(lastTimeline.description).slice(0, 160)}` : ""}`
            : "(nenhum)"
        }
- Últimas interações do chat (${priorCount} salvas):
${last3 || "  (sem histórico salvo)"}
- Campos obrigatórios ainda vazios: ${missingRequiredFlat.length > 0 ? missingRequiredFlat.join(", ") : "(nenhum)"}

Retome a conversa de forma natural. Não repita perguntas já respondidas. Priorize o que ainda falta para atingir o entregável esperado${entregavel ? `: ${entregavel}` : "."}
`
      : "";

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
${(() => {
  const ent = (mission as { entregavel_esperado?: string | null }).entregavel_esperado;
  return ent && ent.trim()
    ? `\nENTREGÁVEL ESPERADO DESTA MISSÃO: ${ent.trim()}\n\nConduza a conversa orientando a analista para que, ao final do trabalho com este concorrente, o entregável acima tenha sido obtido e documentado. Priorize as perguntas e orientações que levam ao entregável. Considere este concorrente como concluído somente quando o entregável tiver sido obtido e registrado (via evidência ou evento no Timeline).`
    : "";
})()}

BASE DE CONHECIMENTO (${frozenDocs.length} documentos):
${docsSection || "Nenhum documento congelado ainda."}

ALVO: ${target.name} ${target.brand ?? ""}
Categoria: ${target.category ?? "—"}
Site: ${target.site ?? "—"}
Instagram: ${target.instagram ?? "—"}
LinkedIn: ${target.linkedin ?? "—"}
WhatsApp: ${target.whatsapp ?? "—"}

ESTRATÉGIA DE ABORDAGEM DESTE CONCORRENTE:
${(() => {
  const canal = (target as { canal_abordagem?: string | null }).canal_abordagem;
  const obrig = (mission as { canais_obrigatorios?: string[] | null }).canais_obrigatorios;
  if (canal) {
    return `Canal designado: ${canal} — use EXCLUSIVAMENTE este canal para iniciar e, sempre que possível, manter o contato. Se o concorrente tentar migrar para outro canal, documente (canal_continuidade) mas não inicie contatos paralelos no canal original.`;
  }
  if (obrig && obrig.length > 0) {
    return `Canal não definido especificamente para este alvo. Canais obrigatórios da missão: ${obrig.join(", ")}. Use esses como referência ao orientar o analista, e registre por qual canal o concorrente respondeu (canal_entrada).`;
  }
  return "Canal não definido. Oriente o analista a identificar e registrar por qual canal o concorrente se expõe antes de iniciar a abordagem.";
})()}
${(() => {
  const p = (target as { persona_lead?: unknown }).persona_lead;
  if (!p || (typeof p === "object" && Object.keys(p as object).length === 0)) return "";
  const rendered = typeof p === "string" ? p : JSON.stringify(p, null, 2);
  return `Persona fictícia em uso: ${rendered} — mantenha consistência com esses dados em todas as interações com este concorrente.`;
})()}

ALERTA OPERACIONAL: O analista está abordando múltiplos concorrentes em paralelo. Manter canais e personas distintas por concorrente reduz o risco de exposição. Nunca use o mesmo número de WhatsApp ou perfil de Instagram para dois concorrentes diferentes.

BLOCOS E CAMPOS QUE VOCÊ DEVE PREENCHER (uma única conversa cobre TODOS):
${buildBlocksSchemaSection()}
${filledBlock}
${gapsSummary}
${priorContextBlock}
${isResuming ? `
MODO RETOMADA (o analista retomou a conversa sem nova mensagem):
Abra a resposta assim:
1) "Bem-vindo de volta! Aqui está o resumo do que já coletamos sobre ${target.name}:"
2) Liste os blocos com dados (ex.: "✅ A — Pesquisa pública: canal_principal, promessa, cta").
3) Liste os blocos incompletos com o que falta (ex.: "⚠️ C — Funil e oferta: faltam preco, garantia").
4) "Vamos continuar? **Próxima ação:** [instrução operacional para o campo pendente mais crítico]".
Não repita perguntas cujas respostas já estão em JÁ COLETADO.` : ""}

AO FINAL DE CADA RESPOSTA, OBRIGATORIAMENTE (antes do ---BLOCK_DATA---):
1. Liste o que foi extraído e salvo nesta mensagem (ex: "✅ Salvei: canal_principal, cta, resposta_tempo").
2. Liste por bloco o que ainda falta dos obrigatórios (ex: "📋 Bloco B ainda precisa de: abordagem").
3. Dê uma instrução direta e específica para o próximo passo.
4. Se um campo não pôde ser coletado porque o concorrente não respondeu ou não avançou no funil, registre como "não obtido — [motivo]" e informe o analista que esse dado ficará marcado assim.
- IMPORTANTE: campos condicionais (preço, materiais, follow-up) só solicite se o concorrente já tiver demonstrado engajamento. Se não houve resposta após 2+ tentativas, registre como "não obtido" e avance para os campos de experiência do lead, que a analista sempre pode preencher.
- Se todos os obrigatórios preenchidos: "✅ **Coleta suficiente para análise!** Todos os campos essenciais foram preenchidos. Digite 'síntese' para gerar o parecer — campos condicionais ainda em aberto serão registrados como 'dado não obtido' e isso é informação válida."
- NUNCA sugira uma nova rodada de tentativas de contato se o concorrente já ignorou 3+ interações. Registre como "sem resposta após múltiplas tentativas" e finalize o bloco B.

SÍNTESE FINAL:
Quando a analista pedir "síntese", "parecer", "resumo final", "finalizar" ou "gerar parecer":
1. Leia todos os dados coletados nos blocos A–G (usando JÁ COLETADO acima e o histórico da conversa).
2. Produza um parecer estruturado com as seções (use exatamente estes títulos em markdown):
   ## Perfil do Concorrente
   ## Estratégia de Captação (entrada do funil)
   ## Oferta e Precificação
   ## Qualidade do Atendimento
   ## Prova Social e Reputação
   ## Materiais e Sequência de Vendas
   ## Pontos Fortes
   ## Pontos Fracos e Oportunidades
3. Ao final pergunte: "Deseja salvar este parecer como documento da missão?"

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

TRANSCRIÇÃO DE REUNIÃO:
- Ao receber uma transcrição (colada pelo analista após uma call), identifique que é uma transcrição e trate com prioridade máxima.
- Mapeie cada fala do concorrente para os campos correspondentes (preço → C.preco, objeções → E.objecoes_tratadas, materiais enviados → F.materiais_descritos etc.)
- Registre o tom, velocidade de resposta, e linguagem usada como dado do bloco E (qualidade do atendimento).
- Se o analista mencionar que obteve consentimento para gravar/transcrever, registre como evidência de metodologia válida.
- Se a transcrição revelar que o concorrente usa um script padronizado, identifique o padrão e documente em B.script_inicial.
- Ao final do processamento da transcrição, informe quantos campos foram preenchidos e quais lacunas obrigatórias ainda restam.

BLOCO B — ABORDAGEM DE CONTATO:
Além do tempo de resposta e tom, registre sempre:
- canal_entrada: por onde o lead iniciou o contato (ex: "Instagram DM", "WhatsApp", "LinkedIn")
- canal_continuidade: para onde o concorrente tentou mover a conversa (ex: "manteve no Instagram DM", "enviou link de WhatsApp", "pediu para preencher formulário em link", "redirecionou para bot no WhatsApp")
- tipo_continuidade: classifique como "humano", "bot/assistente virtual", "formulário", "landing page", ou "ligação"
- coerencia_canal: avalie se o concorrente respeitou o canal de preferência do lead — "sim" (manteve), "parcial" (migrou mas com justificativa natural), "não" (abandonou o canal sem considerar a preferência do lead)

Esse padrão é um sinal estratégico: concorrentes que forçam migração de canal criam fricção e isso pode ser uma oportunidade para o cliente do Radar.

PREENCHIMENTO AUTOMÁTICO DOS CAMPOS — REGRA OBRIGATÓRIA (SEM EXCEÇÃO):
- TODA E QUALQUER resposta sua DEVE terminar com o marcador exato \`---BLOCK_DATA---\` em uma nova linha, seguido por um JSON puro (sem cercas de código nem comentários). Isso vale inclusive para a mensagem de boas-vindas, instruções operacionais, confirmações e a mensagem final de conclusão.
- Formato exato quando houver dados novos identificados NESTA resposta:
  ---BLOCK_DATA---
  {"A": {"canal_principal": "Instagram"}, "C": {"preco": "R$ 497/mês"}}
- Formato exato quando NÃO houver campos novos a registrar nesta resposta:
  ---BLOCK_DATA---
  {}
- Use APENAS os campos definidos na lista de blocos acima. Só preencha quando tiver evidência concreta já presente na conversa (texto, print, relato). Nunca invente valores.
- Preencha incrementalmente: a cada resposta, extraia TODOS os campos novos que a última mensagem da analista permitiu inferir — não guarde para o final da pesquisa.
- O JSON NUNCA deve aparecer na parte visível da mensagem. Ele fica SOMENTE após o marcador \`---BLOCK_DATA---\`, que é sempre a última linha da resposta.`;

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
      tracking: {
        userId: context.userId,
        missionId: data.missionId,
        targetId: data.targetId,
        taskLabel: "assistant",
      },
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
      else {
        void logAdminActivity({
          userId: context.userId,
          missionId: data.missionId,
          action: "assistant_message_sent",
          entityType: "target",
          entityId: data.targetId,
          details: { chars: cleanMessage.length, provider, model: usedModel },
        });
      }
    } catch (e) {
      console.warn("[assistant] persist error", e);
    }

    // Detecção leve de evento de timeline a partir da mensagem do analista.
    let timelineEventDetected = false;
    const userMsgText = (data.userMessage ?? "").trim();
    if (userMsgText.length > 0) {
      try {
        const eventPrompt = `Analise esta mensagem de um analista de mystery shopping e identifique se ela descreve um evento concreto que aconteceu na jornada com o concorrente.

Mensagem: "${userMsgText.slice(0, 4000)}"

Eventos possíveis:
- contato_inicial: analista enviou o primeiro contato (DM, email, WhatsApp, ligação inicial)
- resposta_recebida: o concorrente respondeu ao contato
- reuniao_agendada: uma call ou reunião foi agendada
- reuniao_realizada: a call ou reunião aconteceu de fato
- proposta_recebida: o concorrente enviou proposta comercial, preço ou apresentação
- follow_up_recebido: o concorrente fez follow-up espontâneo
- negociacao: houve negociação de preço ou condições
- encerramento: interação foi concluída (comprou, recusou, foi ignorada)
- outro: outro evento relevante da jornada

Responda APENAS com JSON válido, sem markdown:
- Se houver evento: {"detected": true, "event_type": "<tipo>", "description": "<resumo em 1 frase do que aconteceu>", "event_date": "<YYYY-MM-DD se mencionado, senão null>"}
- Se não houver evento concreto: {"detected": false}`;

        const { text: evtRaw } = await callLLM({
          task: "classify",
          systemPrompt: "Você é um classificador rigoroso. Responde somente JSON.",
          messages: [{ role: "user", content: eventPrompt }],
          maxTokens: 200,
          tracking: {
            userId: context.userId,
            missionId: data.missionId,
            targetId: data.targetId,
            taskLabel: "timeline_event_detection",
          },
        });
        const jsonMatch = evtRaw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as {
            detected?: boolean;
            event_type?: string;
            description?: string;
            event_date?: string | null;
          };
          const ALLOWED = new Set([
            "contato_inicial","resposta_recebida","reuniao_agendada","reuniao_realizada",
            "proposta_recebida","follow_up_recebido","negociacao","encerramento","outro",
          ]);
          if (
            parsed.detected &&
            parsed.event_type &&
            ALLOWED.has(parsed.event_type) &&
            parsed.description &&
            parsed.description.trim().length > 0
          ) {
            const eventDate =
              parsed.event_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.event_date)
                ? parsed.event_date
                : new Date().toISOString().slice(0, 10);
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { error: evtErr } = await supabaseAdmin
              .from("target_timeline_events")
              .insert({
                target_id: data.targetId,
                mission_id: data.missionId,
                event_type: parsed.event_type,
                description: parsed.description.slice(0, 1000),
                event_date: eventDate,
                source: "ai",
                created_by: context.userId,
              });
            if (evtErr) {
              console.warn("[assistant] timeline insert failed", evtErr);
            } else {
              timelineEventDetected = true;
              void logAdminActivity({
                userId: context.userId,
                missionId: data.missionId,
                action: "timeline_event_created",
                entityType: "target",
                entityId: data.targetId,
                details: {
                  event_type: parsed.event_type,
                  event_date: eventDate,
                  source: "ai",
                },
              });
            }
          }
        }
      } catch (e) {
        console.warn("[assistant] timeline event detection failed", e);
      }
    }

    return { message: cleanMessage, blockUpdates, timelineEventDetected };
  });

const ProcessInputSchema = z.object({
  missionId: z.string().uuid(),
  targetId: z.string().uuid(),
  analystId: z.string().uuid(),
});

function buildBlocksSchemaSectionForExtraction() {
  return COLLECTION_BLOCKS.map(
    (b) => `${b} (${BLOCK_TITLES[b]}): ${BLOCK_FIELDS[b].join(", ")}`,
  ).join("\n");
}

function cleanHistoryContent(role: string, content: string, hasImage: boolean) {
  const withoutMarker = (() => {
    if (role !== "assistant") return content;
    const markerIdx = content.lastIndexOf("---BLOCK_DATA---");
    return markerIdx !== -1 ? content.slice(0, markerIdx).trim() : content;
  })();
  if (!hasImage) return withoutMarker;
  const imageNote = "[ANALISTA enviou uma imagem neste ponto — considerar como evidência visual associada à mensagem.]";
  if (!withoutMarker.trim() || withoutMarker.trim() === "[imagem]") return imageNote;
  return `${withoutMarker}\n${imageNote}`;
}

async function loadHistoryImages(
  messages: Array<{ role: string; content: string; metadata: Record<string, unknown> | null }>,
) {
  const imageMessages = messages.filter((m) => typeof m.metadata?.image_path === "string");
  if (imageMessages.length === 0) return [] as LLMContentBlock[];

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const blocks: LLMContentBlock[] = [];

  for (const [idx, message] of imageMessages.slice(0, 6).entries()) {
    const imagePath = String(message.metadata?.image_path ?? "");
    const imageMime = String(message.metadata?.image_mime ?? "image/jpeg");
    try {
      const { data, error } = await supabaseAdmin.storage
        .from("mission-evidences")
        .createSignedUrl(imagePath, 60);
      if (error || !data?.signedUrl) {
        console.warn("[processHistory] signed URL failed", imagePath, error);
        continue;
      }

      const res = await fetch(data.signedUrl);
      if (!res.ok) {
        console.warn("[processHistory] image fetch failed", imagePath, res.status);
        continue;
      }

      const bytes = new Uint8Array(await res.arrayBuffer());
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      blocks.push({
        type: "text",
        text: `\n\n[IMAGEM ${idx + 1} enviada pela analista no histórico. Mensagem associada: ${String(message.content ?? "").slice(0, 500)}]`,
      });
      blocks.push({ type: "image_base64", mediaType: imageMime, data: btoa(binary) });
    } catch (e) {
      console.warn("[processHistory] image load failed", imagePath, e);
    }
  }

  return blocks;
}

function sanitizeBlockUpdates(
  raw: unknown,
): Record<string, Record<string, string>> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, Record<string, string>> = {};
  for (const [blk, fields] of Object.entries(raw as Record<string, unknown>)) {
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
  return Object.keys(out).length > 0 ? out : null;
}

export const processAssistantHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ProcessInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.analystId !== context.userId) {
      throw new Error("analystId não corresponde ao usuário autenticado");
    }

    const [{ data: messages }, { data: target }] = await Promise.all([
      supabase
        .from("assistant_messages")
        .select("role, content, metadata")
        .eq("target_id", data.targetId)
        .order("created_at", { ascending: true }),
      supabase
        .from("targets")
        .select("name")
        .eq("id", data.targetId)
        .single(),
    ]);

    if (!messages || messages.length === 0) {
      console.log("[processHistory] no messages for target", data.targetId);
      return { blockUpdates: null };
    }

    const targetName = target?.name ?? "alvo";

    const extractionPrompt = `Você é um extrator de inteligência. Analise a conversa abaixo entre analista e assistente de pesquisa sobre o alvo "${targetName}" e extraia TODOS os dados que já foram mencionados.

CAMPOS A PREENCHER (use APENAS estas chaves exatas):
${buildBlocksSchemaSectionForExtraction()}

REGRAS:
- Retorne APENAS um JSON puro (sem cercas de código, sem texto antes ou depois).
- Analise TODA a conversa e extraia qualquer informação relevante sobre o alvo, mesmo que parcial.
- Seja generoso na interpretação: se a analista mencionou algo sobre preço, canal, atendimento, materiais, prova social, oferta ou posicionamento, mesmo de forma indireta, extraia.
- Prefira ter mais campos com dados parciais do que poucos campos "perfeitos".
- Use apenas evidências concretas presentes na conversa e nas imagens anexadas — não invente.
- Se um campo não puder ser inferido com segurança, omita-o.
- Use somente os blocos (A–G) e chaves listados acima.

Exemplo do formato esperado:
{"A": {"canal_principal": "Instagram", "seguidores": "12k"}, "C": {"preco": "R$ 497"}}`;

    const conversationText = messages
      .map((m) => {
        const hasImage = typeof (m.metadata as Record<string, unknown> | null)?.image_path === "string";
        return `${m.role === "user" ? "ANALISTA" : "ASSISTENTE"}: ${cleanHistoryContent(m.role, m.content, hasImage)}`;
      })
      .join("\n\n")
      .slice(0, 60_000);

    const imageBlocks = await loadHistoryImages(
      messages.map((m) => ({
        role: m.role,
        content: m.content,
        metadata: (m.metadata ?? null) as Record<string, unknown> | null,
      })),
    );
    console.log("[processHistory] messages:", messages.length, "images loaded:", imageBlocks.filter((b) => b.type === "image_base64").length);

    const extractionContent: string | LLMContentBlock[] = imageBlocks.length > 0
      ? [{ type: "text", text: conversationText }, ...imageBlocks]
      : conversationText;

    const { text } = await callLLM({
      task: "assistant",
      systemPrompt: extractionPrompt,
      messages: [{ role: "user", content: extractionContent }],
      maxTokens: 2048,
      tracking: {
        userId: context.userId,
        targetId: data.targetId,
        taskLabel: "extraction",
      },
    });
    console.log("[processHistory] LLM raw response (first 500):", text.slice(0, 500));

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text.trim());
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          /* ignore */
        }
      }
    }

    const clean = sanitizeBlockUpdates(parsed);
    console.log(
      "[processHistory] parsed keys:",
      parsed && typeof parsed === "object" ? Object.keys(parsed as object) : null,
      "sanitized blocks:",
      clean ? Object.keys(clean) : null,
    );
    return { blockUpdates: clean };
  });

// ============================================================
// Task 4 — Síntese final por concorrente (competitor brief)
// ============================================================

const BriefInputSchema = z.object({
  missionId: z.string().uuid(),
  targetId: z.string().uuid(),
});

function buildCollectedContext(
  rows: Array<{ block: string; field_key: string; field_value: unknown }>,
) {
  const grouped: Record<string, Record<string, string>> = {};
  for (const r of rows) {
    const v = r.field_value;
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (!s || s === "null") continue;
    if (!grouped[r.block]) grouped[r.block] = {};
    grouped[r.block][r.field_key] = s;
  }
  return COLLECTION_BLOCKS.map((b) => {
    const fields = grouped[b] ?? {};
    const lines = Object.entries(fields)
      .filter(([k]) => k !== "notes" && k !== "block_status")
      .map(([k, v]) => `- ${k}: ${v}`);
    return `### Bloco ${b} — ${BLOCK_TITLES[b]}\n${lines.length ? lines.join("\n") : "(sem dados)"}${fields.notes ? `\nNotas: ${fields.notes}` : ""}`;
  }).join("\n\n");
}

export const generateCompetitorBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => BriefInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: target }, { data: mission }, { data: rows }] = await Promise.all([
      supabase.from("targets").select("name, brand, category, canal_abordagem").eq("id", data.targetId).single(),
      supabase.from("missions").select("name, objective, segment, canais_obrigatorios").eq("id", data.missionId).single(),
      supabase
        .from("collection_data")
        .select("block, field_key, field_value")
        .eq("target_id", data.targetId),
    ]);
    if (!target) throw new Error("Alvo não encontrado");
    if (!mission) throw new Error("Missão não encontrada");

    const canalTarget = (target as { canal_abordagem?: string | null }).canal_abordagem;
    const canaisMissao = (mission as { canais_obrigatorios?: string[] | null }).canais_obrigatorios;
    if (!canalTarget && !(canaisMissao && canaisMissao.length > 0)) {
      throw new Error(
        "Não é possível gerar o parecer: canal de abordagem não definido para este alvo e nenhum canal obrigatório configurado na missão.",
      );
    }

    const ctx = buildCollectedContext(rows ?? []);
    const systemPrompt = `Você é um analista sênior de inteligência competitiva. Produza um parecer executivo em português brasileiro, direto e acionável, usando APENAS os dados coletados abaixo.

MISSÃO: ${mission.name} — Objetivo: ${mission.objective ?? "—"} — Segmento: ${mission.segment ?? "—"}
ALVO: ${target.name} ${target.brand ?? ""} (${target.category ?? "—"})

DADOS COLETADOS:
${ctx}

Formato de saída (markdown, use exatamente estes títulos):
## Perfil do Concorrente
## Estratégia de Captação (entrada do funil)
## Oferta e Precificação
## Qualidade do Atendimento
## Prova Social e Reputação
## Materiais e Sequência de Vendas
## Pontos Fortes
## Pontos Fracos e Oportunidades`;

    const { text } = await callLLM({
      task: "report",
      systemPrompt,
      messages: [{ role: "user", content: `Gere o parecer final sobre ${target.name}.` }],
      maxTokens: 4096,
      tracking: {
        userId: context.userId,
        missionId: data.missionId,
        targetId: data.targetId,
        taskLabel: "competitor_brief",
      },
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: last } = await supabaseAdmin
      .from("document_versions")
      .select("version_number")
      .eq("mission_id", data.missionId)
      .eq("doc_type", "competitor_brief")
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (last?.version_number ?? 0) + 1;

    const { data: inserted, error } = await supabaseAdmin
      .from("document_versions")
      .insert({
        mission_id: data.missionId,
        doc_type: "competitor_brief",
        doc_label: `Parecer — ${target.name}`,
        file_name: `parecer-${target.name.replace(/\s+/g, "-").toLowerCase()}.md`,
        version_number: nextVersion,
        author_id: context.userId,
        extracted_data: { target_id: data.targetId, target_name: target.name, content: text },
      })
      .select("id")
      .single();
    if (error) throw error;
    return { documentId: inserted.id, content: text };
  });

// ============================================================
// Task 5 — Motor de consulta ("Comparativo")
// ============================================================

const QueryInputSchema = z.object({
  missionId: z.string().uuid(),
  question: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(10_000) }))
    .max(40)
    .optional(),
});

export const queryMissionIntelligence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => QueryInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [
      { data: mission },
      { data: targets },
      { data: rows },
      { data: timelineRows },
      { data: briefDocs },
    ] = await Promise.all([
      supabase.from("missions").select("name, objective, segment, status").eq("id", data.missionId).single(),
      supabase.from("targets").select("id, name, brand, category").eq("mission_id", data.missionId),
      supabase
        .from("collection_data")
        .select("target_id, block, field_key, field_value")
        .eq("mission_id", data.missionId),
      supabase
        .from("target_timeline_events")
        .select("target_id, event_type, event_date, description")
        .eq("mission_id", data.missionId)
        .order("event_date", { ascending: true }),
      supabase
        .from("document_versions")
        .select("doc_type, doc_label, extracted_data, version_number")
        .eq("mission_id", data.missionId)
        .eq("doc_type", "competitor_brief")
        .order("version_number", { ascending: false }),
    ]);
    if (!mission) throw new Error("Missão não encontrada");

    const byTarget: Record<string, Array<{ block: string; field_key: string; field_value: unknown }>> = {};
    for (const r of rows ?? []) {
      if (!r.target_id) continue;
      (byTarget[r.target_id] ??= []).push(r);
    }
    const timelineByTarget: Record<string, Array<{ event_type: string; event_date: string; description: string | null }>> = {};
    for (const ev of timelineRows ?? []) {
      if (!ev.target_id) continue;
      (timelineByTarget[ev.target_id] ??= []).push({
        event_type: ev.event_type,
        event_date: ev.event_date,
        description: ev.description,
      });
    }
    // Only the most recent brief per target (docs already sorted desc).
    const briefByTarget: Record<string, string> = {};
    for (const d of briefDocs ?? []) {
      const ext = (d.extracted_data ?? {}) as { target_id?: string; content?: string };
      if (ext.target_id && ext.content && !briefByTarget[ext.target_id]) {
        briefByTarget[ext.target_id] = ext.content;
      }
    }
    const targetSections = (targets ?? []).map((t) => {
      const ctx = buildCollectedContext(byTarget[t.id] ?? []);
      const events = timelineByTarget[t.id] ?? [];
      const timelineText = events.length
        ? events
            .map(
              (e) =>
                `- ${new Date(e.event_date).toLocaleDateString("pt-BR")} — ${e.event_type}${e.description ? `: ${String(e.description).slice(0, 200)}` : ""}`,
            )
            .join("\n")
        : "(sem eventos registrados)";
      const brief = briefByTarget[t.id];
      const briefText = brief ? `\n### Parecer individual\n${brief}` : "";
      return `## ${t.name}${t.brand ? ` (${t.brand})` : ""}\n${ctx}\n\n### Timeline\n${timelineText}${briefText}`;
    }).join("\n\n---\n\n");

    const missionStatus = (mission as { status?: string }).status ?? "";
    const deliveredNote = missionStatus === "delivered"
      ? "\nA missão foi ENTREGUE. Responda como consultor do cliente, usando linguagem executiva."
      : "";

    const systemPrompt = `Você é um analista sênior de inteligência competitiva. Responda perguntas comparativas usando APENAS os dados coletados da missão "${mission.name}" abaixo. Seja específico, cite os concorrentes por nome e a fonte do dado (bloco ou evento do timeline), e admita quando não houver dado suficiente.${deliveredNote}

DADOS DA MISSÃO (blocos coletados, timeline e pareceres individuais):
${targetSections || "(nenhum dado coletado ainda)"}
`;

    const messages: LLMMessage[] = [
      ...((data.history ?? []).map((m) => ({ role: m.role, content: m.content })) as LLMMessage[]),
      { role: "user", content: data.question },
    ];

    const { text } = await callLLM({
      task: "report",
      systemPrompt,
      messages,
      maxTokens: 2048,
      tracking: {
        userId: context.userId,
        missionId: data.missionId,
        taskLabel: "comparative",
      },
    });
    return { answer: text };
  });

// ============================================================
// Task 6 — Roteiro de reunião online (meeting script)
// ============================================================

const MeetingScriptInputSchema = z.object({
  missionId: z.string().uuid(),
  targetId: z.string().uuid(),
});

export const generateMeetingScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => MeetingScriptInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [{ data: target }, { data: rows }] = await Promise.all([
      supabase
        .from("targets")
        .select("name, brand, category, canal_abordagem, persona_lead")
        .eq("id", data.targetId)
        .single(),
      supabase
        .from("collection_data")
        .select("block, field_key, field_value")
        .eq("target_id", data.targetId),
    ]);
    if (!target) throw new Error("Alvo não encontrado");

    const allRows = rows ?? [];
    const completion = calcRequiredCompletion(allRows);
    const collected = allRows
      .filter((r) => {
        const v = r.field_value;
        return v !== null && v !== undefined && String(v).trim() !== "" && String(v).trim() !== "null";
      })
      .map((r) => `${r.block}.${r.field_key}: ${r.field_value}`)
      .join("\n");

    const missingRequiredText = completion.missingRequired.map((g) => `- ${g}`).join("\n") ||
      "Nenhuma — coleta suficiente para síntese";
    const conditionalText = Object.entries(BLOCK_FIELDS_CONDITIONAL)
      .flatMap(([b, fs]) => fs.map((f) => `${b}.${f}`))
      .join(", ");

    const prompt = `Você é um estrategista de inteligência competitiva. Com base nas informações já coletadas sobre o concorrente, gere um roteiro estruturado para uma reunião/call de vendas conduzida por um analista disfarçado de lead.

CONCORRENTE: ${target.name} ${target.brand ?? ""}
PERSONA DO ANALISTA: ${JSON.stringify(target.persona_lead ?? {})}
CANAL DE ABORDAGEM: ${target.canal_abordagem ?? "não definido"}

JÁ COLETADO:
${collected || "(nenhum dado coletado ainda)"}

LACUNAS OBRIGATÓRIAS AINDA PENDENTES:
${missingRequiredText}

LACUNAS CONDICIONAIS (tentar obter naturalmente se o concorrente colaborar):
${conditionalText}

---

Gere um roteiro com as seguintes seções:

## 🎯 Objetivo da reunião
[O que o analista deve extrair nessa call com base nos gaps]

## 🧊 Quebra-gelo e contextualização
[Como abrir a conversa de forma natural dentro da persona]

## ❓ Perguntas para preencher lacunas obrigatórias
[Lista de perguntas diretas mas naturais para cada gap obrigatório pendente]

## 💬 Assuntos para provocar naturalmente
[Tópicos que induzem o concorrente a revelar informações condicionais (preço, processo, materiais) sem perguntar diretamente]

## 🎙️ Protocolo de transcrição (IMPORTANTE — ler antes da call)
- Ao iniciar a call, o analista deve dizer: "Você se importa se eu usar o TacTiq para transcrever a reunião? Isso me ajuda a não precisar tomar notas enquanto conversamos."
- Se o concorrente disser que já grava/transcreve por conta própria: "Ótimo! Você poderia me enviar a transcrição depois? Fica mais fácil para eu revisar os pontos que discutirmos."
- Se o concorrente recusar ambos: conduzir normalmente e tomar notas no sistema imediatamente após a call.

## 🚩 Sinais a observar
[Comportamentos, hesitações, scripts, gatilhos de urgência ou escassez que o analista deve documentar]

## ✅ Checklist pós-call
[O que o analista deve registrar no sistema imediatamente após encerrar a reunião]`;

    const { text: scriptContent } = await callLLM({
      task: "assistant",
      systemPrompt: "Você é um estrategista sênior de inteligência competitiva especializado em mystery shopping B2B.",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 3072,
      tracking: {
        userId: context.userId,
        missionId: data.missionId,
        targetId: data.targetId,
        taskLabel: "meeting_script",
      },
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: last } = await supabaseAdmin
      .from("document_versions")
      .select("version_number")
      .eq("mission_id", data.missionId)
      .eq("doc_type", "meeting_script")
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (last?.version_number ?? 0) + 1;

    const { data: inserted, error } = await supabaseAdmin
      .from("document_versions")
      .insert({
        mission_id: data.missionId,
        doc_type: "meeting_script",
        doc_label: `Roteiro de reunião — ${target.name}`,
        file_name: `roteiro-reuniao-${target.name.replace(/\s+/g, "-").toLowerCase()}-v${nextVersion}.md`,
        version_number: nextVersion,
        author_id: context.userId,
        extracted_data: { target_id: data.targetId, target_name: target.name, content: scriptContent },
      })
      .select("id")
      .single();
    if (error) throw error;

    // Persist as assistant message so it appears in the chat thread
    const chatContent = `[ROTEIRO DE REUNIÃO]\n\n${scriptContent}`;
    const { error: msgErr } = await supabaseAdmin.from("assistant_messages").insert({
      mission_id: data.missionId,
      target_id: data.targetId,
      block: "all",
      analyst_id: context.userId,
      role: "assistant",
      content: chatContent,
    });
    if (msgErr) console.warn("[meetingScript] failed to persist chat message", msgErr);

    return { script: scriptContent, documentId: inserted.id };
  });