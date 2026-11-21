import type { Prisma } from "@prisma/client";

export const legacyInvoiceTypes: Prisma.InvoiceWhereInput = { OR: [{ documentType: "NFSE" }, { documentType: null }] };

/** Visibility follows the persisted review decision, not the invoice's age or value. */
export function invoicesAvailableForApproval(): Prisma.InvoiceWhereInput {
  return {
    OR: [
      { adminReview: null },
      { adminReview: { is: { status: "LIBERADA" } } }
    ]
  };
}

export function combineInvoiceWhere(
  where: Prisma.InvoiceWhereInput | undefined,
  visibility: Prisma.InvoiceWhereInput = invoicesAvailableForApproval()
): Prisma.InvoiceWhereInput {
  return where ? { AND: [where, visibility] } : visibility;
}
