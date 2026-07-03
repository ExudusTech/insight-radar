
# Relatório de custos — Insight Radar

Foco: **apenas este projeto** (`1be70740-…`). Conversão fixa do seu plano:
**50 créditos = US$ 20 → 1 crédito = US$ 0,40**.

## 1. Total gasto no projeto (ciclo 05/jun → 05/jul/2026)

Fonte: `credits--get_credit_balance` filtrado por `project_id`.

| Categoria | Créditos | USD |
|---|---:|---:|
| Build mode messages (chat construindo o app) | 325,13 | **US$ 130,05** |
| Plan mode messages (planejamento) | 14,00 | US$ 5,60 |
| Cloud compute (banco/functions rodando) | 1,86 | US$ 0,74 |
| Cloud egress (dados saindo) | 0,029 | US$ 0,01 |
| Cloud file storage (arquivos) | 0,00007 | ~US$ 0 |
| **Total do projeto** | **341,02** | **US$ 136,41** |

Observação: o Balance API só devolve o ciclo de faturamento atual (05/jun–
05/jul). Como o projeto começou em **23/jun/2026**, o ciclo cobre todo o
histórico. Ciclos futuros terão que ser somados mês a mês.

## 2. Custo por tipo de atividade (para precificar planos)

Aqui separo o custo por família de atividade do **produto** (não do
desenvolvimento). Ou seja: quanto custa operar o sistema por missão / por
alvo / por interação, para ajudar a montar os planos de contratação.

### 2a. O que temos hoje no banco (uma missão real de referência)

| Entidade | Volume |
|---|---:|
| Missões | 1 |
| Alvos (concorrentes) | 6 |
| Registros de coleta (blocos A–G) | 206 |
| Evidências (arquivos/fotos) | 3 |
| Versões de documento gerado | 1 |
| Mensagens do assistente (user+IA) | 30 (≈68k caracteres) |
| Relatórios | 1 |
| Interações registradas | 0 |
| Change requests | 0 |

### 2b. Custo de infraestrutura Cloud atribuível a essa operação

Do total do projeto, **1,89 créditos (US$ 0,76)** foram Cloud
(compute+egress+storage). Isso cobre toda a operação acima (1 missão × 6
alvos × 206 registros × 3 evidências × 30 mensagens). Serve de baseline:
**~US$ 0,13 por alvo** de custo de infraestrutura, ou **~US$ 0,76 por
missão completa** neste porte.

### 2c. Custo de IA in-app (Anthropic/OpenAI/Gemini via `llm-router`)

A tabela `llm_usage_logs` **está vazia hoje** (0 chamadas gravadas) —
a instrumentação foi ligada nesta sessão, então histórico anterior é
irrecuperável. Para dar um número **estimado retroativo** vou:

1. Reprocessar `assistant_messages` (30 msgs, 68k chars) usando o mapa
   `MODEL_COSTS` já definido em `src/lib/llm-router.ts` e a conversão
   ~4 chars/token, atribuindo o modelo default de cada task (assistant →
   Claude Haiku; comparative → Haiku; report → Opus/Sonnet; extraction →
   Sonnet).
2. Reprocessar `document_versions` (1 relatório gerado) como task=report.
3. Reprocessar `collection_data` (206 blocos) assumindo custo médio de
   extração por bloco (Sonnet, ~2k tokens in / 1k out) apenas para os
   blocos com evidência anexada (3), já que só esses acionam extração.

Resultado será apresentado como estimativa (±30%), com uma linha "a
partir de agora este número vem exato do `llm_usage_logs`".

### 2d. Custo por unidade (o que interessa para os planos)

O relatório vai fechar com uma tabela do tipo:

| Unidade de operação | Cloud (USD) | IA estimada (USD) | Total (USD) |
|---|---:|---:|---:|
| 1 missão vazia (só criada) | … | … | … |
| 1 alvo adicionado | … | … | … |
| 1 evidência (upload + extração) | … | … | … |
| 1 mensagem no chat comparativo | … | … | … |
| 1 relatório final gerado | … | … | … |

Esses números saem da divisão do gasto real observado pelo volume
registrado no banco, mais a estimativa da 2c. Servem de base para
precificar planos (ex.: Starter 1 missão / 5 alvos / 20 evidências / 50
mensagens/mês → US$ X de custo → margem Y).

## 3. Entregável

Arquivo único **`docs/relatorio-custos.md`** com:

1. Resumo executivo (US$ 136,41 gastos até hoje, 341 créditos, 50%
   do consumo do workspace saiu deste projeto).
2. Tabela da seção 1 (créditos → USD por categoria).
3. Tabela de volumes 2a.
4. Custo de infraestrutura por alvo/missão (2b).
5. Estimativa de custo de IA retroativa por tipo de task (2c), com nota
   de precisão.
6. Tabela de custo por unidade operacional (2d) — a base do pricing.
7. Metodologia: fontes usadas (`credits--get_credit_balance` filtrado por
   projeto, `psql` em `assistant_messages`/`collection_data`/`evidences`/
   `document_versions`, mapa `MODEL_COSTS` de `llm-router.ts`), taxa 1
   crédito = US$ 0,40, período coberto, limitações.
8. Próximos passos: após ~30 dias com `llm_usage_logs` populado, refazer
   as seções 2c e 2d com números exatos por provider/model/task.

Nenhuma alteração de código de produto — só criação do arquivo Markdown
em `docs/`. Se quiser também um CSV com o mesmo detalhamento para abrir
no Excel, eu incluo `docs/relatorio-custos.csv` no mesmo passo.

## Detalhes técnicos

- Fonte de créditos: `credits--get_credit_balance` com
  `project_id=1be70740-5579-410f-99f6-225065683e35` e `group_by=billable_item`.
- Fonte de volumes: `SELECT COUNT` nas tabelas
  `missions`, `targets`, `collection_data`, `evidences`, `assistant_messages`,
  `document_versions`, `reports`, `interactions`, `change_requests`.
- Fonte de tokens/custo IA: mapa `MODEL_COSTS` em `src/lib/llm-router.ts`
  (Claude Sonnet US$3/US$15 por 1M, Haiku US$0,25/US$1,25, Opus
  US$15/US$75, GPT-4o US$2,5/US$10, Gemini 2.0 Flash US$0,075/US$0,3).
- Taxa aplicada: 1 crédito = US$ 0,40 (plano do usuário, 50 créditos =
  US$ 20).
- Limitação principal: chamadas de IA anteriores a esta sessão não estão
  em `llm_usage_logs` e são estimadas por proxy (comprimento das mensagens
  gravadas e volume de blocos com evidência). Precisão ±30% na seção
  retroativa; a partir de agora, exato.
