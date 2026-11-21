import { NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processWorkflowNotifications } from "@/lib/workflow/notifications";
import { createWorkflowStepAssignments, resolveStepAssignees } from "@/lib/workflow/assignees";
import { fiscalWorkflowProblem } from "@/lib/workflow/fiscal-eligibility";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode retomar o workflow." }, { status: 403 });
  let executionId: unknown;
  try {
    const text = await request.text();
    if (text) executionId = JSON.parse(text)?.executionId;
  } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${params.id} FOR UPDATE`;
      const execution = await tx.invoiceWorkflow.findUnique({ where: { currentInvoiceId: params.id }, include: { invoice: { select: { fornecedorId: true, documentType: true, adminReview: { select: { status: true } } } }, version: { include: { steps: { orderBy: { position: "asc" }, include: { responsibleManagers: { include: { manager: true } } }, take: 1 } } }, tasks: true } });
      if (!execution) return { code: 404, error: "Workflow não encontrado." };
      const fiscal = execution.invoice.documentType === "NFE" || execution.invoice.documentType === "CTE";
      const needsCycleId = fiscal || (!executionId && await tx.invoiceWorkflow.count({ where: { invoiceId: params.id } }) > 1);
      if ((executionId || needsCycleId) && executionId !== execution.id) return { code: 409, error: "O ciclo mudou. Atualize a nota." };
      if (execution.invoice.adminReview && execution.invoice.adminReview.status !== "LIBERADA") return { code: 409, error: "Documento em revisão." };
      if (fiscal) {
        const problem = await fiscalWorkflowProblem(tx, params.id);
        if (problem) return { code: 409, error: problem };
      }
      if (execution.status !== "BLOCKED" || execution.tasks.length) return { code: 409, error: "O workflow não está aguardando a primeira atribuição." };
      const first = execution.version.steps[0];
      if (!first) return { code: 409, error: "A primeira etapa não está configurada." };
      const assignees = await resolveStepAssignees(tx, first, execution.invoice.fornecedorId);
      if (!assignees.length) return { code: 409, error: "A etapa continua sem responsáveis ativos para este fornecedor." };
      const changed = await tx.invoiceWorkflow.updateMany({ where: { id: execution.id, status: "BLOCKED", revision: execution.revision }, data: { status: "ACTIVE", revision: { increment: 1 } } });
      if (!changed.count) return { code: 409, error: "O workflow mudou. Atualize a página." };
      await createWorkflowStepAssignments(tx, { executionId: execution.id, invoiceId: params.id, stepId: first.id, assignees });
      await tx.noteAuditLog.create({ data: { invoiceId: params.id, actorId: manager.id, actorName: manager.nome, actorEmail: manager.email, actionType: "WORKFLOW_RESUMED", actionDescription: "Administrador retomou a atribuição do workflow", afterData: { executionId: execution.id, stepId: first.id, managerIds: assignees.map((assignee) => assignee.id) } } });
      return { code: 200, error: null };
    });
    if (outcome.error) return NextResponse.json({ error: outcome.error }, { status: outcome.code });
    try { await processWorkflowNotifications(); } catch { /* O aviso permanece pendente. */ }
    return NextResponse.json({ resumed: true });
  } catch (error) {
    console.error("[workflows:resume] Falha ao retomar", error);
    return NextResponse.json({ error: "Não foi possível retomar o workflow." }, { status: 500 });
  }
}

