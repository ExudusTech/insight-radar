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

async function callOpenAICompat(
  baseUrl: string,
  model: string,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens: number,
  apiKey: string,
): Promise<RawResult> {
  const oaiMessages = [{ role: "system", content: systemPrompt }, ...messages];
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
      const msg = `${cfg.provider}/${cfg.model}: ${result.status} — ${result.rawBody.slice(0, 200)}`;
      errors.push(msg);
      console.warn(`[llm-router] ${msg} — trying next in chain`);
      continue;
    }

    throw new Error(
      `Erro LLM (${cfg.provider}/${cfg.model}): ${result.status} — ${result.rawBody.slice(0, 300)}`,
    );
  }

  throw new Error(
    `Todos os provedores LLM falharam para task="${task}":\n${errors.join("\n")}`,
  );
}
