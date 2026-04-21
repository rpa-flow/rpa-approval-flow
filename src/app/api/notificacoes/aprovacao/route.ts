import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { approvalNotificationSchema } from "@/lib/validations";
import { sendApprovalRequestEmail } from "@/lib/email";
import { getSessionManager } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const manager = await getSessionManager();

  if (!manager) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const payload = await request.json();
  const parsed = approvalNotificationSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const invoice = await prisma.invoice.findFirst({
    where: parsed.data.invoiceId
      ? { id: parsed.data.invoiceId }
      : { codigoIdentificador: parsed.data.codigoIdentificador! },
    include: {
      fornecedor: {
        include: {
          managers: true,
          notificationConfig: true
        }
      }
    }
  });

  if (!invoice) {
    return NextResponse.json({ error: "Nota fiscal não encontrada." }, { status: 404 });
  }

  if (manager.role !== "ADMIN" && invoice.fornecedorId !== manager.supplierId) {
    return NextResponse.json({ error: "Acesso negado para esta nota." }, { status: 403 });
  }

  const managerEmails = invoice.fornecedor.managers.map((m) => m.email);
  const extraEmails = invoice.fornecedor.notificationConfig?.emailsExtras ?? [];
  const globalRule = await prisma.notificationRule.findFirst({ orderBy: { createdAt: "desc" } });

  const recipients = [...new Set([...managerEmails, ...extraEmails, globalRule?.destinatarioAdicional ?? ""].filter(Boolean))];

  if (!recipients.length) {
    return NextResponse.json(
      { error: "Fornecedor sem gestores e sem e-mails configurados para envio." },
      { status: 400 }
    );
  }

  await sendApprovalRequestEmail({
    invoiceNumber: invoice.numeroNota,
    codigoIdentificador: invoice.codigoIdentificador,
    supplierName: invoice.fornecedor.nome,
    recipients,
    extraMessage: parsed.data.extraMessage
  });

  const config = invoice.fornecedor.notificationConfig;
  if (config) {
    const now = new Date();
    const next = new Date(now);
    next.setDate(next.getDate() + config.recorrenciaDias);
    await prisma.supplierNotificationConfig.update({
      where: { id: config.id },
      data: {
        ultimoEnvioEm: now,
        proximoEnvioEm: next
      }
    });
  }

  return NextResponse.json({
    success: true,
    recipients,
    recorrenciaDias: invoice.fornecedor.notificationConfig?.recorrenciaDias ?? null,
    message: "E-mail de aprovação enviado com sucesso."
  });
}
