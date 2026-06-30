import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLLM, type TaskType, type Provider } from "@/lib/llm-router";

const Input = z.object({
  task: z.enum(["extraction", "assistant", "report", "classify"]),
  failProviders: z.array(z.enum(["anthropic", "openai", "gemini"])).default([]),
});

export const runLlmFallbackTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const ENV_KEYS: Record<Provider, string> = {
      anthropic: "ANTHROPIC_API_KEY",
      openai: "OPENAI_API_KEY",
      gemini: "GEMINI_API_KEY",
    };

    const saved: Record<string, string | undefined> = {};
    for (const p of data.failProviders) {
      const key = ENV_KEYS[p];
      saved[key] = process.env[key];
      process.env[key] = "sk-INVALID_FORCED_FAIL_FOR_TEST";
    }

    try {
      const result = await callLLM({
        task: data.task as TaskType,
        systemPrompt: "Você é um teste. Responda apenas: OK",
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 32,
      });
      return {
        ok: true,
        provider: result.provider,
        model: result.model,
        text: result.text.slice(0, 200),
        forcedFail: data.failProviders,
      };
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });