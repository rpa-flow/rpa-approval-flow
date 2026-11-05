import type { Prisma } from "@prisma/client";

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
