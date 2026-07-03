import type { Database } from "@/integrations/supabase/types";

export type TargetStatus = Database["public"]["Enums"]["target_status"];
export type TargetPriority = Database["public"]["Enums"]["target_priority"];
export type MissionStatus = Database["public"]["Enums"]["mission_status"];

export const TARGET_STATUS_ORDER: TargetStatus[] = [
  "not_started",
  "public_research",
  "first_contact_sent",
  "awaiting_response",
  "in_conversation",
  "call_scheduled",
  "call_done",
  "proposal_received",
  "price_identified",
  "collection_complete",
  "incomplete",
  "discarded",
];

export const TARGET_STATUS_LABEL: Record<TargetStatus, string> = {
  not_started: "Não iniciado",
  public_research: "Pesquisa pública",
  first_contact_sent: "Primeiro contato enviado",
  awaiting_response: "Aguardando resposta",
  in_conversation: "Em conversa",
  call_scheduled: "Call agendada",
  call_done: "Call realizada",
  proposal_received: "Proposta recebida",
  price_identified: "Preço identificado",
  collection_complete: "Coleta concluída",
  incomplete: "Incompleto",
  discarded: "Descartado",
};

/** maps status → CSS var prefix (matches tokens in src/styles.css) */
export const TARGET_STATUS_TOKEN: Record<TargetStatus, string> = {
  not_started: "nao-iniciado",
  public_research: "pesquisa",
  first_contact_sent: "primeiro-contato",
  awaiting_response: "aguardando",
  in_conversation: "em-conversa",
  call_scheduled: "call",
  call_done: "call",
  proposal_received: "proposta",
  price_identified: "preco",
  collection_complete: "concluido",
  incomplete: "incompleto",
  discarded: "descartado",
};

export function targetStatusStyle(status: TargetStatus) {
  const t = TARGET_STATUS_TOKEN[status];
  return {
    background: `var(--status-${t}-bg)`,
    color: `var(--status-${t}-fg)`,
    borderColor: `var(--status-${t}-bd)`,
  };
}

export const TARGET_PRIORITY_ORDER: TargetPriority[] = ["high", "medium", "low"];

export const TARGET_PRIORITY_LABEL: Record<TargetPriority, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export function targetPriorityStyle(p: TargetPriority) {
  const key = p === "high" ? "alta" : p === "medium" ? "media" : "baixa";
  return {
    background: `var(--priority-${key}-bg)`,
    color: `var(--priority-${key}-fg)`,
  };
}

export const MISSION_STATUS_LABEL: Record<MissionStatus, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  awaiting_approval: "Aguardando aprovação",
  approved: "Aprovada",
  pending_acceptance: "Aguardando analista",
  date_negotiation: "Negociando prazo",
  execution_started: "Execução iniciada",
  in_collection: "Em coleta",
  in_analysis: "Em análise",
  report_review: "Revisão de relatório",
  delivered: "Entregue",
  closed: "Encerrada",
  paused: "Pausada",
  cancelled: "Cancelada",
};

export const PRE_ACCEPTANCE_STATUSES: MissionStatus[] = [
  "draft",
  "in_review",
  "awaiting_approval",
  "pending_acceptance",
  "date_negotiation",
];

export function isPreAcceptance(status: MissionStatus) {
  return (PRE_ACCEPTANCE_STATUSES as string[]).includes(status);
}