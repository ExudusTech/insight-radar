# Radar de Mercado IA — Plano de Construção

Esta é uma plataforma SaaS extensa (10 módulos, ~10 tabelas, 5 Edge Functions, 3 perfis, dezenas de telas). Não é viável entregar tudo de uma única vez com qualidade. Proponho construir em **fases incrementais**, cada uma entregando valor utilizável. Você aprova este plano e depois libera as fases na ordem (ou ajusta prioridades).

## Decisões e premissas

- **Stack real do template:** TanStack Start + React 19 + Tailwind v4 + shadcn/ui. Vou usar isso (não Vite+React Router puro). O backend será **Lovable Cloud** (Supabase gerenciado) — nada muda funcionalmente para você.
- **Server logic:** TanStack server functions + server routes para webhooks/IA. **Não** uso Supabase Edge Functions (o template moderno usa server functions nativas, mais rápidas e tipadas).
- **IA:** Vou usar **Lovable AI Gateway** (Claude via gateway, sem você precisar gerenciar chave Anthropic). Modelos equivalentes: `google/gemini-3-flash-preview` para extração rápida e `google/gemini-2.5-pro` para análise. Se preferir Claude direto via Anthropic, me diga e configuro com sua chave.
- **Email:** Lovable Emails (built-in, sem Resend). Se preferir Resend, me avise.
- **Google Drive:** Deixo a integração como **fase posterior** (requer OAuth por usuário). Nas fases iniciais, anexos ficam no Supabase Storage.
- **Idioma da UI:** Português (pt-BR).

## Fases propostas

### Fase 1 — Fundação (entrego primeiro)
- Lovable Cloud habilitado
- Design system completo (tokens Inter, paleta exata, variants premium B2B)
- Schema completo do Postgres (10 tabelas, RLS, roles via `user_roles` + `has_role`, triggers de progresso)
- Auth (login/signup, página premium, 3 roles, profiles auto-criados)
- Layout principal: sidebar dinâmica por role + header com breadcrumb + roteamento protegido
- Seed do caso piloto (3 usuários, 1 missão, 6 alvos)

### Fase 2 — Missões + Alvos
- CRUD de missões (lista, cards, filtros, cadastro completo, estados)
- CRUD de alvos com 14 status, ficha com 6 abas (apenas Visão Geral funcional), Kanban drag-and-drop
- Dashboards básicos (Superadmin + Contratante)

### Fase 3 — Documento-base + IA de extração
- Upload (Supabase Storage)
- Server function `extract-document` (Lovable AI)
- Tela de revisão de extração + congelamento + versionamento

### Fase 4 — Coleta Guiada (7 blocos A–G)
- Formulário dinâmico, indicador de completude por bloco
- Todos os campos especificados, salvando em `collection_data`

### Fase 5 — Timeline + Evidências
- Timeline vertical por alvo com ícones por tipo
- Upload de evidências, galeria com filtros

### Fase 6 — Jornada + Comparativo + IA estratégica
- Steppers (18 etapas missão / 16 etapas alvo) com avanço automático via triggers
- Tabela comparativa + análise IA (`generate-comparative`)
- Sugestão IA de oportunidades (`suggest-analysis`)

### Fase 7 — Extras
- Solicitações de Mudança (fluxo completo)
- Relatórios (geração + PDF)
- Logs de atividade
- Chat "Perguntar à IA" contextual
- Alertas por email (cron)
- Transcrição de áudio
- Google Drive (se ainda fizer sentido)

## O que vou fazer **agora** (se você aprovar)

Apenas a **Fase 1**. Ao final você terá login funcional, navegação por role, design system pronto e banco modelado. Aí você diz "segue Fase 2" e eu continuo.

## Confirmações que preciso antes de começar

1. **OK usar Lovable AI Gateway (Gemini equivalentes ao Claude)** ou exigir Claude/Anthropic com chave própria?
2. **OK Lovable Emails** ou quer Resend?
3. **OK adiar Google Drive** para a Fase 7?
4. **OK começar pela Fase 1** conforme escopo acima?

Responda "pode seguir" (com qualquer ajuste) e inicio a Fase 1.
