/**
 * LLM Router — runs SERVER-SIDE ONLY (inside createServerFn handlers)
 * Routes calls to the best provider/model per task type.
 * Auto-falls back to secondary provider when primary hits rate/quota limits.
 */

export type TaskType = "extraction" | "assistant" | "report" | "classify";

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMCallParams {
  task: TaskType;
  messages: LLMMessage[];
  systemPrompt: string;
  maxTokens?: number;
}

export interface LLMCallResult {
  text: string;
  provider: "anthropic" | "openai";
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

type Provider = "anthropic" | "openai";
interface ProviderConfig { provider: Provider; model: string }

const ROUTING: Record<TaskType, { primary: ProviderConfig; fallback: ProviderConfig }> = {
  extraction: {
    primary:  { provider: "anthropic", model: "claude-sonnet-4-6" },
    fallback: { provider: "openai",    model: "gpt-4o" },
  },
  assistant: {
    primary:  { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
    fallback: { provider: "openai",    model: "gpt-4o-mini" },
  },
  report: {
    primary:  { provider: "anthropic", model: "claude-opus-4-8" },
    fallback: { provider: "openai",    model: "gpt-4o" },
  },
  classify: {
    primary:  { provider: "openai",    model: "gpt-4o-mini" },
    fallback: { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
  },
};

const DEFAULT_MAX_TOKENS: Record<TaskType, number> = {
  extraction: 4096,
  assistant:  2048,
  report:     16384,
  classify:   512,
};

async function callAnthropic(
  model: string,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens: number,
  apiKey: string,
): Promise<{ text: string; inputTokens?: number; outputTokens?: number; status: number; rawBody: string }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system: systemPrompt, messages }),
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

async function callOpenAI(
  model: string,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens: number,
  apiKey: string,
): Promise<{ text: string; inputTokens?: number; outputTokens?: number; status: number; rawBody: string }> {
  const oaiMessages = [{ role: "system", content: systemPrompt }, ...messages];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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

function isQuotaError(status: number, body: string): boolean {
  if (status === 429 || status === 529) return true;
  if (status === 400 && (body.includes("usage limits") || body.includes("quota"))) return true;
  return false;
}

async function invokeProvider(
  cfg: ProviderConfig,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens: number,
) {
  if (cfg.provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY não configurada nos secrets do projeto.");
    return callAnthropic(cfg.model, systemPrompt, messages, maxTokens, key);
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY não configurada nos secrets do projeto.");
  return callOpenAI(cfg.model, systemPrompt, messages, maxTokens, key);
}

export async function callLLM(params: LLMCallParams): Promise<LLMCallResult> {
  const { task, messages, systemPrompt, maxTokens: maxTokensOverride } = params;
  const routing = ROUTING[task];
  const maxTokens = maxTokensOverride ?? DEFAULT_MAX_TOKENS[task];

  const primary = await invokeProvider(routing.primary, systemPrompt, messages, maxTokens);

  if (primary.status >= 200 && primary.status < 300) {
    return {
      text: primary.text,
      provider: routing.primary.provider,
      model: routing.primary.model,
      inputTokens: primary.inputTokens,
      outputTokens: primary.outputTokens,
    };
  }

  if (isQuotaError(primary.status, primary.rawBody)) {
    console.warn(
      `[llm-router] ${routing.primary.provider}/${routing.primary.model} hit limit (${primary.status}) — switching to ${routing.fallback.provider}/${routing.fallback.model}`,
    );
    const fallback = await invokeProvider(routing.fallback, systemPrompt, messages, maxTokens);
    if (fallback.status >= 200 && fallback.status < 300) {
      return {
        text: fallback.text,
        provider: routing.fallback.provider,
        model: routing.fallback.model,
        inputTokens: fallback.inputTokens,
        outputTokens: fallback.outputTokens,
      };
    }
    throw new Error(
      `Ambos provedores falharam.\n` +
      `Primary (${routing.primary.provider}): ${primary.status} — ${primary.rawBody.slice(0, 200)}\n` +
      `Fallback (${routing.fallback.provider}): ${fallback.status} — ${fallback.rawBody.slice(0, 200)}`,
    );
  }

  throw new Error(
    `Erro LLM (${routing.primary.provider}/${routing.primary.model}): ${primary.status} — ${primary.rawBody.slice(0, 300)}`,
  );
}