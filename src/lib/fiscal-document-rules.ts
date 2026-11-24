import type { Invoice, Prisma } from "@prisma/client";

type LegacyProcessing = Pick<Invoice, "status" | "statusProcessamento">;

export function legacyProcessingUnresolved(invoice: LegacyProcessing) {
  return invoice.statusProcessamento === "PROCESSANDO" ||
    (invoice.status === "APROVADO" && invoice.statusProcessamento === "ERRO");
}

const processingResultFields = new Set([
  "status", "statusProcessamento", "processada", "codigoDelphi", "dataLancamentoDelphi",
  "statusIntegracaoDelphi", "observacaoValidacao", "reason"
]);

export function isLegacyProcessingResult(status: Invoice["status"] | undefined, fields: string[] = []) {
  return (status === "PROCESSADO" || status === "DADOS_INCONSISTENTES") &&
    fields.every(field => processingResultFields.has(field));
}

export const effectiveCteSubstitution = {
  kind: "SUBSTITUTES_CTE", sourceVersion: {
    state: "CURRENT", invoice: { documentType: "CTE", fiscalStatus: "AUTHORIZED" }
  }
} satisfies Prisma.FiscalDocumentReferenceWhereInput;

export function fiscalIssueDate(value: string | null) {
  if (!value) return null;
  const parsed = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/);
  if (!parsed) return null;
  const [, year, month, day, hour, minute, second, zone, offsetHour, offsetMinute] = parsed;
  const y = Number(year);
  const m = Number(month);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (y < 1 || m < 1 || m > 12 || Number(day) < 1 || Number(day) > daysInMonth[m - 1] ||
    Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 ||
    (zone !== "Z" && (Number(offsetHour) > 14 || Number(offsetMinute) > 59 ||
      (Number(offsetHour) === 14 && Number(offsetMinute) !== 0)))) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
