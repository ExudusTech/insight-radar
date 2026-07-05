## Diagnóstico

Só 4 tipos de eventos estão registrados no banco (`assistant_interaction`, `user_logout`, `mission_sent_for_acceptance`, `mission_created`). Existem ~30 mutações críticas no app que hoje não geram log — inclusive todas as ações administrativas e todas as chamadas de server function. "Rastreável" hoje é aspiracional; este plano fecha a lacuna.

## O que fazer

### 1. Helper de log no servidor

Criar `src/lib/activity-log.server.ts` com `logActivityServer(supabaseClient, params)` — mesma assinatura do helper de browser, mas escreve via cliente Supabase autenticado passado como parâmetro (usa o `context.supabase` do `requireSupabaseAuth`, mantém RLS/atribuição correta ao `auth.uid()`).

Motivo: server functions hoje mutam sem loggar. Um helper client-side não roda no worker.

### 2. Instrumentar server functions (`src/lib/*.functions.ts`)

Adicionar `logActivityServer` no fim de cada handler bem-sucedido:

| Arquivo | Ação | Detalhes principais |
|---|---|---|
| `invite-user.functions.ts` | `user_invited` | invited_user_id, email, role, email_sent |
| `access-link.functions.ts` (generate) | `password_reset_link_generated` | target_user_id, target_email, expires_at |
| `access-link.functions.ts` (sendAccessEmail) | `access_email_sent` | target_user_id, target_email |
| `mission-briefing.functions.ts` | `mission_briefing_generated` | mission_id, model, tokens |
| `mission-assistant.functions.ts` | `mission_assistant_call` | mission_id, target_id, model, tokens |
| `ai-analysis.functions.ts` | `ai_analysis_generated` | target_id, model, tokens, analysis_type |
| `report-request.functions.ts` | `report_requested` / `report_generated` | mission_id, report_id, model |
| `document-versions.functions.ts` | `document_version_created` / `document_frozen` | mission_id, version_id |
| `coordination-messages.functions.ts` | `coordination_message_sent` | mission_id, recipient_id |
| `missions.functions.ts` (todas as mutações) | `mission_created`, `mission_updated`, `mission_status_changed`, `mission_deleted`, `mission_analyst_assigned`, `mission_contractor_assigned` | mission_id + diff resumido |
| `notifications.functions.ts` | `notification_dispatched` | recipient_id, type |
| `llm-router-test.functions.ts` | (não logar — é debug) | — |

### 3. Instrumentar mutações admin no cliente (`src/routes/_authenticated/users.tsx`)

Adicionar `logActivity` nas mutações que hoje não são rastreadas:

- `toggleAccepts` → `analyst_availability_changed` (target_user_id, next)
- `toggleStrategic` → `strategic_access_changed` (target_user_id, next)
- `setRole` → `user_role_changed` (target_user_id, new_role)
- `toggleStatus` → `user_status_changed` (target_user_id, from, to)

Idem em `src/routes/_authenticated/clients.tsx` (se houver mutações — verificar durante execução).

### 4. Instrumentar mutações operacionais restantes no cliente

Auditar e adicionar log nos pontos que ainda não têm:

- `src/components/targets/target-detail-sheet.tsx` — mudanças de status, fase, prioridade (hoje só uma chamada; garantir cobertura de todos os `update`).
- `src/components/targets/collection-tab.tsx` — save de coleta / marcar completo.
- `src/components/documents/document-base-tab.tsx` — já loga upload/extract; adicionar `document_deleted` se existir.
- `src/routes/_authenticated/notificacoes.tsx` — `notification_marked_read` (se houver mutação).
- `src/routes/_authenticated/reports.tsx` — download/visualização (`report_viewed`, `report_downloaded`).
- Login bem-sucedido em `src/routes/auth.tsx` → `user_login` (hoje só logamos logout).

### 5. Enriquecer os detalhes já capturados

Padronizar payload de `details` para incluir sempre:
- `ip` e `user_agent` (nas mutações client-side, capturar `navigator.userAgent`; server-side, pegar de `request.headers`)
- Para updates: `changed_fields` com `{campo: {from, to}}` — usar snapshot antes/depois quando o handler já lê a row.
- Para chamadas de IA: `provider`, `model`, `tokens_in`, `tokens_out`, `cost_estimate` (o `llm-router` já retorna esses dados).

### 6. UI de Logs — melhorias mínimas para tornar utilizável

Em `src/routes/_authenticated/logs.tsx`:

- Substituir o `<select>` nativo do filtro "Ação" pelo `Select` do shadcn (consistência).
- Agrupar ações no filtro em categorias (Autenticação, Missão, Alvo, Documento, IA, Admin) — ajuda quando a lista crescer.
- Coluna extra "Detalhes" resumida (ex.: `model=gpt-5 · tokens=1240` para eventos de IA) para não exigir expandir cada linha.
- Botão "Exportar CSV" da página atual (útil para auditoria/compliance).
- Filtro por `entity_type` (mission / target / user / document / report).

### 7. Sem migration

O schema de `activity_logs` já é flexível (`action` string, `details` jsonb). Nenhuma mudança de banco necessária.

## Arquivos afetados

**Criar:**
- `src/lib/activity-log.server.ts`

**Editar (servidor):**
- `src/lib/invite-user.functions.ts`
- `src/lib/access-link.functions.ts`
- `src/lib/mission-briefing.functions.ts`
- `src/lib/mission-assistant.functions.ts`
- `src/lib/ai-analysis.functions.ts`
- `src/lib/report-request.functions.ts`
- `src/lib/document-versions.functions.ts`
- `src/lib/coordination-messages.functions.ts`
- `src/lib/missions.functions.ts`
- `src/lib/notifications.functions.ts`

**Editar (cliente):**
- `src/routes/_authenticated/users.tsx`
- `src/routes/auth.tsx` (login)
- `src/components/targets/target-detail-sheet.tsx`
- `src/components/targets/collection-tab.tsx`
- `src/routes/_authenticated/reports.tsx`
- `src/routes/_authenticated/logs.tsx` (UI)

## Fora de escopo

- Retenção/rotina de expurgo dos logs (definir só quando volume justificar).
- Exportação para SIEM externo.
- Assinatura/hash de integridade dos registros (se o requisito de compliance exigir, é uma etapa separada com migration).
