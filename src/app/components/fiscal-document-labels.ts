import type { ProtocolStatus } from "@/lib/fiscal-document-parser";
import type { DocumentType } from "@/lib/workflow/field-catalog";

export const DOCUMENT_TYPE_LABEL = { NFSE: "NFS-e", NFE: "NF-e", CTE: "CT-e" } satisfies Record<DocumentType, string>;
export const FISCAL_STATUS_LABEL = {
  AUTHORIZED: "Autorizado no XML",
  CANCELLED: "Cancelado no XML",
  NOT_AUTHORIZED: "Não autorizado no XML",
  UNKNOWN: "Situação fiscal inconclusiva"
} satisfies Record<ProtocolStatus, string>;
export const WORKFLOW_STATUS_LABEL = { WAITING: "Aguardando configuração", ACTIVE: "Em aprovação", BLOCKED: "Aprovação bloqueada", COMPLETED: "Aprovação concluída" };
export const REVIEW_STATUS_LABEL = { PENDENTE: "Revisão pendente", LIBERADA: "Revisão concluída", IGNORADA: "Ignorada" };
const REVIEW_REASON_LABEL: Record<string, string> = {
  VALOR_ZERADO: "Valor zerado", EMISSAO_ANTERIOR: "Emissão anterior ao mês corrente",
  EMPRESA_PENDENTE: "Empresa pendente", FORNECEDOR_PENDENTE: "Fornecedor pendente",
  SITUACAO_FISCAL_PENDENTE: "Situação fiscal pendente", DADOS_FISCAIS_INCOMPLETOS: "Dados fiscais incompletos",
  CONFLITO_XML: "XML divergente", CTE_SUBSTITUIDO: "CT-e substituído"
};

export function reviewReasonLabel(reason: string) {
  return REVIEW_REASON_LABEL[reason] ?? reason.toLowerCase().replaceAll("_", " ");
}

export function formatFiscalDecimal(value: string | number | null | undefined, currency = false) {
  if (value == null) return null;
  const raw = String(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) return raw;
  const [, sign, integral, fraction = ""] = match;
  const whole = integral.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimals = currency ? fraction.padEnd(2, "0") : fraction;
  return `${sign}${currency ? "R$\u00a0" : ""}${whole}${decimals ? `,${decimals}` : ""}`;
}
