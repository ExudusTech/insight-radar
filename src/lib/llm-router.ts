/**
 * LLM Router — SERVER-SIDE ONLY
 * Suporta Anthropic, OpenAI e Google Gemini.
 * Tenta provedores em cadeia (chain) até um ter sucesso.
 * Auto-fallback em erros de quota/rate-limit (429, 529, 400+quota).
 */

export type TaskType = "extraction" | "assistant" | "report" | "classify";
export type Provider   = "anthropic" | "openai" | "gemini";

export interface LLMMessage {
  role: "user" | "assistant";
  content: LLMContent;
}

export type LLMContent =
  | string
  | Array<LLMContentBlock>;

export type LLMContentBlock =
  | { type: "text"; text: string }
  | { type: "image_base64"; mediaType: string; data: string };

function toAnthropicContent(content: LLMContent) {
  if (typeof content === "string") return content;
  return content.map((b) => {
    if (b.type === "text") return { type: "text", text: b.text };
    return {
      type: "image",
      source: { type: "base64", media_type: b.mediaType, data: b.data },
    };
  });
}

function toOpenAIContent(content: LLMContent) {
  if (typeof content === "string") return content;
  return content.map((b) => {
    if (b.type === "text") return { type: "text", text: b.text };
    return {
      type: "image_url",
      image_url: { url: `data:${b.mediaType};base64,${b.data}` },
    };
  });
}

export interface LLMCallParams {
  task: TaskType;
  messages: LLMMessage[];
  systemPrompt: string;
  maxTokens?: number;
  /**
   * Contexto opcional para rastreio de consumo em `llm_usage_logs`.
   * Se omitido, a chamada não é registrada.
   */
  tracking?: {
    userId?: string | null;
    missionId?: string | null;
    targetId?: string | null;
    /** Override do task para logging (ex.: "comparative", "meeting_script"). */
    taskLabel?: string;
  };
}

export interface LLMCallResult {
  text: string;
  provider: Provider;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  attempts?: AttemptInfo[];
}

export interface AttemptInfo {
  provider: Provider;
  model: string;
  status: number;
  ok: boolean;
  bodySnippet: string;
}

interface ProviderConfig {
  provider: Provider;
  model: string;
}

const ROUTING: Record<TaskType, { chain: ProviderConfig[] }> = {
  extraction: {
    chain: [
      { provider: "anthropic", model: "claude-sonnet-4-6" },
      { provider: "openai",    model: "gpt-4o" },
      { provider: "gemini",    model: "gemini-2.0-flash" },
    ],
  },
  assistant: {
    chain: [
      { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
      { provider: "gemini",    model: "gemini-2.0-flash" },
      { provider: "openai",    model: "gpt-4o-mini" },
    ],
  },
  report: {
    chain: [
      { provider: "anthropic", model: "claude-opus-4-8" },
      { provider: "openai",    model: "gpt-4o" },
      { provider: "gemini",    model: "gemini-2.0-flash" },
    ],
  },
  classify: {
    chain: [
      { provider: "gemini",    model: "gemini-2.0-flash" },
      { provider: "openai",    model: "gpt-4o-mini" },
      { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
    ],
  },
};

const DEFAULT_MAX_TOKENS: Record<TaskType, number> = {
  extraction: 4096,
  assistant:  2048,
  report:     16384,
  classify:   512,
};

type RawResult = {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  status: number;
  rawBody: string;
};

async function callAnthropic(
  model: string,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens: number,
  apiKey: string,
): Promise<RawResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: toAnthropicContent(m.content) })),
    }),
  });
  const rawBody = await res.text();
  if (!res.ok) return { text: "", status: res.status, rawBody };
  const json = JSON.parse(rawBody) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };
  return {
    text: json.content?.find((c) => c.type === "text")?.text ?? "",
    inputTokens: json.usage?.input_tokens,
    outputTokens: json.usage?.output_tokens,
    status: res.status,
    rawBody,
  };
}

async function callOpenAICompat(
  baseUrl: string,
  model: string,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens: number,
  apiKey: string,
): Promise<RawResult> {
  const oaiMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: toOpenAIContent(m.content) })),
  ];
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: oaiMessages }),
  });
  const rawBody = await res.text();
  if (!res.ok) return { text: "", status: res.status, rawBody };
  const json = JSON.parse(rawBody) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };
  return {
    text: json.choices?.[0]?.message?.content ?? "",
    inputTokens: json.usage?.prompt_tokens,
    outputTokens: json.usage?.completion_tokens,
    status: res.status,
    rawBody,
  };
}

