import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLLM } from "@/lib/llm-router";
import { logServerActivity } from "@/lib/activity-log.server";

const ExtractInput = z.object({ versionId: z.string().uuid() });

const SYSTEM_PROMPT = `Você é um extrator estruturado de briefings de missão de inteligência de mercado.
Extraia do documento e retorne JSON com:
{ "mission_name": string, "objective": string, "segment": string,
  "targets": [{"name": string, "instagram": string, "whatsapp": string, "linkedin": string, "category": string}],
  "collection_blocks": { "A": string, "B": string, "C": string, "D": string, "E": string, "F": string, "G": string },
  "ethical_rules": string, "approach_type": string, "deadline_first": string, "deadline_final": string,
  "entregavel_esperado": string,
  "canais_obrigatorios": string[],
  "profundidade_autorizada": "observacao" | "contato" | "qualificacao" | "reuniao" | "contratacao" | "" }
O campo entregavel_esperado descreve o resultado final tangível que o cliente espera obter (ex: "proposta comercial recebida do concorrente", "tabela de preços", "deck de vendas"). Se o documento não descrever isso, retorne string vazia.

CANAIS DE ABORDAGEM (canais_obrigatorios): se o documento mencionar canais específicos de abordagem ou contato — WhatsApp, Instagram DM, Email, Site, LinkedIn, Ligação, Reunião online, Formulário — extraia a lista. Normalize para os valores exatos aceitos: "Instagram DM", "WhatsApp", "Email", "Site", "LinkedIn", "Ligação", "Reunião online", "Formulário". Se não houver menção clara a canais, retorne array vazio. NUNCA retorne "360" ou inferir cobertura total — apenas liste os canais explicitamente mencionados.

PROFUNDIDADE AUTORIZADA (profundidade_autorizada): identifique até onde o analista pode ir no funil do concorrente. "observacao" = apenas observar/monitorar sem contato. "contato" = primeiro contato/mensagem inicial. "qualificacao" = conversa qualificadora, perguntas de descoberta. "reuniao" = agendar/participar de reunião ou demo. "contratacao" = simular contratação real. Se ambíguo, retorne string vazia.

Retorne apenas o JSON válido, sem markdown, sem texto adicional.`;

async function extractTextFromBuffer(buf: ArrayBuffer, fileName: string): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }
  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
    return result.value;
  }
  throw new Error("Formato não suportado. Use PDF ou DOCX.");
}

function tryParseJson(raw: string): unknown {
  const trimmed = raw.trim();
  // strip markdown code fences if present
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    // try to find first {...} block
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Resposta da IA não é JSON válido");
  }
}

export const extractMissionDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ExtractInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: version, error: vErr } = await supabase
      .from("document_versions")
      .select("id, mission_id, file_url, file_name, status")
      .eq("id", data.versionId)
      .single();
    if (vErr || !version) throw new Error("Versão não encontrada");
    if (!version.file_url || !version.file_name) throw new Error("Arquivo ausente");
    if (version.status === "frozen")
      throw new Error("Versão já congelada não pode ser reprocessada");

    // download file from storage
    const { data: blob, error: dlErr } = await supabase.storage
      .from("mission-documents")
      .download(version.file_url);
    if (dlErr || !blob) throw new Error("Falha ao baixar arquivo do storage");

    const buf = await blob.arrayBuffer();
    const text = await extractTextFromBuffer(buf, version.file_name);
    const truncated = text.replace(/\x00/g, "").slice(0, 200_000);

    if (!truncated.trim()) {
      throw new Error("Documento sem conteúdo legível. Verifique se o arquivo não está corrompido.");
    }

    const { text: textBlock, provider, model } = await callLLM({
      task: "extraction",
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: truncated }],
      tracking: {
        userId: context.userId,
        missionId: version.mission_id,
        taskLabel: "document_extraction",
      },
    });
    console.log(`[extraction] used ${provider}/${model}`);
    const extracted = tryParseJson(textBlock);

    const { error: updErr } = await supabase
      .from("document_versions")
      .update({
        extracted_data: extracted as never,
        status: "reviewing",
      })
      .eq("id", data.versionId);
    if (updErr) throw updErr;

    await logServerActivity({
      userId: context.userId,
      missionId: version.mission_id,
      action: "document_extracted",
      entityType: "document_version",
      entityId: version.id,
      details: {
        file_name: version.file_name,
        provider,
        model,
        chars: truncated.length,
      },
    });

    return { ok: true } as const;
  });