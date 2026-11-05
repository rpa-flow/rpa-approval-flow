import { NextResponse } from "next/server";
import { getAllowedSupplierIds, getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasGlobalNfseWorkflowAccess } from "@/lib/workflow/access";

type Params = { params: { id: string } };

export async function GET(_: Request, { params }: Params) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id }, include: { adminReview: true } });
  if (!invoice) return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });
  if (invoice.adminReview && invoice.adminReview.status !== "LIBERADA") {
    return NextResponse.json({ error: "Nota indisponível no fluxo normal enquanto a revisão administrativa não for liberada." }, { status: 404 });
  }

  const allowedSupplierIds = getAllowedSupplierIds(manager);
  if (manager.role !== "ADMIN" && !allowedSupplierIds.includes(invoice.fornecedorId) && invoice.criadoPorId !== manager.id) {
    const assigned = manager.role === "GESTOR" && ((await hasGlobalNfseWorkflowAccess(manager.id)) || await prisma.invoiceWorkflow.findFirst({ where: { invoiceId: invoice.id, OR: [{ tasks: { some: { managerId: manager.id, completedAt: null } } }, { version: { steps: { some: { managerId: manager.id, consultationScope: "ALL" } } } }] }, select: { id: true } }));
    if (!assigned) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const [logs, evaluation] = await Promise.all([
    prisma.noteAuditLog.findMany({ where: { invoiceId: params.id }, orderBy: { createdAt: "asc" } }),
    prisma.serviceEvaluation.findUnique({ where: { invoiceId: params.id } })
  ]);

  const evaluationEvent = evaluation
    ? {
        id: `service-evaluation-${evaluation.id}`,
        actionType: "SERVICE_EVALUATION_RECORDED",
        actionDescription: `${evaluation.managerName} registrou a avaliação do serviço`,
        actorId: evaluation.managerId,
        actorName: evaluation.managerName,
        actorEmail: evaluation.managerEmail,
        createdAt: evaluation.createdAt,
        reason: null,
        comment: `Nota ${evaluation.rating}/5 | Risco ${evaluation.riskLevel} | Qualifica: ${evaluation.qualifica === null ? "-" : evaluation.qualifica ? "Sim" : "Não"}`
      }
    : null;

  const timeline = evaluationEvent ? [...logs, evaluationEvent] : logs;
  timeline.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  return NextResponse.json(timeline);
}
