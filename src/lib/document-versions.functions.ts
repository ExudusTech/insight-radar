import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ExtractInput = z.object({ versionId: z.string().uuid() });

const SYSTEM_PROMPT = `Você é um extrator estruturado de briefings de missão de inteligência de mercado.
Extraia do documento e retorne JSON com:
{ "mission_name": string, "objective": string, "segment": string,
  "targets": [{"name": string, "instagram": string, "whatsapp": string, "linkedin": string, "category": string}],
  "collection_blocks": { "A": string, "B": string, "C": string, "D": string, "E": string, "F": string, "G": string },
  "ethical_rules": string, "approach_type": string, "deadline_first": string, "deadline_final": string }
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
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY não configurada. Adicione em Configurações do Projeto → Secrets.",
      );
    }

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
    const truncated = text.slice(0, 200_000);

    // call Anthropic
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: truncated }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Anthropic error", res.status, errBody);
      throw new Error(`Falha na chamada à Claude: ${res.status}`);
    }

    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const textBlock = json.content?.find((c) => c.type === "text")?.text ?? "";
    const extracted = tryParseJson(textBlock);

    const { error: updErr } = await supabase
      .from("document_versions")
      .update({
        extracted_data: extracted as never,
        status: "reviewing",
      })
      .eq("id", data.versionId);
    if (updErr) throw updErr;

    return { ok: true, extracted };
  });