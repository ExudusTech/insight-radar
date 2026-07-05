## 1. Login — mostrar/ocultar senha (`src/routes/auth.tsx`)

- Adicionar botão ícone dentro do `Input` de senha (olho / olho cortado — `Eye` / `EyeOff` do `lucide-react`) que alterna `type="password"` ↔ `type="text"`.
- Aplicar também no campo de senha do fluxo de signup, se existir na mesma tela.
- Sem mudança de lógica de auth.

## 2. Resetar senha do usuário (`/users`)

- Renomear a ação atual "Gerar link de acesso (1h)" para **"Resetar senha"** (mesmo `generateAccessLink` server fn — já usa recovery link válido por 1h que força nova senha em `/reset-password`).
- Ícone: `KeyRound` no lugar de `Link2`.
- Dialog resultante: manter link + copiar, e adicionar botão secundário **"Enviar por email"** que dispara `sendAccessEmail` para o mesmo usuário (evita duas ações separadas).
- Sem migration nem mudança de backend.

## 3. Refazer layout de `/users` — Cards em grid

Substituir a tabela por um grid responsivo de cards (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`), mantendo a paleta atual (bg `#060B14`, surface `#0D1526`, azul `#1D4ED8`, ciano `#06B6D4`).

### Estrutura de cada card

```text
┌───────────────────────────────────────────────┐
│ [Avatar]  Nome                         [⋯]    │
│           email · organização                 │
│                                               │
│ [Badge Role]  [Badge Status]  criado em ...   │
│                                               │
│ ─────────────────────────────────────────     │
│ Disponível para missões       [switch]        │  (só analyst)
│ Visão Estratégica             [switch]        │  (sempre)
│ ─────────────────────────────────────────     │
│ Role:   [Select ▾]                            │
│ [ Resetar senha ] [ Email ] [ Bloquear ]      │
└───────────────────────────────────────────────┘
```

Detalhes:
- Avatar circular 40px com inicial, borda sutil `border-white/5`.
- Header do card: nome em `font-semibold`, email/org em `text-xs text-muted-foreground`.
- Badges de role mantém as cores atuais (`ROLE_BADGE`); status vira dot colorido (verde = active, vermelho = blocked) + label.
- Toggles em linha com label à esquerda, `Switch` à direita, separados por `border-t border-border/50`.
- Rodapé de ações: `Select` de role ocupando linha inteira; abaixo, 3 botões em grid `grid-cols-3` (Resetar senha / Email / Bloquear-Ativar).
- Menu `⋯` (`DropdownMenu`) no canto superior direito para ações menos usadas: copiar email, copiar ID.
- Estado bloqueado: card ganha `opacity-70` e badge vermelho.

### Cabeçalho da página
- Título "Usuários" + contador (`{filtered.length} de {rows.length}`).
- Busca (mantida) + botão "Novo usuário" alinhados à direita.
- Filtros rápidos por role em `ToggleGroup` (Todos / Superadmin / Coordenador / Cliente / Analista).

### Estado vazio / loading
- Loading: skeleton de 6 cards.
- Vazio: card único centralizado com ícone e mensagem.

## Arquivos afetados

- `src/routes/auth.tsx` — toggle olho na senha.
- `src/routes/_authenticated/users.tsx` — rewrite do render (mantém queries/mutations existentes), rename ação para "Resetar senha", filtros por role.

Sem migrations, sem mudança de backend, sem novas dependências.
