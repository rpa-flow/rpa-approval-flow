import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateInvoiceSchema } from "@/lib/validations";
import { getAllowedSupplierIds, getSessionManager } from "@/lib/auth";
import { createInvoiceAuditLog } from "@/lib/audit";

type Params = {
  params: {
    id: string;
  };
};

function hasIntegrationApiKey(request: NextRequest) {
  const configured = process.env.INVOICE_INGEST_API_KEY;
  if (!configured) return false;
  return request.headers.get("x-api-key") === configured;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const includeXml = request.nextUrl.searchParams.get("includeXml") === "true";
  const manager = await getSessionManager();
  const integrationRequest = hasIntegrationApiKey(request);

  if (!manager && !integrationRequest) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (manager?.role === "FORNECEDOR") {
    return NextResponse.json({ error: "Perfil FORNECEDOR não pode atualizar notas." }, { status: 403 });
  }

  const payload = await request.json();
  const integrationInvoiceId = typeof payload?.id === "string" && payload.id.length > 0 ? payload.id : null;
  const targetInvoiceId = integrationRequest && params.id === "minerium" ? integrationInvoiceId : params.id;

  if (!targetInvoiceId) {
    return NextResponse.json({ error: "Informe o id da nota para atualização." }, { status: 400 });
  }

  const parsed = updateInvoiceSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.invoice.findUnique({ where: { id: targetInvoiceId } });

  if (!existing) {
    return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });
  }

  const allowedSupplierIds = manager ? getAllowedSupplierIds(manager) : [];

  if (manager && manager.role !== "ADMIN" && !allowedSupplierIds.includes(existing.fornecedorId)) {
    return NextResponse.json({ error: "Acesso negado para esta nota." }, { status: 403 });
  }

  const payloadToSave = { ...parsed.data };
  const serviceEvaluation = payloadToSave.serviceEvaluation;
  delete (payloadToSave as Record<string, unknown>).serviceEvaluation;

  if (manager && manager.role !== "ADMIN" && (payloadToSave.tentativasNotificacao !== undefined || payloadToSave.ultimoLembreteEm !== undefined)) {
    return NextResponse.json(
      { error: "Somente ADMIN pode alterar tentativas de notificação." },
      { status: 403 }
    );
  }

  if (payloadToSave.status === "PROCESSADO") {
    payloadToSave.processada = true;
    payloadToSave.statusProcessamento = "CONCLUIDO";
  }

  if (payloadToSave.status === "AGUARDANDO_APROVACAO") {
    payloadToSave.processada = false;
    payloadToSave.statusProcessamento = "PENDENTE";
  }

  if (payloadToSave.status === "APROVADO") {
    if (!serviceEvaluation) {
      return NextResponse.json(
        { error: "A avaliação do serviço é obrigatória para aprovar a nota." },
        { status: 400 }
      );
    }
    payloadToSave.processada = false;
    payloadToSave.statusProcessamento = "PROCESSANDO";
  }

  if (payloadToSave.status === "RECUSADO") {
    payloadToSave.processada = true;
    payloadToSave.statusProcessamento = "ERRO";
  }

  const dataToUpdate: Record<string, unknown> = {
    ...payloadToSave,
    ultimoLembreteEm:
      payloadToSave.ultimoLembreteEm === undefined
        ? undefined
        : payloadToSave.ultimoLembreteEm === null
          ? null
          : new Date(payloadToSave.ultimoLembreteEm),
    dataLancamentoDelphi:
      payloadToSave.dataLancamentoDelphi === undefined
        ? undefined
        : payloadToSave.dataLancamentoDelphi === null
          ? null
          : new Date(payloadToSave.dataLancamentoDelphi)
  };

  const reason = typeof payload?.reason === "string" ? payload.reason : null;

  if (payloadToSave.status === "APROVADO" || payloadToSave.status === "RECUSADO") {
    dataToUpdate.responsavelValidacao = manager?.nome ?? "Integração Delphi";
    dataToUpdate.dataValidacao = new Date();
  }
  const updated = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.update({ where: { id: targetInvoiceId }, data: dataToUpdate });

    if (invoice.status === "APROVADO" && serviceEvaluation) {
      await tx.serviceEvaluation.upsert({
        where: { invoiceId: invoice.id },
        update: {
          rating: serviceEvaluation.rating,
          comment: serviceEvaluation.comment,
          riskLevel: serviceEvaluation.riskLevel,
          managerId: manager?.id ?? "integracao-delphi",
          managerName: manager?.nome ?? "Integração Delphi",
          managerEmail: manager?.email ?? "integracao@delphi.local",
          qualifica: serviceEvaluation.qualifica === undefined ? null : serviceEvaluation.qualifica === "SIM"
        },
        create: {
          invoiceId: invoice.id,
          rating: serviceEvaluation.rating,
          comment: serviceEvaluation.comment,
          riskLevel: serviceEvaluation.riskLevel,
          managerId: manager?.id ?? "integracao-delphi",
          managerName: manager?.nome ?? "Integração Delphi",
          managerEmail: manager?.email ?? "integracao@delphi.local",
          qualifica: serviceEvaluation.qualifica === undefined ? null : serviceEvaluation.qualifica === "SIM"
        }
      });
    }

    await tx.noteStatusHistory.create({ data: { invoiceId: invoice.id, actorId: manager?.id, actorName: manager?.nome ?? "Integração Delphi", actorEmail: manager?.email ?? "integracao@delphi.local", previousStatus: existing.status, newStatus: invoice.status, reason } });
    return invoice;
  });

  const actionType = existing.status !== updated.status ? "STATUS_CHANGED" : "NOTE_UPDATED";
  const actionDescription =
    updated.status === "APROVADO"
      ? `${manager?.nome ?? "Integração Delphi"} aprovou a nota e registrou a avaliação do serviço`
      : updated.status === "RECUSADO"
        ? `${manager?.nome ?? "Integração Delphi"} recusou a nota`
        : existing.status !== updated.status
          ? `${manager?.nome ?? "Integração Delphi"} alterou o status da nota`
          : `${manager?.nome ?? "Integração Delphi"} atualizou os dados da nota`;

  await createInvoiceAuditLog({ invoiceId: updated.id, actorId: manager?.id, actorName: manager?.nome ?? "Integração Delphi", actorEmail: manager?.email ?? "integracao@delphi.local", actionType, actionDescription, previousStatus: existing.status, newStatus: updated.status, reason, comment: serviceEvaluation ? `Avaliação ${serviceEvaluation.rating}/5 | Risco ${serviceEvaluation.riskLevel} | Qualifica: ${serviceEvaluation.qualifica === "SIM" ? "Sim" : "Não"}` : undefined, beforeData: existing as unknown as any, afterData: updated as unknown as any });

  if (includeXml) {
    return NextResponse.json(updated);
  }

  const { xmlOriginal, ...rest } = updated;
  return NextResponse.json(rest);
}
