import { Prisma } from "@prisma/client";

export const invoicesAvailableForApproval: Prisma.InvoiceWhereInput = {
  OR: [
    { adminReview: null },
    { adminReview: { is: { status: "LIBERADA" } } }
  ]
};

export function combineInvoiceWhere(
  where: Prisma.InvoiceWhereInput | undefined,
  visibility: Prisma.InvoiceWhereInput = invoicesAvailableForApproval
): Prisma.InvoiceWhereInput {
  return where ? { AND: [where, visibility] } : visibility;
}
