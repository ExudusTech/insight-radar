## Plano — corrigir 8 findings do Security scan

### 1. Critical: `createMissionServer` sem role check (`src/lib/missions.functions.ts`)
Adicionar guard no topo do handler: chamar `has_role` para `contractor` e `superadmin` via `context.supabase`. Se nenhum: `throw new Error("Forbidden")`. Preserva o fluxo atual do `missionBriefingAssistant` (que já checa role antes de chamar).

### 2. Warning: vazamento de erro LLM (`src/lib/llm-router.ts`, `src/lib/ai-analysis.functions.ts`)
- Substituir `throw new Error(...rawBody.slice(0,300))` por `console.error(...)` server-side com detalhes completos, e `throw new Error("Serviço de IA temporariamente indisponível")` para o cliente.
- Aplicar nos dois arquivos, em todos os pontos que hoje incluem `rawBody`/`body` no erro.

### 3. Warning: vazamento de erro Resend (`src/lib/access-link.functions.ts`, `src/lib/invite-user.functions.ts`)
- Log `console.error("[Resend]", status, body)` no servidor.
- Substituir mensagem por `"Falha ao enviar email. Tente novamente."` nos dois arquivos.

### 4-8. Migration única para findings do Supabase
Uma migration cobrindo:
- **Storage `mission-documents` UPDATE**: `DROP POLICY mission_docs_update` e recriar com `USING` + `WITH CHECK` idênticos (`can_access_mission` no path do objeto).
- **Storage `mission-evidences` UPDATE**: mesma coisa para `mission_evidences_update`.
- **Policies com role `public` → `authenticated`**: recriar `briefing_insert`, `briefing_read` em `briefing_messages`; `profiles_coordinator_read` em `profiles`; `user_roles_coordinator_read` em `user_roles` — todas com `TO authenticated`, mantendo mesmas condições.

Antes de escrever a migration, ler as definições atuais dessas policies via `supabase--read_query` no `pg_policies` para preservar as condições exatas.

### Verificação
- `bunx tsgo --noEmit` após as edições de código.
- Após a migration, rodar `security--run_security_scan` para confirmar que os 8 findings caíram.

Nenhum comportamento funcional muda — apenas hardening.
