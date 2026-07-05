## Objetivo

Contornar o problema do link de convite consumido por scanners de email dando ao superadmin a opção de **definir uma senha inicial** no ato da criação (ou depois, via "Resetar senha"). O usuário faz o primeiro login com essa senha e é **obrigado a trocá-la** antes de acessar qualquer rota do app.

Isso convive com o fluxo atual de link por email — é uma alternativa, não uma substituição.

## Mudanças

### 1. Migration

Adicionar em `profiles`:
- `must_change_password boolean not null default false`

Sem novas policies (o próprio usuário já pode ler/atualizar seu profile).

### 2. `inviteUser` (server fn)

- Novo campo opcional no input: `initial_password?: string` (validar min 8, max 72 no server).
- Quando presente:
  - Criar o usuário no Auth com `password: initial_password` e `email_confirm: true` (já é hoje).
  - **Não** gerar link nem enviar email de acesso.
  - Marcar `profiles.must_change_password = true`.
  - Retornar `{ mode: 'initial_password', email }` para a UI mostrar confirmação.
- Quando ausente: comportamento atual (link por email).
- Log: `user_created_with_initial_password` (sem gravar a senha, óbvio).

### 3. Nova server fn `setInitialPassword({ userId, password })`

Para usar o mesmo mecanismo em usuários já existentes, no diálogo "Resetar senha":
- Middleware `requireSupabaseAuth` + checagem `has_role(superadmin)`.
- `supabaseAdmin.auth.admin.updateUserById(userId, { password })`.
- `profiles.must_change_password = true`.
- Log: `password_reset_by_admin`.

### 4. UI — `CreateUserCard` (users.tsx)

Adicionar um **toggle** "Definir senha inicial (usuário troca no 1º acesso)":
- Off (padrão): igual hoje, dispara email de convite.
- On: revela campo `password` + botão "gerar" (Web Crypto, 12 chars) + "copiar". Submit chama `inviteUser` com `initial_password`.
- Após sucesso do modo "senha inicial", o card mostra um bloco destacado com:
  - Email do usuário
  - Senha em texto (com botão copiar)
  - Aviso: "Compartilhe por canal seguro. O usuário será obrigado a trocá-la no primeiro login."

### 5. UI — Diálogo "Resetar senha" (users.tsx)

Hoje só oferece link. Adicionar 2ª aba/opção "Definir senha manualmente":
- Input de senha + gerar + copiar.
- Submit → `setInitialPassword`.
- Fecha mostrando a senha copiável e o mesmo aviso.

### 6. Force change no primeiro login

- No layout `_authenticated/route.tsx`: após confirmar `auth.user`, carregar `profiles.must_change_password` e, se `true`, redirecionar para `/reset-password?forced=1` (o único destino permitido até a troca).
- `/reset-password` já existe como rota pública; ajustar para:
  - Detectar `forced=1` (ou apenas checar `must_change_password` via `getUser`).
  - Título e mensagem: "Você precisa definir uma nova senha para continuar."
  - **Não** exibir botão "voltar".
  - Após `supabase.auth.updateUser({ password })` com sucesso, gravar `must_change_password = false` no profile do próprio usuário (RLS já permite), depois `navigate('/dashboard')`.
  - Se a senha nova for igual à atual, o Supabase rejeita — mostrar mensagem clara.

### 7. Logs adicionais

- `user_created_with_initial_password` (server, invite-user)
- `password_reset_by_admin` (server, novo endpoint)
- `password_changed_on_first_login` (client, no submit bem-sucedido do reset forçado)

## Arquivos

**Migration:** coluna `must_change_password` em `profiles`.

**Criar:**
- `src/lib/set-initial-password.functions.ts`

**Editar:**
- `src/lib/invite-user.functions.ts` — input opcional + branch novo
- `src/routes/_authenticated/users.tsx` — toggle no CreateUserCard, aba no diálogo de reset, exibição da senha copiável
- `src/routes/_authenticated/route.tsx` — checar `must_change_password` e redirecionar
- `src/routes/reset-password.tsx` — modo forçado + apagar flag ao concluir

## Fora de escopo

- Validador de força (deixamos só min 8; o usuário troca depois de qualquer forma).
- Expiração da senha inicial (não faz sentido, ele troca no 1º login).
- Auditar tentativas de burlar o redirect (o layout já cobre todas as rotas privadas).
