# Fase 2 — Missões + Alvos + Kanban (revisada)

## Correções incorporadas (do feedback)

### 1. Novo enum `target_status` (14 valores)
Migração vai **dropar e recriar** o enum (não há dados de produção ainda):

```
nao_iniciado
pesquisa_publica_em_andamento
primeiro_contato_enviado
aguardando_resposta
em_conversa
call_agendada
call_realizada
proposta_recebida
preco_identificado
coleta_concluida
incompleto
descartado
```

(São 12 — confirmando: o PRD lista esses 12. Mencionei "14" no plano anterior por engano. Vou trabalhar com os 12 listados.)

Default da coluna `targets.status` = `nao_iniciado`.

### 2. Modelo do Alvo (consultor/influenciador)

Migração ajusta `targets`:
- **Remove**: `legal_name`, `tax_id`, `company_size` (se existirem)
- **Mantém**: `name`, `segment`, `website`, `status`, `responsible_id`, `mission_id`
- **Adiciona**: `instagram_url`, `whatsapp`, `linkedin_url`, `other_links` (jsonb array), `priority` (enum: `alta`/`media`/`baixa`, default `media`), `notes` (text)

Novo enum `target_priority`: `alta`, `media`, `baixa`.

### 3. Label customizável por missão
- Adicionar coluna `missions.target_label` (text, default `'Concorrente'`)
- UI usa essa string no lugar de "Alvo" em todo o contexto da missão (tabs, botões "Novo Concorrente", header do Kanban, etc.)
- Form de missão expõe o campo (default `Concorrente`)

### 4. Kanban — 12 colunas com cores do PRD

Mapa de cores (tokens semânticos adicionados ao `styles.css` — sem hex hardcoded em componentes):

| Status | Cor |
|---|---|
| nao_iniciado | cinza |
| pesquisa_publica_em_andamento | azul claro |
| primeiro_contato_enviado | amarelo |
| aguardando_resposta | laranja |
| em_conversa | azul #1D4ED8 |
| call_agendada | roxo |
| call_realizada | roxo (variação) |
| proposta_recebida | ciano #06B6D4 |
| preco_identificado | verde claro |
| coleta_concluida | verde #16A34A |
| incompleto | vermelho |
| descartado | vermelho (variação) |

Tokens criados: `--status-nao-iniciado`, `--status-pesquisa`, `--status-primeiro-contato`, `--status-aguardando`, `--status-em-conversa`, `--status-call`, `--status-proposta`, `--status-preco`, `--status-concluido`, `--status-incompleto`, `--status-descartado` (+ variantes `-fg`/`-border` quando necessário). Componente `<StatusBadge status>` e header de coluna do Kanban consomem esses tokens.

## Migrações (ordem)

1. **Migração de schema** (via `supabase--migration`):
   - `DROP TYPE target_status CASCADE` (recria a coluna depois) — ou `ALTER TYPE` com renomeação dos valores antigos
   - Recria enum `target_status` com 12 valores
   - Cria enum `target_priority`
   - `ALTER TABLE targets` — remove campos B2B, adiciona campos consultor + priority + notes + other_links
   - `ALTER TABLE missions ADD COLUMN target_label text NOT NULL DEFAULT 'Concorrente'`

(O usuário aprova essa migração antes de eu seguir com o código.)

## Implementação (após migração aprovada)

### Server functions (`src/lib/`)
- `missions.functions.ts`: `listMissions`, `getMission`, `createMission`, `updateMission`, `archiveMission`
- `targets.functions.ts`: `listTargetsByMission`, `getTarget`, `createTarget`, `updateTarget`, `updateTargetStatus` (registra em `activity_logs`)

Todas com `requireSupabaseAuth`. RLS já cobre escopo por papel.

### Rotas (TanStack Router)
- `/_authenticated/missions/index.tsx` — tabela (substitui stub atual)
- `/_authenticated/missions/new.tsx` — formulário
- `/_authenticated/missions/$missionId.tsx` — layout com tabs (Visão Geral · {target_label}s · Documento-base · Timeline · Jornada · Comparativo)
- `/_authenticated/missions/$missionId/index.tsx` — Visão Geral
- `/_authenticated/missions/$missionId/targets.tsx` — toggle tabela/kanban
- `/_authenticated/missions/$missionId/targets.$targetId.tsx` — card com 6 abas (só Visão Geral funcional)

### Componentes
- `components/missions/mission-table.tsx`, `mission-form.tsx`
- `components/targets/target-table.tsx`
- `components/targets/target-kanban.tsx` (12 colunas, drag-and-drop)
- `components/targets/target-card.tsx` (card do kanban)
- `components/targets/target-tabs.tsx` (drawer/página de detalhe)
- `components/targets/new-target-dialog.tsx` (form consultor)
- `components/targets/status-badge.tsx` (consome tokens)
- `components/targets/priority-badge.tsx`

### Dependências
- `@dnd-kit/core` + `@dnd-kit/sortable` (instalar via `bun add`)

### Design system (`src/styles.css`)
- Adicionar os 11 tokens de status + variantes em ambos os modos (claro/escuro)
- Manter Inter + paleta oklch já definida

### Activity logs
- `updateTargetStatus` insere registro em `activity_logs` com `{ entity: 'target', entity_id, action: 'status_changed', from, to, actor_id }`

### Permissões na UI
- `superadmin`: tudo
- `contractor`: vê/edita suas missões
- `analyst`: vê/edita missões em que está atribuído (`mission_analysts`)
- Botões de criar/editar escondidos quando o papel não permite

## Fora do escopo (mantido)
- Documento-base e IA (Fase 3 — vou pedir `ANTHROPIC_API_KEY` quando começar)
- Blocos A-G (Fase 4)
- Timeline + Evidências (Fase 5)
- Jornada + Comparativo (Fase 6)
- Resend, change requests, transcrição, Google Drive (Fase 7)

## Entregável
- Criar missão com label customizável (default "Concorrente")
- Criar concorrentes com instagram/whatsapp/linkedin/prioridade/observações
- Alternar entre tabela e Kanban de 12 colunas coloridas
- Arrastar entre colunas → status atualiza + log gravado
- Abrir aba Visão Geral do concorrente
- Tudo respeitando RLS por papel

Ao aprovar, começo pela migração de schema.