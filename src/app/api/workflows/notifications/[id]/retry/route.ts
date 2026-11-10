import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processWorkflowNotifications } from "@/lib/workflow/notifications";

const schema = z.object({ confirmPossibleDuplicate: z.boolean(), reason: z.string().trim().min(1).max(500) }).strict();

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode reenviar avisos." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Informe o motivo do reenvio." }, { status: 400 });
  const result = await prisma.$transaction(async (tx) => {
    const notification = await tx.workflowNotification.findUnique({ where: { id: params.id }, include: { task: { include: { execution: true } } } });
    if (!notification) return { code: 404, error: "Aviso não encontrado." };
    if (!["FAILED", "UNCERTAIN", "SIMULATED"].includes(notification.status)) return { code: 409, error: "O aviso não está disponível para reenvio." };
    if (notification.status === "UNCERTAIN" && !parsed.data.confirmPossibleDuplicate) return { code: 400, error: "Confirme que o envio anterior pode ter sido entregue." };
    const changed = await tx.workflowNotification.updateMany({ where: { id: notification.id, status: notification.status }, data: { status: "PENDING", leaseUntil: null, availableAt: new Date() } });
    if (!changed.count) return { code: 409, error: "O aviso mudou. Atualize a lista." };
    await tx.noteAuditLog.create({ data: { invoiceId: notification.task.execution.invoiceId, actorId: manager.id, actorName: manager.nome, actorEmail: manager.email, actionType: "WORKFLOW_NOTIFICATION_RETRY", actionDescription: "Administrador solicitou reenvio de aviso", reason: parsed.data.reason, beforeData: { notificationId: notification.id, status: notification.status }, afterData: { status: "PENDING" } } });
    return { code: 200, error: null };
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.code });
  try { await processWorkflowNotifications(); } catch { /* O aviso permanece na fila. */ }
  return NextResponse.json({ queued: true });
}
