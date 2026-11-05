import type { Prisma } from "@prisma/client";

/** A execução, a primeira atribuição e a auditoria compartilham a transação da nota. */
export async function startConfiguredWorkflow(tx: Prisma.TransactionClient, invoiceId: string, actor: { id?: string | null; name?: string | null; email?: string | null }, createdAt: Date, newlyCreated = false) {
  const workflow = await tx.approvalWorkflow.findUnique({ where: { documentType: "NFSE" }, include: { activeVersion: { include: { steps: { orderBy: { position: "asc" }, include: { manager: true }, take: 1 } } } } });
  if (!workflow?.activatedAt || (!newlyCreated && createdAt < workflow.activatedAt) || !workflow.activeVersion) return "LEGACY" as const;
  const version = workflow.activeVersion;
  const first = version.steps[0];
  const available = version.status === "PUBLISHED" && first && first.manager.ativo && first.manager.role !== "FORNECEDOR";
  const existing = await tx.invoiceWorkflow.findUnique({ where: { invoiceId } });
  if (existing) return "EXISTS" as const;
  const execution = await tx.invoiceWorkflow.create({ data: { invoiceId, versionId: version.id, status: available ? "ACTIVE" : "BLOCKED" } });
  if (available && first) {
    const task = await tx.invoiceWorkflowTask.create({ data: { executionId: execution.id, stepId: first.id, managerId: first.managerId, managerName: first.manager.nome, managerEmail: first.manager.email } });
    await tx.workflowNotification.create({ data: { taskId: task.id, deduplicationKey: `assignment:${task.id}`, recipient: task.managerEmail, payload: { invoiceId, executionId: execution.id, stepId: first.id } } });
  }
  await tx.noteAuditLog.create({ data: { invoiceId, actorId: actor.id, actorName: actor.name ?? "Sistema", actorEmail: actor.email, actionType: available ? "WORKFLOW_STARTED" : "WORKFLOW_BLOCKED", actionDescription: available ? "Nota encaminhada ao workflow" : "Workflow aguardando responsável disponível", afterData: { executionId: execution.id, versionId: version.id, stepId: first?.id ?? null, managerId: first?.managerId ?? null } } });
  return available ? "STARTED" as const : "BLOCKED" as const;
}
