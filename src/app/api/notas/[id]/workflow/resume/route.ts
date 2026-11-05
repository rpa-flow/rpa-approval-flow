import { NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processWorkflowNotifications } from "@/lib/workflow/notifications";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode retomar o workflow." }, { status: 403 });
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${params.id} FOR UPDATE`;
      const execution = await tx.invoiceWorkflow.findUnique({ where: { invoiceId: params.id }, include: { version: { include: { steps: { orderBy: { position: "asc" }, include: { manager: true }, take: 1 } } }, tasks: true } });
      if (!execution) return { code: 404, error: "Workflow não encontrado." };
      if (execution.status !== "BLOCKED" || execution.tasks.length) return { code: 409, error: "O workflow não está aguardando a primeira atribuição." };
      const first = execution.version.steps[0];
      if (!first || !first.manager.ativo || first.manager.role === "FORNECEDOR") return { code: 409, error: "O responsável configurado continua indisponível." };
      const changed = await tx.invoiceWorkflow.updateMany({ where: { id: execution.id, status: "BLOCKED", revision: execution.revision }, data: { status: "ACTIVE", revision: { increment: 1 } } });
      if (!changed.count) return { code: 409, error: "O workflow mudou. Atualize a página." };
      const task = await tx.invoiceWorkflowTask.create({ data: { executionId: execution.id, stepId: first.id, managerId: first.managerId, managerName: first.manager.nome, managerEmail: first.manager.email } });
      await tx.workflowNotification.create({ data: { taskId: task.id, deduplicationKey: `assignment:${task.id}`, recipient: task.managerEmail, payload: { invoiceId: params.id, executionId: execution.id, stepId: first.id } } });
      await tx.noteAuditLog.create({ data: { invoiceId: params.id, actorId: manager.id, actorName: manager.nome, actorEmail: manager.email, actionType: "WORKFLOW_RESUMED", actionDescription: "Administrador retomou a atribuição do workflow", afterData: { executionId: execution.id, stepId: first.id, managerId: first.managerId } } });
      return { code: 200, error: null };
    });
    if (outcome.error) return NextResponse.json({ error: outcome.error }, { status: outcome.code });
    try { await processWorkflowNotifications(); } catch { /* O aviso permanece pendente. */ }
    return NextResponse.json({ resumed: true });
  } catch (error) {
    console.error("[workflows:resume] Falha ao retomar", error);
    return NextResponse.json({ error: "Não foi possível retomar o workflow." }, { status: 500 });
  }
}
