import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPaymentDateKeyAllowed, paymentDateAtSaoPauloNoon, utcDateKey } from "@/lib/payment-date";
import { processWorkflowNotifications } from "@/lib/workflow/notifications";

const fieldsSchema = z.object({
  ordemCompra: z.string().trim().regex(/^\d+$/).max(120).nullable().optional(),
  ocContrato: z.string().trim().regex(/^\d+$/).max(120).nullable().optional(),
  numeroParcelas: z.number().int().min(1).optional(),
  dataPagamento: z.string().datetime().nullable().optional(),
  observacaoValidacao: z.string().max(500).nullable().optional(),
  serviceEvaluation: z.object({ rating: z.number().int().min(1).max(5), comment: z.string().min(5), riskLevel: z.enum(["BAIXO", "MEDIO", "ALTO"]), qualifica: z.enum(["SIM", "NAO"]).optional() }).strict().optional()
}).strict();
const bodySchema = z.object({ revision: z.number().int().positive(), idempotencyKey: z.string().min(1).max(120), fields: fieldsSchema }).strict();

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const payloadHash = createHash("sha256").update(JSON.stringify({ revision: input.revision, fields: input.fields })).digest("hex");
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${params.id} FOR UPDATE`;
      const invoice = await tx.invoice.findUnique({ where: { id: params.id }, include: { adminReview: true, serviceEvaluation: true, workflowExecution: { include: { tasks: { where: { completedAt: null }, include: { step: { include: { fields: true } } } }, version: { include: { steps: { orderBy: { position: "asc" }, include: { manager: true } } } } } } } });
      if (!invoice?.workflowExecution) return { code: 404, error: "Workflow não encontrado." };
      const execution = invoice.workflowExecution;
      const previous = await tx.workflowCommand.findUnique({ where: { executionId_idempotencyKey: { executionId: execution.id, idempotencyKey: input.idempotencyKey } } });
      if (previous) {
        if (previous.actorId !== manager.id || previous.payloadHash !== payloadHash || previous.action !== "COMPLETE") return { code: 409, error: "Chave de operação já usada com outros dados." };
        return { code: 200, result: previous.result };
      }
      if (execution.status !== "ACTIVE" || execution.revision !== input.revision || execution.tasks.length !== 1) return { code: 409, error: "A etapa mudou. Atualize a nota." };
      const task = execution.tasks[0];
      if (task.managerId !== manager.id || !manager.ativo || manager.role === "FORNECEDOR") return { code: 403, error: "Somente o responsável atual pode concluir esta etapa." };
      if (invoice.adminReview && invoice.adminReview.status !== "LIBERADA") return { code: 409, error: "Nota retida para revisão administrativa." };
      if (invoice.status !== "AGUARDANDO_APROVACAO" || invoice.processada || invoice.statusProcessamento !== "PENDENTE") return { code: 409, error: "A situação da nota não permite concluir a etapa." };
      const policies = new Map(task.step.fields.map((field) => [field.fieldKey, field]));
      for (const key of Object.keys(input.fields)) if (policies.get(key)?.mode !== "EDITABLE") return { code: 403, error: `O campo ${key} não pode ser alterado nesta etapa.` };
      const data: Prisma.InvoiceUpdateInput = {};
      const { serviceEvaluation, dataPagamento, ...otherFields } = input.fields;
      Object.assign(data, otherFields);
      if (dataPagamento !== undefined) data.dataPagamento = dataPagamento === null ? null : paymentDateAtSaoPauloNoon(utcDateKey(new Date(dataPagamento)));
      const values = { ...invoice, ...otherFields, dataPagamento: data.dataPagamento === undefined ? invoice.dataPagamento : data.dataPagamento as Date | null };
      for (const field of task.step.fields.filter((item) => item.required)) {
        const value = field.fieldKey === "serviceEvaluation" ? serviceEvaluation : values[field.fieldKey as keyof typeof values];
        if (value === null || value === undefined || value === "") return { code: 400, error: `Preencha o campo obrigatório: ${field.fieldKey}.` };
      }
      if (task.step.requiresPurchaseOrder && !values.ordemCompra?.trim() && !values.ocContrato?.trim()) return { code: 400, error: "Informe ordem de compra ou contrato." };
      const next = execution.version.steps.find((step) => step.position > task.step.position);
      if (next && (!next.manager.ativo || next.manager.role === "FORNECEDOR")) return { code: 409, error: "O responsável da próxima etapa está indisponível." };
      const now = new Date();
      if (!next) {
        if (!values.ordemCompra?.trim() && !values.ocContrato?.trim()) return { code: 400, error: "Informe ordem de compra ou contrato." };
        if (!values.dataPagamento || !isPaymentDateKeyAllowed(utcDateKey(values.dataPagamento), now)) return { code: 400, error: "A data de pagamento não é válida para a aprovação final." };
        if (!serviceEvaluation && !invoice.serviceEvaluation) return { code: 400, error: "A avaliação do serviço é obrigatória." };
        Object.assign(data, { status: "APROVADO", processada: false, statusProcessamento: "PROCESSANDO", dataValidacao: now, responsavelValidacao: manager.nome, tentativasNotificacao: 0, ultimoLembreteEm: null });
      }
      const changed = await tx.invoiceWorkflow.updateMany({ where: { id: execution.id, status: "ACTIVE", revision: input.revision }, data: { revision: { increment: 1 }, ...(next ? {} : { status: "COMPLETED", completedAt: now }) } });
      if (!changed.count) return { code: 409, error: "A etapa mudou. Atualize a nota." };
      await tx.invoice.update({ where: { id: invoice.id }, data });
      if (serviceEvaluation) {
        const evaluationData = { ...serviceEvaluation, qualifica: serviceEvaluation.qualifica === undefined ? null : serviceEvaluation.qualifica === "SIM", managerId: manager.id, managerName: manager.nome, managerEmail: manager.email };
        await tx.serviceEvaluation.upsert({ where: { invoiceId: invoice.id }, create: { invoiceId: invoice.id, ...evaluationData }, update: evaluationData });
      }
      await tx.invoiceWorkflowTask.update({ where: { id: task.id }, data: { completedAt: now } });
      let nextTaskId: string | null = null;
      if (next) {
        const nextTask = await tx.invoiceWorkflowTask.create({ data: { executionId: execution.id, stepId: next.id, managerId: next.managerId, managerName: next.manager.nome, managerEmail: next.manager.email } });
        nextTaskId = nextTask.id;
        await tx.workflowNotification.create({ data: { taskId: nextTask.id, deduplicationKey: `assignment:${nextTask.id}`, recipient: nextTask.managerEmail, payload: { invoiceId: invoice.id, executionId: execution.id, stepId: next.id } } });
      } else {
        await tx.noteStatusHistory.create({ data: { invoiceId: invoice.id, actorId: manager.id, actorName: manager.nome, actorEmail: manager.email, previousStatus: invoice.status, newStatus: "APROVADO" } });
      }
      const result = { executionId: execution.id, revision: input.revision + 1, completed: !next, nextTaskId };
      const beforeFields = Object.fromEntries(Object.keys(input.fields).map((key) => [key, key === "serviceEvaluation" ? invoice.serviceEvaluation : invoice[key as keyof typeof invoice]]));
      await tx.noteAuditLog.create({ data: { invoiceId: invoice.id, actorId: manager.id, actorName: manager.nome, actorEmail: manager.email, actionType: "WORKFLOW_STEP_COMPLETED", actionDescription: `Etapa ${task.step.name} concluída`, previousStatus: invoice.status, newStatus: next ? invoice.status : "APROVADO", beforeData: JSON.parse(JSON.stringify({ stepId: task.stepId, managerId: task.managerId, fields: beforeFields })) as Prisma.InputJsonValue, afterData: { ...result, fields: input.fields } as Prisma.InputJsonValue } });
      await tx.workflowCommand.create({ data: { executionId: execution.id, idempotencyKey: input.idempotencyKey, actorId: manager.id, action: "COMPLETE", payloadHash, result } });
      return { code: 200, result };
    });
    if (outcome.code === 200 && outcome.result && typeof outcome.result === "object" && "nextTaskId" in outcome.result && outcome.result.nextTaskId) {
      try { await processWorkflowNotifications(); } catch { /* O envio pendente permanece registrado. */ }
    }
    return NextResponse.json(outcome.error ? { error: outcome.error } : outcome.result, { status: outcome.code });
  } catch (error) {
    console.error("[workflows:complete] Falha ao concluir etapa", error);
    return NextResponse.json({ error: "Não foi possível concluir a etapa." }, { status: 500 });
  }
}
