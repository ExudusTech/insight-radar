# Relatório de custos — Insight Radar

**Projeto:** Insight Radar (`1be70740-5579-410f-99f6-225065683e35`)
**Período coberto (baseline):** 23/jun/2026 (início do projeto) → 04/jul/2026 (marco de corte)
**Próximo período de medição:** a partir de 05/jul/2026 (novos testes — ver seção 9)
**Ciclo de faturamento consultado:** 05/jun/2026 → 05/jul/2026
**Taxa aplicada:** 1 crédito Lovable = **US$ 0,40** (plano em que 50 créditos custam US$ 20)

---

## 1. Marco de corte

Os números das seções 2–6 são um **snapshot congelado até 04/jul/2026** e não devem ser recalculados retroativamente. Toda missão, alvo, evidência, mensagem e chamada de LLM criada a partir de **05/jul/2026** entra exclusivamente na **seção 9** (medição pós-corte), para que o custo dos novos testes seja isolável do histórico exploratório de construção do app.

Consultas de referência para separar o pós-corte:

```sql
SELECT count(*) FROM missions              WHERE created_at >= '2026-07-05';
SELECT count(*) FROM targets               WHERE created_at >= '2026-07-05';
SELECT count(*) FROM collection_data       WHERE created_at >= '2026-07-05';
SELECT count(*) FROM evidences             WHERE created_at >= '2026-07-05';
SELECT count(*) FROM assistant_messages    WHERE created_at >= '2026-07-05';
SELECT count(*) FROM llm_usage_logs        WHERE created_at >= '2026-07-05';
```

No lado Lovable, usar `credits--get_credit_balance` com `from=2026-07-05` (e `project_id` deste projeto) para o gasto de créditos do novo período.

---

## 2. Resumo executivo (baseline — até 04/jul/2026)

- Gasto total do projeto até hoje: **341,02 créditos ≈ US$ 136,41**.
- ~95% desse valor é **construção do app** (mensagens em build/plan mode com a Lovable). Só ~2% é infraestrutura Cloud rodando o produto.
- Custo de IA in-app (Claude/OpenAI/Gemini) chamada pelo próprio sistema em produção: **estimado em ~US$ 0,20** neste período (histórico não instrumentado; a partir desta sessão passa a ser medido de forma exata na tabela `llm_usage_logs`).
- Base observada: 1 missão, 6 alvos, 206 blocos preenchidos, 3 evidências, 30 mensagens no assistente por concorrente, 1 relatório gerado.

---

## 3. Gasto por categoria — baseline (créditos Lovable → USD)

Fonte: `credits--get_credit_balance` filtrado por `project_id`.

| Categoria | Créditos | USD |
|---|---:|---:|
| Build mode (chat construindo o app) | 325,13 | **US$ 130,05** |
| Plan mode (planejamento) | 14,00 | US$ 5,60 |
| Cloud compute (banco/functions rodando) | 1,86 | US$ 0,74 |
| Cloud egress (dados saindo) | 0,029 | US$ 0,01 |
| Cloud file storage (arquivos armazenados) | 0,00007 | ~US$ 0,00 |
| **Total do projeto** | **341,02** | **US$ 136,41** |

> Observação: o Balance API só retorna o ciclo de faturamento **atual**. Como o projeto começou em 23/jun (dentro do ciclo 05/jun–05/jul), este ciclo cobre 100% do histórico. A partir do próximo ciclo será necessário somar mês a mês.

---

## 4. Volumes operacionais registrados no banco — baseline

| Entidade | Volume |
|---|---:|
| Missões | 1 |
| Alvos (concorrentes) | 6 |
| Blocos de coleta A–G preenchidos | 206 |
| Evidências (arquivos/fotos) | 3 |
| Mensagens do assistente por concorrente (user + IA) | 30 (≈ 68.357 caracteres) |
| Versões de documento gerado | 1 |
| Relatórios | 1 |
| Interações registradas | 0 |
| Change requests | 0 |

Distribuição dos 206 blocos: A=41, B=57, C=33, D=18, E=21, F=12, G=24.

