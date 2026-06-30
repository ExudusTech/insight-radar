# Teste de fallback do LLM Router → Gemini

Objetivo: confirmar, com evidência em log, que o `callLLM` percorre a cadeia de provedores e chega no Google Gemini quando os anteriores falham.

## Abordagem

Criar uma server function **temporária** e protegida por admin em `src/lib/llm-router-test.functions.ts` que:

1. Aceita um parâmetro `task` (default `"assistant"`, cuja cadeia hoje é `gemini → anthropic → openai`) e um parâmetro `forceFailUntil` (`"gemini" | "openai" | "anthropic"`) indicando até qual provedor da cadeia forçar falha.
2. **Sem alterar `llm-router.ts` em definitivo**, expõe um modo de teste: antes de chamar `callLLM`, sobrescreve temporariamente as env vars dos provedores que devem falhar (`process.env.GEMINI_API_KEY = "INVALID_FORCE_FAIL"` etc.), executa, e restaura os valores originais no `finally`. Isso dispara erro 401 nesses provedores, que o router classifica e segue para o próximo da cadeia (vamos ajustar `shouldFallback` para também tratar 401/403 como fallback — mudança mínima e correta também para produção).
3. Retorna `{ provider, model, text, attempted: string[] }` para o cliente.

Adicionar pequeno botão "Testar fallback LLM" em `/settings` (visível só para admin) que dispara a função com 3 cenários:
- `forceFailUntil: "none"` → deve usar primeiro da cadeia.
- `forceFailUntil: "gemini"` → deve cair para Anthropic.
- `forceFailUntil: "anthropic"` (e gemini) → deve cair para OpenAI.
- Para a task `"extraction"` (cadeia `anthropic → openai → gemini`), forçar falha em Anthropic + OpenAI → deve chegar no **Gemini**, confirmando o objetivo.

Resultado é mostrado em toast + console, e também aparece no painel de logs do AI Gateway (`ai_gateway_logs`).

## Detalhes técnicos

**Arquivos novos**
- `src/lib/llm-router-test.functions.ts` — server fn `runLlmFallbackTest`, com `requireSupabaseAuth` + checagem `has_role(..., 'admin')`. Faz override temporário de `process.env.*_API_KEY` conforme `forceFailUntil`, chama `callLLM({ task, systemPrompt: "Responda apenas: OK", messages: [{role:"user", content:"ping"}] })`, restaura env no `finally`.

**Arquivo alterado (mínimo)**
- `src/lib/llm-router.ts` — em `shouldFallback`, incluir `status === 401 || status === 403` (auth inválida deve cair para o próximo provedor, não derrubar a request). Mantém comportamento existente para 429/529/quota.
- `src/routes/_authenticated/settings.tsx` — adicionar seção "Diagnóstico LLM" (admin-only) com 4 botões, cada um chamando `runLlmFallbackTest` com um cenário e exibindo `provider/model` resposta via `toast`.

**Validação**
- Rodar cada cenário pela UI e conferir no toast/console que o `provider` retornado é o esperado.
- Confirmar nos logs do AI Gateway (`ai_gateway_logs--list_ai_gateway_requests`) as tentativas em ordem.

**Limpeza**
- Após o teste validado, posso remover a server function e o botão num passo seguinte (ou mantê-los como ferramenta interna de diagnóstico — sua escolha).
