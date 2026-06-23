## Correções de segurança antes do 1º publish

Antes da publicação, vamos corrigir as 2 falhas **críticas** e as 3 **warnings** detectadas pelo scanner. Tudo é resolvido em **uma única migration** + 1 pequeno ajuste de UI.

### 1. Crítico — Escalonamento de privilégio no signup
O trigger `handle_new_user` lê `role` de `raw_user_meta_data` (campo controlado pelo usuário). Qualquer pessoa pode chamar `supabase.auth.signUp({ data: { role: 'superadmin' } })` e virar superadmin.

**Fix:** reescrever o trigger para **sempre** atribuir `analyst` no cadastro. Promoções só por superadmin existente (via `user_roles_admin_all`, que já está correta).

### 2. Crítico — Todos os perfis legíveis por qualquer autenticado
A policy `profiles_list_for_authenticated USING (true)` expõe email, telefone, nome e organização de todos os usuários.

**Fix:**
- **Remover** `profiles_list_for_authenticated`.
- Manter `profiles_self_read` (cada user vê o próprio; superadmin vê todos).
- Criar policy `profiles_mission_teammates_read`: um usuário enxerga perfis de pessoas que compartilham missão com ele (contractor da missão + analistas atribuídos), usando uma função `security definer` `shares_mission_with(_other uuid)` para evitar recursão.
- Isso resolve também o warning **"RLS Policy Always True"** (que aponta justamente para essa policy permissiva).

UI: o `mission-form` usa um select de contractors/analysts. Como agora um analyst comum não pode listar todos os perfis, criamos uma server function `listAssignableProfiles` com `requireSupabaseAuth` + check `has_role(superadmin)` que usa `supabaseAdmin` apenas para popular o select — superadmin é o único que cria/edita missões hoje, então a restrição não quebra fluxo.

### 3. Warnings — SECURITY DEFINER functions executáveis por anon
`has_role`, `current_user_role`, `can_access_mission` e `set_updated_at` estão com `EXECUTE` aberto para `PUBLIC`/`anon`. Em policies elas são chamadas como `authenticated`, então `anon` não precisa.

**Fix:** `REVOKE EXECUTE ... FROM PUBLIC, anon` em cada uma; `GRANT EXECUTE ... TO authenticated` (e service_role) explicitamente. `set_updated_at` é trigger function — revoga de todos exceto owner.

### Resumo da migration

```text
1. CREATE OR REPLACE FUNCTION handle_new_user  -- sem leitura de raw_user_meta_data->role
2. DROP POLICY profiles_list_for_authenticated ON profiles
3. CREATE FUNCTION shares_mission_with(_other uuid) SECURITY DEFINER
4. CREATE POLICY profiles_mission_teammates_read ON profiles
5. REVOKE/GRANT EXECUTE nas 4 funções SECURITY DEFINER
```

### Mudanças de código
- `src/lib/profiles.functions.ts` — nova `listAssignableProfiles` (superadmin-only via `supabaseAdmin`).
- `src/components/missions/mission-form.tsx` — trocar query direta de `profiles` por chamada à server function.
- `src/start.ts` — já tem `attachSupabaseAuth`, sem mudança.

### Após corrigir
Rodar `security--run_security_scan` novamente, confirmar zero críticos, e seguir para o publish (definindo título/meta/OG do app primeiro).

### Fora do escopo
- Implementar 2FA, captcha no signup, ou rate-limit — não bloqueiam o publish.
- Mudar `SECURITY DEFINER` para `INVOKER`: as funções precisam de definer para ler `user_roles` sem recursão de RLS; revogar `anon` é a remediação aceita.