import { InvoiceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  invoiceId: string;
  actionType: string;
  actorId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  previousStatus?: InvoiceStatus | null;
  newStatus?: InvoiceStatus | null;
  reason?: string | null;
  comment?: string | null;
  beforeData?: Prisma.InputJsonValue;
  afterData?: Prisma.InputJsonValue;
};

export async function createInvoiceAuditLog(input: AuditInput) {
  return prisma.noteAuditLog.create({
    data: {
      invoiceId: input.invoiceId,
      actionType: input.actionType,
      actorId: input.actorId,
      actorName: input.actorName,
      actorEmail: input.actorEmail,
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
      reason: input.reason,
      comment: input.comment,
      beforeData: input.beforeData,
      afterData: input.afterData
    }
  });
}
