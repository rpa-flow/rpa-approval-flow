import { prisma } from "@/lib/prisma";

/** Consulta global de NFS-e concedida pela versão vigente; não concede aprovação. */
export async function hasGlobalNfseWorkflowAccess(managerId: string): Promise<boolean> {
  const workflow = await prisma.approvalWorkflow.findFirst({ where: { documentType: "NFSE", activeVersion: { is: { status: "PUBLISHED", steps: { some: { managerId, consultationScope: "ALL" } } } } }, select: { id: true } });
  return Boolean(workflow);
}
