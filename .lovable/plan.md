## Correções de Segurança Pré-Publicação

Vou corrigir os achados acionáveis via migração SQL e atualizar a memória de segurança para os itens que são falsos positivos ou aceitos por design.

### 1. Críticos (corrigir agora)

**a) `notifications_insert` muito permissiva**
A policy atual permite que qualquer usuário autenticado crie notificações para outros. Vou ajustar para permitir apenas:
- O próprio usuário (`user_id = auth.uid()`), ou
- Superadmins (via `has_role`).

Isso preserva o fluxo onde uma analista cria uma dúvida bloqueante e dispara notificação para o cliente/superadmin — esse insert hoje vem do cliente e precisa migrar para uma server function com `requireSupabaseAuth` que valide o vínculo via missão e use `supabaseAdmin` para o insert cross-user. Vou criar `src/lib/notifications.functions.ts` com `notifyMissionStakeholders` e atualizar `CollectionTab` para chamá-la em vez de inserir direto.

**b) `handle_new_user` — escalada de privilégio no signup**
O scanner ainda lista esse achado, mas o código atual já força `'analyst'` e ignora metadata. Vou marcar como `mark_as_fixed` (correção já aplicada em turno anterior).

### 2. Warnings (corrigir)

**c) `cr_insert` permite falsificar `requestor_id`**
Adicionar `AND (requestor_id IS NULL OR requestor_id = auth.uid())` ao WITH CHECK da policy `change_requests`.

### 3. Warnings (aceitos por design — `ignore` + atualizar memória)

**d) `shares_mission_with` expõe perfil de superadmin a colegas de missão**
Comportamento esperado: se um superadmin atua como analista/cliente numa missão, os teammates precisam ver o nome/email dele. Não é enumeração — exige uma linha real de membership.

**e) `Signed-In Users Can Execute SECURITY DEFINER Function`**
Necessário para a arquitetura RLS sem recursão (`has_role`, `can_access_mission`, `current_user_role`). Funções `PUBLIC`/`anon` já foram revogadas em turno anterior.

### 4. Dependências vulneráveis (`@tanstack/react-start` → undici)

Não há fix disponível compatível com o template atual sem subir major do TanStack Start. Vou registrar na memória de segurança como aceito até upgrade do framework e seguir.

### Plano de execução

1. Migração SQL:
   - Recriar policy `notifications_insert` (self + superadmin).
   - Recriar policy `cr_insert` com checagem de `requestor_id`.
2. Criar `src/lib/notifications.functions.ts` com `createNotificationForUser` (server fn, `requireSupabaseAuth`, valida via `can_access_mission`, insere via `supabaseAdmin`).
3. Atualizar `src/components/targets/collection-tab.tsx` para usar a server fn em vez de `supabase.from('notifications').insert(...)` cross-user.
4. `manage_security_finding`: `mark_as_fixed` para (a), (b), (c); `ignore` para (d), (e), e os 2 itens de supply chain.
5. `security--update_memory` documentando: SECURITY DEFINER por design, `shares_mission_with` aceito, undici/tanstack pendente upgrade.
6. Verificar build.

Depois disso, seguimos para a publicação.
