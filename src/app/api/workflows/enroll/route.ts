import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enrollmentError } from "@/lib/workflow/enrollment";
import { invoicesAvailableForApproval } from "@/lib/invoice-admin-review-access";
import { processWorkflowNotifications } from "@/lib/workflow/notifications";
import { createWorkflowStepAssignments, resolveStepAssignees } from "@/lib/workflow/assignees";

const selectionSchema = z.object({
  invoiceIds: z.array(z.string().min(1)).min(1).max(100).optional(),
  selections: z.array(z.object({ invoiceId: z.string().min(1), stepId: z.string().min(1).optional() }).strict()).min(1).max(100).optional()
}).strict().refine((data) => Boolean(data.invoiceIds?.length || data.selections?.length) && Boolean(data.invoiceIds?.length) !== Boolean(data.selections?.length), "Informe invoiceIds ou selections.")
  .refine((data) => {
    const ids = data.selections?.map((item) => item.invoiceId) ?? data.invoiceIds ?? [];
    return new Set(ids).size === ids.length;
  }, "Notas duplicadas.");

export async function POST(request: NextRequest) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode encaminhar notas." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  const parsed = selectionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Seleção inválida.", details: parsed.error.flatten() }, { status: 400 });
  const selections: Array<{ invoiceId: string; stepId?: string }> = parsed.data.selections ?? parsed.data.invoiceIds!.map((invoiceId) => ({ invoiceId }));
  const results: Array<{ invoiceId: string; success: boolean; error?: string }> = [];
  for (const selection of selections) {
    const { invoiceId } = selection;
    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;
        const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { adminReview: true, workflowExecution: true } });
        if (!invoice) return { invoiceId, success: false, error: "Nota não encontrada." };
        const reason = enrollmentError(invoice, { stepId: selection.stepId });
        if (reason) return { invoiceId, success: false, error: reason };
        const eligible = await tx.invoice.findFirst({ where: { id: invoiceId, AND: [invoicesAvailableForApproval()] }, select: { id: true } });
        if (!eligible) return { invoiceId, success: false, error: "A nota exige revisão administrativa." };
        if (invoice.documentType && invoice.documentType !== "NFSE") return { invoiceId, success: false, error: "Tipo de documento não suportado." };
        const workflow = await tx.approvalWorkflow.findUnique({ where: { documentType: "NFSE" }, include: { activeVersion: { include: { steps: { orderBy: { position: "asc" }, include: { responsibleManagers: { include: { manager: true } } } } } } } });
        const version = workflow?.activeVersion;
        if (!version || version.status !== "PUBLISHED" || !version.steps.length) return { invoiceId, success: false, error: "Não há workflow NFS-e publicado." };
        const isInconsistent = invoice.status === "DADOS_INCONSISTENTES";
        const step = isInconsistent
          ? version.steps.find((candidate) => candidate.id === selection.stepId)
          : version.steps[0];
        if (!step) return { invoiceId, success: false, error: isInconsistent ? "A etapa selecionada não pertence à versão publicada." : "O workflow publicado não possui primeira etapa." };
        const assignees = await resolveStepAssignees(tx, step, invoice.fornecedorId);
        if (!assignees.length) return { invoiceId, success: false, error: `A etapa ${step.name} não tem responsáveis ativos para este fornecedor.` };
        const execution = await tx.invoiceWorkflow.create({ data: { invoiceId, versionId: version.id } });
        await createWorkflowStepAssignments(tx, { executionId: execution.id, invoiceId, stepId: step.id, assignees });
        if (isInconsistent) {
          await tx.invoice.update({ where: { id: invoiceId }, data: { status: "AGUARDANDO_APROVACAO", processada: false, statusProcessamento: "PENDENTE", responsavelValidacao: null, dataValidacao: null } });
          await tx.noteStatusHistory.create({ data: { invoiceId, actorId: manager.id, actorName: manager.nome, actorEmail: manager.email, previousStatus: invoice.status, newStatus: "AGUARDANDO_APROVACAO", reason: invoice.observacaoValidacao } });
        }
        await tx.noteAuditLog.create({ data: { invoiceId, actorId: manager.id, actorName: manager.nome, actorEmail: manager.email, actionType: "WORKFLOW_STARTED", actionDescription: isInconsistent ? `Nota inconsistente encaminhada diretamente à etapa ${step.name}` : "Nota encaminhada ao workflow", previousStatus: isInconsistent ? invoice.status : undefined, newStatus: isInconsistent ? "AGUARDANDO_APROVACAO" : undefined, afterData: { executionId: execution.id, versionId: version.id, stepId: step.id, stepName: step.name, managerIds: assignees.map((assignee) => assignee.id), responsibilityMode: step.responsibilityMode, ...(isInconsistent ? { reason: invoice.observacaoValidacao } : {}) } } });
        return { invoiceId, success: true };
      });
      results.push(result);
    } catch (error) {
      console.error("[workflows:enroll] Falha ao encaminhar nota", { invoiceId, error });
      results.push({ invoiceId, success: false, error: "Não foi possível encaminhar a nota. Atualize e tente novamente." });
    }
  }
  let notificationsPending = false;
  if (results.some((result) => result.success)) {
    try { await processWorkflowNotifications(); } catch { notificationsPending = true; }
  }
  return NextResponse.json({ results, notificationsPending });
}