const PROVIDER_ENV: Record<Provider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai:    "OPENAI_API_KEY",
  gemini:    "GEMINI_API_KEY",
};

const OPENAI_COMPAT_BASES: Partial<Record<Provider, string>> = {
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
};

// Custo estimado por 1M tokens (USD).
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 0.25, output: 1.25 },
  "claude-opus-4-8": { input: 15.0, output: 75.0 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gemini-2.0-flash": { input: 0.075, output: 0.3 },
};

function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const c = MODEL_COSTS[model];
  if (!c) return 0;
  return (inputTokens * c.input + outputTokens * c.output) / 1_000_000;
}

async function recordUsage(args: {
  tracking: NonNullable<LLMCallParams["tracking"]>;
  task: TaskType;
  provider: Provider;
  model: string;
  inputTokens: number;
  outputTokens: number;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cost = estimateCostUsd(args.model, args.inputTokens, args.outputTokens);
    await supabaseAdmin.from("llm_usage_logs").insert({
      user_id: args.tracking.userId ?? null,
      mission_id: args.tracking.missionId ?? null,
      target_id: args.tracking.targetId ?? null,
      provider: args.provider,
      model: args.model,
      task: args.tracking.taskLabel ?? args.task,
      input_tokens: args.inputTokens,
      output_tokens: args.outputTokens,
      estimated_cost_usd: cost,
    });
  } catch (e) {
    console.warn("[llm-router] failed to record usage log", e);
  }
}

async function invokeProvider(
  cfg: ProviderConfig,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens: number,
): Promise<RawResult> {
  const envVar = PROVIDER_ENV[cfg.provider];
  const apiKey = process.env[envVar];
  if (!apiKey) {
    return {
      text: "",
      status: 400,
      rawBody: `{"error":"${envVar} não configurada — provedor ${cfg.provider} ignorado"}`,
    };
  }

  if (cfg.provider === "anthropic") {
    return callAnthropic(cfg.model, systemPrompt, messages, maxTokens, apiKey);
  }

  const baseUrl = OPENAI_COMPAT_BASES[cfg.provider]!;
  return callOpenAICompat(baseUrl, cfg.model, systemPrompt, messages, maxTokens, apiKey);
}

function shouldFallback(status: number, body: string): boolean {
  if (status === 429 || status === 529) return true;
  if (status === 401 || status === 403) return true;
  if (status === 400 && (body.includes("usage limits") || body.includes("quota") || body.includes("não configurada"))) return true;
  return false;
}

export async function callLLM(params: LLMCallParams): Promise<LLMCallResult> {
  const { task, messages, systemPrompt, maxTokens: maxTokensOverride } = params;
  const { chain } = ROUTING[task];
  const maxTokens = maxTokensOverride ?? DEFAULT_MAX_TOKENS[task];

  const errors: string[] = [];
  const attempts: AttemptInfo[] = [];

  for (const cfg of chain) {
    const result = await invokeProvider(cfg, systemPrompt, messages, maxTokens);
    attempts.push({
      provider: cfg.provider,
      model: cfg.model,
      status: result.status,
      ok: result.status >= 200 && result.status < 300,
      bodySnippet: result.rawBody.slice(0, 300),
    });

    if (result.status >= 200 && result.status < 300) {
      if (errors.length > 0) {
        console.info(`[llm-router] Succeeded with ${cfg.provider}/${cfg.model} after ${errors.length} failure(s)`);
      }
      if (params.tracking) {
        await recordUsage({
          tracking: params.tracking,
          task,
          provider: cfg.provider,
          model: cfg.model,
          inputTokens: result.inputTokens ?? 0,
          outputTokens: result.outputTokens ?? 0,
        });
      }
      return {
        text: result.text,
        provider: cfg.provider,
        model: cfg.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        attempts,
      };
    }

    if (shouldFallback(result.status, result.rawBody)) {
      const internalMsg = `${cfg.provider}/${cfg.model}: ${result.status} — ${result.rawBody.slice(0, 200)}`;
      errors.push(`${cfg.provider}/${cfg.model}: ${result.status}`);
      console.warn(`[llm-router] ${internalMsg} — trying next in chain`);
      continue;
    }

    console.error("[llm-router] provider error", {
      provider: cfg.provider,
      model: cfg.model,
      task,
      status: result.status,
      body: result.rawBody.slice(0, 500),
    });
    throw new Error("Serviço de IA temporariamente indisponível. Tente novamente em instantes.");
  }

  console.error("[llm-router] all providers failed", { task, errors });
  throw new Error("Serviço de IA temporariamente indisponível. Tente novamente em instantes.");
}
