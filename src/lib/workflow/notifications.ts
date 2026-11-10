import { prisma } from "@/lib/prisma";
import { sendApprovalRequestEmail } from "@/lib/email";

/** Envia um lote limitado. Uma interrupção durante o envio exige revisão antes de reenviar. */
export async function processWorkflowNotifications(limit = 20) {
  const now = new Date();
  const expired = await prisma.workflowNotification.findMany({ where: { status: "PROCESSING", leaseUntil: { lt: now } }, select: { id: true }, take: limit });
  for (const item of expired) {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.workflowNotification.updateMany({ where: { id: item.id, status: "PROCESSING", leaseUntil: { lt: now } }, data: { status: "UNCERTAIN", leaseUntil: null } });
      if (changed.count) await tx.workflowNotificationAttempt.create({ data: { notificationId: item.id, status: "UNCERTAIN", error: "Envio interrompido; resultado desconhecido." } });
    });
  }

  const pending = await prisma.workflowNotification.findMany({ where: { status: "PENDING", availableAt: { lte: now } }, orderBy: { createdAt: "asc" }, select: { id: true }, take: Math.max(1, Math.min(limit, 50)) });
  const results: Array<{ id: string; status: string }> = [];
  for (const item of pending) {
    const leaseUntil = new Date(Date.now() + 5 * 60 * 1000);
    const claimed = await prisma.workflowNotification.updateMany({ where: { id: item.id, status: "PENDING", availableAt: { lte: new Date() } }, data: { status: "PROCESSING", leaseUntil } });
    if (!claimed.count) continue;
    const notification = await prisma.workflowNotification.findUnique({ where: { id: item.id }, include: { task: { include: { execution: { include: { invoice: { include: { fornecedor: true } } } }, step: true } } } });
    if (!notification) continue;
    let status: "ACCEPTED" | "SIMULATED" | "UNCERTAIN" = "UNCERTAIN";
    let error: string | null = null;
    try {
      const invoice = notification.task.execution.invoice;
      const result = await sendApprovalRequestEmail({ invoiceId: invoice.id, invoiceNumber: invoice.numeroNota, codigoIdentificador: invoice.codigoIdentificador, supplierName: invoice.fornecedor.nome, recipients: [notification.recipient], extraMessage: `Etapa: ${notification.task.step.name}. Consulte a situação atual da nota ao acessar o sistema.` });
      status = result.simulated ? "SIMULATED" : "ACCEPTED";
    } catch {
      error = "Falha ao enviar; confirme o resultado antes de reenviar.";
    }
    await prisma.$transaction(async (tx) => {
      const changed = await tx.workflowNotification.updateMany({ where: { id: item.id, status: "PROCESSING", leaseUntil }, data: { status, leaseUntil: null } });
      if (changed.count) await tx.workflowNotificationAttempt.create({ data: { notificationId: item.id, status, error } });
    });
    results.push({ id: item.id, status });
  }
  return { results, expired: expired.length };
}
