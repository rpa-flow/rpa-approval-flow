import type { Prisma } from "@prisma/client";
import { effectiveCteSubstitution } from "../fiscal-document-rules";

export const ingestEnabled = (type: "NFE" | "CTE") =>
  (type === "NFE" ? process.env.NFE_INGEST_ENABLED : process.env.CTE_INGEST_ENABLED)?.trim().toLowerCase() === "true";

/** For enrollment or commands, the caller locks the Invoice row before checking. */
export async function fiscalWorkflowProblem(tx: Prisma.TransactionClient, id: string, requireEnabled = false) {
  const invoice = await tx.invoice.findUnique({ where: { id }, select: {
    documentType: true, company: { select: { active: true } }, fornecedorId: true, fiscalStatus: true,
    referenceValue: true, dataEmissao: true,
    documentVersions: { where: { state: { in: ["CURRENT", "CANDIDATE"] } }, select: { state: true } },
    incomingReferences: { where: effectiveCteSubstitution, take: 1, select: { id: true } },
    adminReview: { select: { status: true } }
  } });
  if (!invoice) return "Documento não encontrado.";
  if (!invoice.documentType || invoice.documentType === "NFSE") return null;
  if (requireEnabled && !ingestEnabled(invoice.documentType)) return "A ativação deste tipo está suspensa.";
  if (!invoice.company?.active || !invoice.fornecedorId) return "Resolva a empresa e o fornecedor antes da aprovação.";
  if (invoice.fiscalStatus !== "AUTHORIZED" || invoice.referenceValue === null || !invoice.dataEmissao) return "O XML vigente possui pendências fiscais.";
  if (!invoice.documentVersions.some(v => v.state === "CURRENT") || invoice.documentVersions.some(v => v.state === "CANDIDATE")) return "Resolva a versão do XML antes da aprovação.";
  if (invoice.incomingReferences.length) return "O CT-e original foi substituído.";
  if (invoice.adminReview && invoice.adminReview.status !== "LIBERADA") return "Documento retido para revisão administrativa.";
  return null;
}
