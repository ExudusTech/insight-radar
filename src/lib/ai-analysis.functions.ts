import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "claude-sonnet-4-5-20250929";

const TARGET_SYSTEM = `Você é um analista de inteligência de mercado especializado. Com base nos dados de coleta coletados sobre este alvo, produza uma análise estruturada em JSON:
{
  "positioning": "como o alvo se posiciona no mercado",
  "offer": "quais produtos/serviços oferece e como",
  "pricing": "estrutura de preços identificada",
  "sales_process": "como é o processo de venda/funil",
  "differentials": ["diferencial 1", "diferencial 2"],
  "weaknesses": ["fraqueza 1", "fraqueza 2"],
  "opportunities": "oportunidades identificadas",
  "overall_score": 1-10,
  "summary": "parágrafo de síntese executiva"
}
Baseie-se apenas nos dados fornecidos. Seja objetivo e analítico. Retorne apenas JSON válido.`;

const COMPARATIVE_SYSTEM = `Você é um analista de inteligência de mercado. Com base nas análises individuais dos alvos abaixo, produza uma análise comparativa estratégica em JSON:
{
  "market_overview": "visão geral do mercado analisado",
  "price_range": { "min": valor, "max": valor, "average": valor },
  "best_positioning": "nome do alvo com melhor posicionamento e por quê",
  "market_gaps": ["gap 1", "gap 2"],
  "strategic_recommendations": ["recomendação 1", "recomendação 2"],
  "ranking": [{"target": "nome", "score": 1-10, "reason": "motivo"}]
}
Retorne apenas JSON válido.`;

function parseJson(raw: string): unknown {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const m = stripped.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Resposta da IA não é JSON válido");
  }
}

async function callClaude(system: string, user: string): Promise<unknown> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user.slice(0, 200_000) }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API: ${res.status} ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { content?: Array<{ text?: string }> };
  const text = json.content?.[0]?.text ?? "";
  return parseJson(text);
}

export const analyzeTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ targetId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: target, error: tErr } = await supabase
      .from("targets")
      .select("*")
      .eq("id", data.targetId)
      .single();
    if (tErr || !target) throw new Error("Alvo não encontrado");

    const [coll, inter, evid] = await Promise.all([
      supabase.from("collection_data").select("block, field_key, field_value").eq("target_id", target.id),
      supabase.from("interactions").select("event_type, channel, content, event_at, status_after").eq("target_id", target.id).order("event_at"),
      supabase.from("evidences").select("evidence_type, caption, tags, captured_at").eq("target_id", target.id),
    ]);

    const payload = {
      target: {
        name: target.name,
        brand: target.brand,
        category: target.category,
        site: target.site,
        instagram: target.instagram,
        notes: target.notes,
      },
      collection: coll.data ?? [],
      interactions: inter.data ?? [],
      evidences: evid.data ?? [],
    };

    const content = await callClaude(TARGET_SYSTEM, JSON.stringify(payload, null, 2));

    const { data: report, error: rErr } = await supabase
      .from("reports")
      .insert({
        mission_id: target.mission_id,
        target_id: target.id,
        report_type: "individual",
        status: "generated",
        content: content as never,
      })
      .select("*")
      .single();
    if (rErr) throw rErr;

    return report;
  });

export const generateComparative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ missionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: targets } = await supabase
      .from("targets")
      .select("id, name")
      .eq("mission_id", data.missionId);
    if (!targets || targets.length === 0) throw new Error("Sem alvos na missão");

    const { data: reports } = await supabase
      .from("reports")
      .select("target_id, content, generated_at")
      .eq("mission_id", data.missionId)
      .eq("report_type", "individual")
      .order("generated_at", { ascending: false });

    const latestByTarget = new Map<string, unknown>();
    for (const r of reports ?? []) {
      if (r.target_id && !latestByTarget.has(r.target_id)) latestByTarget.set(r.target_id, r.content);
    }

    const payload = targets.map((t) => ({
      target: t.name,
      analysis: latestByTarget.get(t.id) ?? null,
    }));

    const content = await callClaude(COMPARATIVE_SYSTEM, JSON.stringify(payload, null, 2));

    const { data: report, error } = await supabase
      .from("reports")
      .insert({
        mission_id: data.missionId,
        report_type: "comparative",
        status: "generated",
        content: content as never,
      })
      .select("*")
      .single();
    if (error) throw error;
    return report;
  });