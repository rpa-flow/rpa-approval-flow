import { prisma } from "@/lib/prisma";

/** Consulta global de NFS-e concedida pela versão vigente; não concede aprovação. */
export async function hasGlobalNfseWorkflowAccess(managerId: string): Promise<boolean> {
  const configuredUser = await prisma.approvalWorkflow.findFirst({ where: { documentType: "NFSE", activeVersion: { is: { status: "PUBLISHED", steps: { some: { responsibleManagers: { some: { managerId } }, consultationScope: "ALL" } } } } }, select: { id: true } });
  if (configuredUser) return true;
  const supplierBasedStep = await prisma.approvalWorkflow.findFirst({ where: { documentType: "NFSE", activeVersion: { is: { status: "PUBLISHED", steps: { some: { responsibilityMode: "SUPPLIER_MANAGERS", consultationScope: "ALL" } } } } }, select: { id: true } });
  if (!supplierBasedStep) return false;
  return Boolean(await prisma.managerSupplier.findFirst({ where: { managerId }, select: { id: true } }));
}