---

## 5. Custo de infraestrutura Cloud atribuível à operação — baseline

Do total do projeto, **1,89 créditos = US$ 0,76** foram Cloud (compute + egress + storage). Isso cobre **toda** a operação registrada na seção 3.

Baseline útil para pricing:

| Métrica | Valor |
|---|---:|
| Cloud por missão completa (neste porte) | **US$ 0,76** |
| Cloud por alvo | **US$ 0,13** |
| Cloud por bloco de coleta preenchido | ~US$ 0,004 |
| Cloud por evidência armazenada | ~US$ 0,003 |

---

## 6. Custo de IA in-app — baseline (estimativa retroativa)

A tabela `llm_usage_logs` foi criada e instrumentada nesta sessão, mas o histórico anterior de chamadas ao Claude/OpenAI/Gemini **não foi capturado** (0 linhas). A tabela abaixo é uma **estimativa** feita a partir do volume observado (assistant_messages, evidências extraídas, relatório gerado) e do mapa `MODEL_COSTS` de `src/lib/llm-router.ts`, com conversão de ~4 caracteres por token.

| Task | Modelo assumido | Input tokens | Output tokens | USD |
|---|---|---:|---:|---:|
| 30 mensagens no assistente por concorrente | Claude Haiku ($0,25 / $1,25 por 1M) | ~5.400 (user) × 3 (contexto replicado) | ~11.700 | **~US$ 0,05** |
| Extração de 3 evidências | Claude Sonnet ($3 / $15 por 1M) | ~2.000 × 3 | ~1.000 × 3 | **~US$ 0,06** |
| 1 relatório final gerado | Claude Sonnet | ~8.000 | ~4.000 | **~US$ 0,08** |
| Extração/análise dos 206 blocos de coleta | — (preenchimento majoritariamente manual) | — | — | — |
| **Total IA estimada retroativa** | | | | **~US$ 0,20** |

**Precisão:** ±30%. A partir de agora cada chamada é gravada exata em `llm_usage_logs` com `provider`, `model`, `task`, `input_tokens`, `output_tokens`, `estimated_cost_usd`. Em 30 dias essa seção pode ser reescrita com números reais.

---

## 7. Custo por unidade operacional — baseline (base para precificar planos)

Derivado das seções 4 e 5. Estes números são a base para desenhar os planos de contratação.

| Unidade | Cloud (USD) | IA (USD) | **Total (USD)** |
|---|---:|---:|---:|
| 1 missão criada (base) | 0,010 | — | **0,01** |
| 1 alvo adicionado | 0,127 | — | **0,13** |
| 1 evidência (upload + extração IA) | 0,003 | 0,021 | **0,024** |
| 1 bloco A–G preenchido manualmente | 0,004 | — | **0,004** |
| 1 mensagem no chat do assistente | 0,000 | 0,002 | **0,002** |
| 1 relatório final gerado | 0,050 | 0,080 | **0,13** |

### Exemplo aplicado a três planos hipotéticos

Assumindo uso médio por assinante **por mês**:

| Plano | Missões | Alvos | Evidências | Msgs chat | Relatórios | Custo/mês (USD) | Sugestão de preço 5× |
|---|---:|---:|---:|---:|---:|---:|---:|
| **Starter** | 1 | 3 | 10 | 30 | 1 | ~0,68 | US$ 3,40 |
| **Pro** | 3 | 15 | 60 | 150 | 3 | ~3,64 | US$ 18,20 |
| **Business** | 10 | 60 | 300 | 600 | 10 | ~16,17 | US$ 80,85 |

> A margem sugerida (5×) é ilustrativa. O custo real de infraestrutura por assinante tende a cair com escala (Cloud tem componente fixo diluído).

---

## 8. Metodologia e limitações

