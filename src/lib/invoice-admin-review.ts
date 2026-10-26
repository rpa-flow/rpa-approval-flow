export const INVOICE_ADMIN_REVIEW_REASONS = {
  ZERO_VALUE: "VALOR_ZERADO",
  PREVIOUS_MONTH: "EMISSAO_ANTERIOR"
} as const;

type ValueInput = string | number | null | undefined;

type ReviewTriggerInput = {
  valorServico?: ValueInput;
  valorLiquido?: ValueInput;
  valorBaseCalculo?: ValueInput;
  dataEmissao?: string | Date | null;
};

function parseFiniteValue(value: ValueInput): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function getSaoPauloYearMonth(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("Não foi possível calcular o mês no fuso de São Paulo.");
  return `${year}-${month}`;
}

function parseInvoiceEmissionDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(`${trimmed}T12:00:00-03:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(trimmed)
    ? `${trimmed}-03:00`
    : trimmed;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function evaluateInvoiceAdminReview(input: ReviewTriggerInput, now = new Date()) {
  const referenceMonth = getSaoPauloYearMonth(now);
  const primaryValue = parseFiniteValue(input.valorServico)
    ?? parseFiniteValue(input.valorLiquido)
    ?? parseFiniteValue(input.valorBaseCalculo);
  const reasons: string[] = [];

  if (primaryValue === 0) reasons.push(INVOICE_ADMIN_REVIEW_REASONS.ZERO_VALUE);

  const emissionDate = parseInvoiceEmissionDate(input.dataEmissao);
  if (emissionDate && getSaoPauloYearMonth(emissionDate) < referenceMonth) {
    reasons.push(INVOICE_ADMIN_REVIEW_REASONS.PREVIOUS_MONTH);
  }

  return {
    reasons,
    referenceMonth,
    emissionDateValid: input.dataEmissao == null || input.dataEmissao === "" || emissionDate !== null,
    requiresAdminReview: reasons.length > 0
  };
}

function normalizeMoney(raw: string): string | null {
  let normalized = raw.replace(/\s/g, "");
  if (!/^\d[\d.,]*$/.test(normalized)) return null;

  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimalSeparator = comma > dot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = normalized.split(thousandsSeparator).join("");
    if (decimalSeparator === ",") normalized = normalized.replace(",", ".");
  } else if (comma >= 0) {
    normalized = normalized.replace(",", ".");
  } else if (dot >= 0 && /^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed.toFixed(2);
}

export function extractDescriptionTotal(description: string | null | undefined) {
  if (!description) return { value: null, evidence: null, ambiguous: false };

  const matches = Array.from(
    description.matchAll(/valor\s+total\s*(?:[:=\-]\s*)?(?:R\$\s*)?(\d[\d.,]*)/gi)
  ).map((match) => ({
    value: normalizeMoney(match[1]),
    evidence: match[0].trim()
  }));
  const validMatches = matches.filter((match) => match.value !== null);
  const distinctValues = Array.from(new Set(validMatches.map((match) => match.value)));

  if (distinctValues.length !== 1) {
    return { value: null, evidence: null, ambiguous: distinctValues.length > 1 };
  }

  const selected = validMatches[0];
  return { value: selected.value, evidence: selected.evidence, ambiguous: false };
}
