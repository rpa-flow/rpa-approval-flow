import type { Prisma, WorkflowDocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function globalWorkflowTypes(managerId: string, db: Prisma.TransactionClient = prisma): Promise<WorkflowDocumentType[]> {
  const linked = await db.managerSupplier.findFirst({ where: { managerId }, select: { id: true } });
  const workflows = await db.approvalWorkflow.findMany({
    where: { activeVersion: { is: { status: "PUBLISHED", steps: { some: { consultationScope: "ALL", OR: [
      { responsibleManagers: { some: { managerId } } },
      ...(linked ? [{ responsibilityMode: "SUPPLIER_MANAGERS" as const }] : [])
    ] } } } } },
    select: { documentType: true }
  });
  return workflows.map(w => w.documentType);
}
