import { NextResponse } from "next/server";
import { getAllowedSupplierIds, getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasGlobalNfseWorkflowAccess } from "@/lib/workflow/access";
import { parseNFSeXml } from "@/lib/nfse-parser";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const execution = await prisma.invoiceWorkflow.findUnique({
    where: { invoiceId: params.id },
    include: {
      invoice: { include: { fornecedor: { select: { nome: true, cnpj: true } }, serviceEvaluation: true, adminReview: true } },
      tasks: { orderBy: { assignedAt: "asc" }, include: { step: { include: { fields: true } } } },
      version: { include: { steps: { where: { managerId: manager.id, consultationScope: "ALL" }, select: { id: true } } } }
    }
  });
  if (!execution) return NextResponse.json({ error: "Workflow não encontrado." }, { status: 404 });
  const current = execution.tasks.find((task) => !task.completedAt);
  const allowed = manager.role === "ADMIN" || current?.managerId === manager.id || execution.version.steps.length > 0 || getAllowedSupplierIds(manager).includes(execution.invoice.fornecedorId) || execution.invoice.criadoPorId === manager.id || (manager.role === "GESTOR" && await hasGlobalNfseWorkflowAccess(manager.id));
  if (!allowed) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  if (execution.invoice.adminReview && execution.invoice.adminReview.status !== "LIBERADA") return NextResponse.json({ error: "Nota retida para revisão administrativa." }, { status: 404 });
  const { xmlOriginal, adminReview, ...invoice } = execution.invoice;
  let descricaoServico: string | null = invoice.descricaoServico ?? invoice.nbsDescricao;
  if (xmlOriginal) {
    try { descricaoServico = parseNFSeXml(xmlOriginal).descricaoServico ?? descricaoServico; } catch { /* Usa o valor persistido. */ }
  }
  const valorParaAprovacao = adminReview?.status === "LIBERADA" && adminReview.valorConfirmado !== null ? Number(adminReview.valorConfirmado) : Number(invoice.valorServico ?? invoice.valorLiquido ?? invoice.valorBaseCalculo ?? 0);
  return NextResponse.json({
    invoice: { ...invoice, descricaoServico, valorParaAprovacao },
    execution: { id: execution.id, versionId: execution.versionId, status: execution.status, revision: execution.revision },
    tasks: execution.tasks.map((task) => ({ id: task.id, managerName: task.managerName, stepName: task.step.name, assignedAt: task.assignedAt, completedAt: task.completedAt })),
    currentStep: current ? { id: current.step.id, name: current.step.name, managerId: current.managerId, fields: current.step.fields, requiresPurchaseOrder: current.step.requiresPurchaseOrder } : null,
    canComplete: execution.status === "ACTIVE" && manager.role !== "FORNECEDOR" && current?.managerId === manager.id,
    canResume: manager.role === "ADMIN" && execution.status === "BLOCKED"
  });
}
