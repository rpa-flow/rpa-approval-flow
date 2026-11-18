import type { Prisma } from "@prisma/client";
import { createWorkflowStepAssignments, resolveStepAssignees } from "./assignees";

/** A execução, a primeira atribuição e a auditoria compartilham a transação da nota. */
export async function startConfiguredWorkflow(tx: Prisma.TransactionClient, invoiceId: string, actor: { id?: string | null; name?: string | null; email?: string | null }, createdAt: Date, newlyCreated = false) {
  const workflow = await tx.approvalWorkflow.findUnique({ where: { documentType: "NFSE" }, include: { activeVersion: { include: { steps: { orderBy: { position: "asc" }, include: { responsibleManagers: { include: { manager: true } } }, take: 1 } } } } });
  if (!workflow?.activatedAt || (!newlyCreated && createdAt < workflow.activatedAt) || !workflow.activeVersion) return "LEGACY" as const;
  const version = workflow.activeVersion;
  const first = version.steps[0];
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { fornecedorId: true } });
  const assignees = version.status === "PUBLISHED" && first && invoice ? await resolveStepAssignees(tx, first, invoice.fornecedorId) : [];
  const available = Boolean(first && assignees.length > 0);
  const existing = await tx.invoiceWorkflow.findUnique({ where: { invoiceId } });
  if (existing) return "EXISTS" as const;
  const execution = await tx.invoiceWorkflow.create({ data: { invoiceId, versionId: version.id, status: available ? "ACTIVE" : "BLOCKED" } });
  if (available && first) await createWorkflowStepAssignments(tx, { executionId: execution.id, invoiceId, stepId: first.id, assignees });
  await tx.noteAuditLog.create({ data: { invoiceId, actorId: actor.id, actorName: actor.name ?? "Sistema", actorEmail: actor.email, actionType: available ? "WORKFLOW_STARTED" : "WORKFLOW_BLOCKED", actionDescription: available ? "Nota encaminhada ao workflow" : "Workflow aguardando responsável disponível", afterData: { executionId: execution.id, versionId: version.id, stepId: first?.id ?? null, managerIds: assignees.map((assignee) => assignee.id), responsibilityMode: first?.responsibilityMode ?? null } } });
  return available ? "STARTED" as const : "BLOCKED" as const;
}

