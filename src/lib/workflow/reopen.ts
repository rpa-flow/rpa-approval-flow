import type { InvoiceWorkflow, Prisma } from "@prisma/client";

/** Reassign the last step of the current, completed execution. The caller locks the invoice. */
export async function reopenInconsistentWorkflow(tx: Prisma.TransactionClient, execution: Pick<InvoiceWorkflow, "id" | "invoiceId" | "revision">) {
  const last = await tx.invoiceWorkflowTask.findFirst({
    where: { executionId: execution.id },
    orderBy: { step: { position: "desc" } },
    select: { stepId: true }
  });
  if (!last) return false;

  const where = { executionId: execution.id, stepId: last.stepId };
  const tasks = await tx.invoiceWorkflowTask.findMany({ where, select: { id: true, managerEmail: true } });
  const revision = execution.revision + 1;
  await tx.invoiceWorkflowTask.updateMany({ where, data: { completedAt: null, assignedAt: new Date() } });
  await tx.invoiceWorkflow.update({ where: { id: execution.id }, data: { status: "ACTIVE", completedAt: null, revision } });
  for (const task of tasks) {
    await tx.workflowNotification.create({ data: {
      taskId: task.id, deduplicationKey: `reopened:${task.id}:${revision}`, recipient: task.managerEmail,
      payload: { invoiceId: execution.invoiceId, executionId: execution.id, stepId: last.stepId, reason: "DADOS_INCONSISTENTES" }
    } });
  }
  return true;
}
