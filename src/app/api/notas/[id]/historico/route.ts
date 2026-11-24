import { NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReadInvoice } from "@/lib/invoice-query";

type Params = { params: { id: string } };

export async function GET(_: Request, { params }: Params) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  if (!(await canReadInvoice(manager, params.id))) return NextResponse.json({ error: "Nota não encontrada." }, { status: 404 });

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

