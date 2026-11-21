import { NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReadInvoice } from "@/lib/invoice-query";
import { parseNFSeXml } from "@/lib/nfse-parser";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const execution = await prisma.invoiceWorkflow.findUnique({
    where: { currentInvoiceId: params.id },
    include: {
      invoice: { include: { fornecedor: { select: { nome: true, cnpj: true } }, serviceEvaluation: true, adminReview: true } },
      tasks: { orderBy: { assignedAt: "asc" }, include: { step: { include: { fields: true } } } },
      version: { include: { steps: { where: { responsibleManagers: { some: { managerId: manager.id } }, consultationScope: "ALL" }, select: { id: true } } } }
    }
  });
  if (!execution) return NextResponse.json({ error: "Workflow não encontrado." }, { status: 404 });
  const currentTasks = execution.tasks.filter((task) => !task.completedAt);
  const current = currentTasks[0];
  const isAssigned = currentTasks.some((task) => task.managerId === manager.id);
  if (!(await canReadInvoice(manager, params.id))) return NextResponse.json({ error: "Workflow não encontrado." }, { status: 404 });
  const { xmlOriginal, adminReview, ...invoice } = execution.invoice;
  let descricaoServico: string | null = invoice.descricaoServico ?? invoice.nbsDescricao;
  if (xmlOriginal && (!invoice.documentType || invoice.documentType === "NFSE")) {
    try { descricaoServico = parseNFSeXml(xmlOriginal).descricaoServico ?? descricaoServico; } catch { /* Usa o valor persistido. */ }
  }
  const valorParaAprovacao = adminReview?.status === "LIBERADA" && adminReview.valorConfirmado !== null ? Number(adminReview.valorConfirmado) : invoice.documentType && invoice.documentType !== "NFSE" ? invoice.referenceValue?.toNumber() ?? null : Number(invoice.valorServico ?? invoice.valorLiquido ?? invoice.valorBaseCalculo ?? 0);
  return NextResponse.json({
    invoice: { ...invoice, descricaoServico, valorParaAprovacao },
    execution: { id: execution.id, versionId: execution.versionId, status: execution.status, revision: execution.revision },
    tasks: execution.tasks.map((task) => ({ id: task.id, managerName: task.managerName, stepName: task.step.name, assignedAt: task.assignedAt, completedAt: task.completedAt })),
    currentStep: current ? { id: current.step.id, name: current.step.name, managerId: current.managerId, fields: current.step.fields, requiresPurchaseOrder: current.step.requiresPurchaseOrder } : null,
    canComplete: (!adminReview || adminReview.status === "LIBERADA") && execution.status === "ACTIVE" && manager.role !== "FORNECEDOR" && isAssigned,
    canReject: (invoice.documentType === "NFE" || invoice.documentType === "CTE") && (!adminReview || adminReview.status === "LIBERADA") && execution.status === "ACTIVE" && manager.role !== "FORNECEDOR" && isAssigned,
    canResume: manager.role === "ADMIN" && execution.status === "BLOCKED"
  });
}

