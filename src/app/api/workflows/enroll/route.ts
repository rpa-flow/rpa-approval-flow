import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enrollmentError } from "@/lib/workflow/enrollment";
import { invoicesAvailableForApproval } from "@/lib/invoice-admin-review-access";
import { processWorkflowNotifications } from "@/lib/workflow/notifications";

const selectionSchema = z.object({ invoiceIds: z.array(z.string().min(1)).min(1).max(100).refine((ids) => new Set(ids).size === ids.length, "Notas duplicadas.") }).strict();

export async function POST(request: NextRequest) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode encaminhar notas." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  const parsed = selectionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Seleção inválida.", details: parsed.error.flatten() }, { status: 400 });
  const results: Array<{ invoiceId: string; success: boolean; error?: string }> = [];
  for (const invoiceId of parsed.data.invoiceIds) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;
        const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { adminReview: true, workflowExecution: true } });
        if (!invoice) return { invoiceId, success: false, error: "Nota não encontrada." };
        const reason = enrollmentError(invoice);
        if (reason) return { invoiceId, success: false, error: reason };
        const eligible = await tx.invoice.findFirst({ where: { id: invoiceId, AND: [invoicesAvailableForApproval()] }, select: { id: true } });
        if (!eligible) return { invoiceId, success: false, error: "A nota exige revisão administrativa." };
        if (invoice.documentType && invoice.documentType !== "NFSE") return { invoiceId, success: false, error: "Tipo de documento não suportado." };
        const workflow = await tx.approvalWorkflow.findUnique({ where: { documentType: "NFSE" }, include: { activeVersion: { include: { steps: { orderBy: { position: "asc" }, include: { manager: true }, take: 1 } } } } });
        const version = workflow?.activeVersion;
        const step = version?.steps[0];
        if (!version || version.status !== "PUBLISHED" || !step) return { invoiceId, success: false, error: "Não há workflow NFS-e publicado." };
        if (!step.manager.ativo || step.manager.role === "FORNECEDOR") return { invoiceId, success: false, error: "O responsável da primeira etapa está indisponível." };
        const execution = await tx.invoiceWorkflow.create({ data: { invoiceId, versionId: version.id } });
        const task = await tx.invoiceWorkflowTask.create({ data: { executionId: execution.id, stepId: step.id, managerId: step.manager.id, managerName: step.manager.nome, managerEmail: step.manager.email } });
        await tx.workflowNotification.create({ data: { taskId: task.id, deduplicationKey: `assignment:${task.id}`, recipient: task.managerEmail, payload: { invoiceId, executionId: execution.id, stepId: step.id } } });
        await tx.noteAuditLog.create({ data: { invoiceId, actorId: manager.id, actorName: manager.nome, actorEmail: manager.email, actionType: "WORKFLOW_STARTED", actionDescription: "Nota encaminhada ao workflow", afterData: { executionId: execution.id, versionId: version.id, stepId: step.id, managerId: step.manager.id } } });
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
