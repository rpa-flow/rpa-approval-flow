import type { Prisma } from "@prisma/client";

export type WorkflowAssignee = { id: string; nome: string; email: string; ativo: boolean; role: string };
export type AssignableWorkflowStep = {
  id: string;
  name: string;
  responsibilityMode: "SUPPLIER_MANAGERS" | "SELECTED_USERS";
  responsibleManagers: Array<{ manager: WorkflowAssignee }>;
};

export function uniqueActiveWorkflowAssignees(candidates: WorkflowAssignee[]): WorkflowAssignee[] {
  const unique = new Map<string, WorkflowAssignee>();
  for (const candidate of candidates) {
    if (candidate.ativo && (candidate.role === "ADMIN" || candidate.role === "GESTOR")) unique.set(candidate.id, candidate);
  }
  return [...unique.values()];
}

/** Resolve the immutable user list or the supplier-linked managers at assignment time. */
export async function resolveStepAssignees(tx: Prisma.TransactionClient, step: AssignableWorkflowStep, supplierId: string): Promise<WorkflowAssignee[]> {
  const candidates = step.responsibilityMode === "SELECTED_USERS"
    ? step.responsibleManagers.map(({ manager }) => manager)
    : (await tx.managerSupplier.findMany({
      where: { supplierId, manager: { ativo: true, role: { in: ["GESTOR", "ADMIN"] } } },
      select: { manager: { select: { id: true, nome: true, email: true, ativo: true, role: true } } }
    })).map(({ manager }) => manager);

  return uniqueActiveWorkflowAssignees(candidates);
}

export async function createWorkflowStepAssignments(tx: Prisma.TransactionClient, input: {
  executionId: string;
  invoiceId: string;
  stepId: string;
  assignees: WorkflowAssignee[];
}) {
  return Promise.all(input.assignees.map(async (assignee) => {
    const task = await tx.invoiceWorkflowTask.create({
      data: {
        executionId: input.executionId,
        stepId: input.stepId,
        managerId: assignee.id,
        managerName: assignee.nome,
        managerEmail: assignee.email
      }
    });
    await tx.workflowNotification.create({
      data: {
        taskId: task.id,
        deduplicationKey: `assignment:${task.id}`,
        recipient: task.managerEmail,
        payload: { invoiceId: input.invoiceId, executionId: input.executionId, stepId: input.stepId }
      }
    });
    return task;
  }));
}

