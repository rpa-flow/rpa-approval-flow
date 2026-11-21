import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fiscalWorkflowProblem } from "@/lib/workflow/fiscal-eligibility";

const schema = z.object({ executionId: z.string().min(1), revision: z.number().int().positive(), reason: z.string().trim().min(1).max(500) }).strict();

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role === "FORNECEDOR") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe ciclo, revisão e motivo da recusa." }, { status: 400 });
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${params.id} FOR UPDATE`;
    const i = await tx.invoice.findUnique({ where: { id: params.id }, select: { status: true, documentType: true, workflowExecution: {
      select: { id: true, status: true, revision: true, tasks: { where: { completedAt: null }, select: { managerId: true, stepId: true } } } } } });
    if (!i || (i.documentType !== "NFE" && i.documentType !== "CTE")) return { status: 404, error: "Documento não encontrado." };
    const e = i.workflowExecution;
    if (!e || e.id !== parsed.data.executionId || e.revision !== parsed.data.revision || e.status !== "ACTIVE" || i.status !== "AGUARDANDO_APROVACAO") return { status: 409, error: "O ciclo mudou. Atualize o documento." };
    if (!e.tasks.some(t => t.managerId === manager.id)) return { status: 403, error: "Somente um responsável da etapa pode recusar." };
    const problem = await fiscalWorkflowProblem(tx, params.id);
    if (problem) return { status: 409, error: problem };
    const now = new Date();
    await tx.invoiceWorkflow.update({ where: { id: e.id }, data: { status: "COMPLETED", completedAt: now, revision: { increment: 1 } } });
    await tx.invoiceWorkflowTask.updateMany({ where: { executionId: e.id, completedAt: null }, data: { completedAt: now } });
    await tx.invoice.update({ where: { id: params.id }, data: { status: "RECUSADO", dataValidacao: now, responsavelValidacao: manager.nome, observacaoValidacao: parsed.data.reason } });
    await tx.noteStatusHistory.create({ data: { invoiceId: params.id, previousStatus: i.status, newStatus: "RECUSADO", reason: parsed.data.reason, actorId: manager.id, actorName: manager.nome } });
    await tx.noteAuditLog.create({ data: { invoiceId: params.id, actorId: manager.id, actorName: manager.nome, actionType: "WORKFLOW_REJECTED", reason: parsed.data.reason, afterData: { executionId: e.id, stepId: e.tasks[0].stepId } } });
    return { status: 200 };
  });
  return result.error ? NextResponse.json({ error: result.error }, { status: result.status }) : NextResponse.json({ rejected: true });
}
