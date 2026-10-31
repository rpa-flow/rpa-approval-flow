import { Prisma } from "@prisma/client";

function saoPauloMonthStart(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("Não foi possível calcular o mês no fuso de São Paulo.");
  return new Date(`${year}-${month}-01T00:00:00.000-03:00`);
}

export function zeroEffectiveValueWhere(): Prisma.InvoiceWhereInput {
  return {
    OR: [
      { valorServico: 0 },
      { AND: [{ valorServico: null }, { valorLiquido: 0 }] },
      { AND: [{ valorServico: null }, { valorLiquido: null }, { valorBaseCalculo: 0 }] }
    ]
  };
}

export function unreviewedInvoiceAdminReviewWhere(now = new Date()): Prisma.InvoiceWhereInput {
  const monthStart = saoPauloMonthStart(now);
  return {
    adminReview: null,
    OR: [
      zeroEffectiveValueWhere(),
      { dataEmissao: { lt: monthStart } }
    ]
  };
}

export function invoicesAvailableForApproval(now = new Date()): Prisma.InvoiceWhereInput {
  const monthStart = saoPauloMonthStart(now);
  const zeroEffectiveValue = zeroEffectiveValueWhere();

  return {
    OR: [
      { adminReview: { is: { status: "LIBERADA" } } },
      {
        AND: [
          { adminReview: null },
          { NOT: zeroEffectiveValue },
          {
            OR: [
              { dataEmissao: null },
              { dataEmissao: { gte: monthStart } }
            ]
          }
        ]
      }
    ]
  };
}

export function combineInvoiceWhere(
  where: Prisma.InvoiceWhereInput | undefined,
  visibility: Prisma.InvoiceWhereInput = invoicesAvailableForApproval()
): Prisma.InvoiceWhereInput {
  return where ? { AND: [where, visibility] } : visibility;
}