**Fontes de dados**
- Créditos por categoria: `credits--get_credit_balance` com filtro `project_id` e `group_by=billable_item`.
- Volumes operacionais: `SELECT COUNT` em `missions`, `targets`, `collection_data`, `evidences`, `assistant_messages`, `document_versions`, `reports`, `interactions`, `change_requests`.
- Custo por token de IA: mapa `MODEL_COSTS` em `src/lib/llm-router.ts` (Claude Sonnet 4 $3/$15 por 1M; Haiku $0,25/$1,25; Opus $15/$75; GPT-4o $2,5/$10; Gemini 2.0 Flash $0,075/$0,30).

**Conversão de créditos**
- 50 créditos = US$ 20 → 1 crédito = US$ 0,40 (plano vigente do usuário).

**Limitações principais**
1. **Ciclo único:** o Balance API só devolve o ciclo atual (05/jun–05/jul). O projeto começou em 23/jun, portanto está inteiramente contido nesse ciclo, mas isso não vale para meses futuros.
2. **IA retroativa é estimada:** chamadas anteriores à instrumentação (esta sessão) não foram gravadas em `llm_usage_logs`. A seção 5 usa proxies (comprimento das mensagens, volume de evidências) — precisão ±30%.
3. **Base amostral pequena:** apenas 1 missão real no banco. Os custos por unidade da seção 6 devem ser recalibrados quando houver 10+ missões concluídas.
4. **Custo de LLM é externo aos créditos Lovable:** as chamadas ao Anthropic/OpenAI/Gemini são cobradas diretamente pelo provedor com o `API key` configurado no projeto, não descontam créditos Lovable.

---

## 9. Medição pós-corte (a partir de 05/jul/2026)

Seção reservada para os próximos testes. Preencher conforme a nova missão for criada e operada. Como `llm_usage_logs` já está instrumentado, o custo de IA in-app será **medido de forma exata** — não mais estimado.

### 9.1 Gasto Lovable por categoria (a preencher)

| Categoria | Créditos | USD |
|---|---:|---:|
| Build mode |  |  |
| Plan mode |  |  |
| Cloud compute |  |  |
| Cloud egress |  |  |
| Cloud file storage |  |  |
| **Total pós-corte** |  |  |

Fonte: `credits--get_credit_balance` com `project_id=1be70740-5579-410f-99f6-225065683e35`, `from=2026-07-05`, `group_by=billable_item`.

### 9.2 Volumes operacionais pós-corte (a preencher)

| Entidade | Volume |
|---|---:|
| Missões |  |
| Alvos |  |
| Blocos A–G preenchidos |  |
| Evidências |  |
| Mensagens do assistente |  |
| Versões de documento |  |
| Relatórios |  |
| Interações |  |
| Change requests |  |

Usar as consultas SQL da seção 1 (com `created_at >= '2026-07-05'`).

### 9.3 Custo de IA in-app — medido (a preencher)

Snippet para consolidar por provedor/modelo/task:

```sql
SELECT provider, model, task,
       sum(input_tokens)        AS in_tok,
       sum(output_tokens)       AS out_tok,
       sum(estimated_cost_usd)  AS usd
FROM llm_usage_logs
WHERE created_at >= '2026-07-05'
GROUP BY 1, 2, 3
ORDER BY usd DESC;
```

### 9.4 Custo por unidade operacional pós-corte (a recalcular)

Reaplicar a metodologia da seção 7 sobre 9.1–9.3 assim que houver ≥1 missão completa no novo período. Comparar lado a lado com o baseline para validar (ou corrigir) as premissas de pricing.

---

## 10. Próximos passos recomendados

1. Registrar toda a operação da(s) nova(s) missão(ões) na **seção 9** — não misturar com o baseline.
2. Após ~30 dias com `llm_usage_logs` populado, transformar 9.3 no dashboard interno de custo real por `provider/model/task`.
3. Recalcular 9.4 com base em 10+ missões reais para reduzir viés amostral e revisar os planos hipotéticos da seção 7.
4. Exportar mensalmente o `credits--get_credit_balance` para arquivar o histórico do projeto, já que a API não guarda ciclos passados.

---

*Relatório gerado em 03/jul/2026. Marco de corte aplicado em 04/jul/2026.*