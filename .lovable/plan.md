## Objetivo

Estabelecer um **marco de corte em 04/jul/2026** no `docs/relatorio-custos.md`, congelando os números atuais como baseline histórico e preparando o documento para medir separadamente o custo da(s) próxima(s) missão(ões) de teste.

## Mudanças no `docs/relatorio-custos.md`

1. **Cabeçalho** — atualizar:
   - "Período coberto" vira `23/jun/2026 → 04/jul/2026 (marco de corte)`.
   - Adicionar linha "Próximo período de medição: a partir de 05/jul/2026 (novos testes)".

2. **Nova seção 1 — "Marco de corte"** (antes do resumo executivo):
   - Explicar que os números das seções 2–6 são snapshot congelado até 04/jul/2026.
   - Toda missão criada a partir de agora entra na seção 9 (nova).
   - Consulta de referência: `SELECT count(*) FROM missions WHERE created_at >= '2026-07-05'` e equivalentes para targets/collection_data/evidences/assistant_messages/llm_usage_logs.

3. **Seções 2–6** — manter conteúdo, apenas renumerar e marcar como "Baseline (até 04/jul/2026)".

4. **Nova seção 9 — "Medição pós-corte (a partir de 05/jul/2026)"**:
   - Tabela vazia com as mesmas colunas da seção 2 (categoria / créditos / USD) — a preencher.
   - Tabela vazia de volumes operacionais espelhando a seção 3.
   - Nota: como `llm_usage_logs` agora está instrumentado, o custo de IA in-app da nova missão será medido de forma exata (não estimada).
   - Snippet SQL pronto para copiar/colar:
     ```sql
     SELECT provider, model, task,
            sum(input_tokens) in_tok,
            sum(output_tokens) out_tok,
            sum(estimated_cost_usd) usd
     FROM llm_usage_logs
     WHERE created_at >= '2026-07-05'
     GROUP BY 1,2,3 ORDER BY usd DESC;
     ```
   - Referência ao `credits--get_credit_balance` filtrado por `from=2026-07-05` para o lado Lovable.

5. **Seção 8 (próximos passos)** — ajustar item 1 para apontar para a seção 9 como o local de registro dos próximos 30 dias.

6. **Rodapé** — mudar data para `04/jul/2026 (marco de corte)`.

## Não faz parte deste plano

- Não altera código, schema, nem `llm_usage_logs` (já instrumentado).
- Não recomputa números do baseline — eles ficam exatamente como estão.
- Não mexe no `relatorio-custos.csv` (é gerado a partir do markdown; se você quiser regenerar depois, me avisa).

Confirma que devo aplicar?
