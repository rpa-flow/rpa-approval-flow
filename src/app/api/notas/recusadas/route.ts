import { InvoiceStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { createInvoiceFromRequest } from "../create-invoice";

export async function POST(request: NextRequest) {
  return createInvoiceFromRequest(request, {
    initialStatus: InvoiceStatus.RECUSADO,
    sendCreatedEmail: false,
    auditDescription: "Nota criada já recusada sem envio de notificação"
  });
}
