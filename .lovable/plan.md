# Diagnóstico do fallback Gemini

## O que o teste 1 revelou

O cenário 1 (`assistant — sem falha`) **não força falha em ninguém**, então deveria ter respondido com `gemini/gemini-2.0-flash`. O toast mostrou `openai/gpt-4o-mini (esperado: gemini)` — ou seja, o Gemini falhou sozinho e o roteador caiu pro próximo da cadeia. **Não adianta rodar os outros 3 antes de entender isso**, porque os cenários B/C/D também dependem do Gemini estar funcional.

## Hipóteses prováveis

1. `GEMINI_API_KEY` não está disponível no runtime do preview (foi salva mas o servidor ainda não pegou — exige restart/republish).
2. O endpoint OpenAI-compat do Google rejeita o nome `gemini-2.0-flash` (o formato canônico pelo endpoint compat costuma ser `models/gemini-2.0-flash` ou `gemini-2.0-flash-exp`).
3. A key foi gerada num projeto Google sem a Generative Language API habilitada (retorna 403).

## Passos do plano

1. Adicionar **logging detalhado** temporário em `src/lib/llm-router.ts` (status + primeiros 300 chars do body) já no caminho de `shouldFallback`, para qualquer provider — hoje só logamos `provider/model: status`.
2. Expor no resultado do `runLlmFallbackTest` um array `attempts[]` com `{provider, model, status, bodySnippet}` para cada tentativa, e mostrar isso na UI de `/settings` (não só no toast).
3. Rodar de novo o cenário 1 com a UI já mostrando o erro real do Gemini.
4. Corrigir conforme o diagnóstico:
   - Se 401/403 → revisar a `GEMINI_API_KEY` (regerar / habilitar API).
   - Se 404 "model not found" → ajustar o nome do modelo na tabela `ROUTING` (`models/gemini-2.0-flash` ou `gemini-2.0-flash-exp`).
   - Se "key não configurada" → forçar restart do dev server.
5. Só depois rodar os 3 cenários restantes para validar a cadeia completa.

## Resposta direta às suas perguntas

- **Devo executar os outros?** Não agora. O cenário 1 já mostrou que o Gemini está caindo — rodar B/C/D vai só repetir a mesma falha disfarçada.
- **Você pediu pra rodar o último?** Sim, o cenário D (`extraction — falha Anthropic+OpenAI → espera Gemini`) é o que valida diretamente o Gemini como fallback. Mas como o Gemini já está quebrado no cenário 1, ele também vai falhar — precisamos consertar primeiro.
