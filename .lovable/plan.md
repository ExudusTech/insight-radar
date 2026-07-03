## Objetivo
1. Cliente escolhe o nome da missão como primeiro passo — o briefing não sobrescreve mais o nome depois.
2. Cliente (contractor) e superadmin podem editar qualquer campo da missão **até o analista aceitar** (transição para `approved`/`execution_started`).
3. Depois do aceite, sinal visual claro para o cliente de que os campos travaram.

---

## 1. Pedir o nome antes de qualquer upload/preenchimento

Em `src/routes/_authenticated/missions.new.tsx`, adicionar uma etapa inicial (gate) antes das três abas (`Chat com IA`, `Enviar briefing`, `Formulário manual`):

- Tela única com input "Nome da missão" (obrigatório, `trim` não vazio) + botão "Continuar".
- Só depois de confirmar o nome, mostrar as três abas.
- Enquanto no gate, esconder o seletor de modo.
- Botão "Alterar nome" discreto ao lado do título quando as abas estão visíveis, para o usuário voltar ao gate se quiser.

Propagação do nome para os três modos:
- **Enviar briefing** (`handleFile`): substituir `name: "Nova missão"` pelo nome do gate.
- **Chat com IA** (`AiChatMode` → `createFromBriefing`): passar o nome do gate como override e ignorar `scope.mission_name`.
- **Formulário manual** (`MissionForm`): passar o nome como valor inicial do campo (mantém editável).

## 2. Não sobrescrever o nome via extração de briefing

Em `src/lib/missions.queries.ts`, dentro de `updateMissionFromExtraction`, remover a linha:
```ts
if (extracted.mission_name?.trim()) patch.name = extracted.mission_name.trim();
```
Objetivo, segmento, prazos, canais etc. continuam sendo extraídos e preenchidos automaticamente. Apenas o nome deixa de ser tocado.

O ícone de lápis do superadmin no header segue permitindo renomear depois.

## 3. Editabilidade pelo cliente até o aceite do analista

Enum real de `mission_status`:
```
draft, in_review, awaiting_approval, approved, execution_started,
in_collection, in_analysis, report_review, delivered, closed,
paused, cancelled, pending_acceptance, date_negotiation
```
Não existe `in_progress`. A "linha do aceite" é a transição para `approved` (ou direto `execution_started`, dependendo do fluxo). Antes disso, o cliente ainda pode ajustar.

Criar helper em `src/lib/target-status.ts` (ou no próprio route file, se preferir manter local):
```ts
export const PRE_ACCEPTANCE_STATUSES = [
  "draft",
  "in_review",
  "awaiting_approval",
  "pending_acceptance",
  "date_negotiation",
] as const;

export function isPreAcceptance(status: MissionStatus) {
  return (PRE_ACCEPTANCE_STATUSES as readonly string[]).includes(status);
}
```

Em `src/routes/_authenticated/missions.$missionId.index.tsx`, trocar:
```ts
const isDraft = mission.status === "draft";
const canEditBriefing = isDraft && (role === "contractor" || "superadmin");
const canEditDetails  = isDraft && (role === "contractor" || "superadmin");
```
por:
```ts
const preAcceptance = isPreAcceptance(mission.status);
const canEditBriefing = preAcceptance && (role === "contractor" || role === "superadmin");
const canEditDetails  = preAcceptance && (role === "contractor" || role === "superadmin");
```

RLS: nenhuma mudança. `missions_contractor_update` já permite ao contractor editar sua própria missão; `missions_superadmin_all` cobre o superadmin em qualquer status.

## 4. Sinal visual pós-aceite (cliente)

Quando `!preAcceptance` e o usuário for `contractor`, mostrar um aviso discreto acima do card "Detalhes" e do bloco de briefing:
- Alert `variant="default"` com ícone `Lock` + texto: "Missão em execução — os campos não podem mais ser alterados. Para ajustes, abra uma solicitação de mudança."
- Superadmin não vê esse aviso (segue tendo edição via ícone de lápis do nome e podendo agir no banco).

Isso evita a confusão de "por que não consigo editar?" sem esperar um PR futuro.

---

## Detalhes técnicos

**Arquivos alterados**
- `src/routes/_authenticated/missions.new.tsx` — gate de nome + propagação.
- `src/lib/missions.queries.ts` — retirar sobrescrita de `name` em `updateMissionFromExtraction`.
- `src/lib/target-status.ts` — export `PRE_ACCEPTANCE_STATUSES` + helper `isPreAcceptance`.
- `src/routes/_authenticated/missions.$missionId.index.tsx` — trocar `isDraft` por `isPreAcceptance` + banner de bloqueio para contractor.

**Fora de escopo**
- Não mexer no ícone de renomear do superadmin.
- Não mexer nas RLS.
- Não mexer nas policies de analista.
- Fluxo de "solicitação de mudança" (change request) já existe em outra tela; o banner só menciona.

## Diagrama de status vs. edição do cliente

```text
draft ─ in_review ─ awaiting_approval ─ pending_acceptance ─ date_negotiation
                          │  cliente EDITA                             │
                          ▼                                            ▼
                     approved / execution_started ─▶ in_collection ─▶ ... 
                          │  cliente READONLY + banner "Em execução"  │
```
