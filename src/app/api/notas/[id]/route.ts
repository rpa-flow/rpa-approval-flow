import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateInvoiceSchema } from "@/lib/validations";
import { getAllowedSupplierIds, getSessionManager } from "@/lib/auth";
import { createInvoiceAuditLog } from "@/lib/audit";
import { sendApprovalRequestEmail } from "@/lib/email";

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

function serializeInvoiceResponse<T extends { xmlOriginal?: string | null }>(invoice: T, includeXml: boolean) {
  if (includeXml) return invoice;
  const { xmlOriginal, ...rest } = invoice;
  return rest;
}

async function canAccessInvoice(invoice: { fornecedorId: string; criadoPorId?: string | null }, manager: NonNullable<Awaited<ReturnType<typeof getSessionManager>>>) {
  const allowedSupplierIds = getAllowedSupplierIds(manager);
  return manager.role === "ADMIN" || allowedSupplierIds.includes(invoice.fornecedorId) || invoice.criadoPorId === manager.id;
}

export async function GET(request: NextRequest, { params }: Params) {
  const includeXml = request.nextUrl.searchParams.get("includeXml") === "true";
  const manager = await getSessionManager();

  if (!manager) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      fornecedor: {
        select: {
          id: true,
          nome: true,
          cnpj: true,
          codigoExterno: true
        }
      }
    }
  });

  if (!invoice) {
    return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });
  }

  if (!(await canAccessInvoice(invoice, manager))) {
    return NextResponse.json({ error: "Acesso negado para esta nota." }, { status: 403 });
  }

  return NextResponse.json(serializeInvoiceResponse(invoice, includeXml));
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

  if (manager && !(await canAccessInvoice(existing, manager))) {
    return NextResponse.json({ error: "Acesso negado para esta nota." }, { status: 403 });
  }

  const payloadToSave = { ...parsed.data };
  const reason = typeof parsed.data.reason === "string" && parsed.data.reason.trim().length > 0 ? parsed.data.reason.trim() : null;
  const reapprovedFromError = existing.statusProcessamento === "ERRO" && payloadToSave.status === "APROVADO";
  const isChangingApprovedStatus = existing.status === "APROVADO" && payloadToSave.status !== undefined && payloadToSave.status !== "APROVADO";
  const serviceEvaluation = payloadToSave.serviceEvaluation;
  delete (payloadToSave as Record<string, unknown>).serviceEvaluation;
  delete (payloadToSave as Record<string, unknown>).reason;

  if (manager && manager.role !== "ADMIN" && (payloadToSave.tentativasNotificacao !== undefined || payloadToSave.ultimoLembreteEm !== undefined)) {
    return NextResponse.json(
      { error: "Somente ADMIN pode alterar tentativas de notificação." },
      { status: 403 }
    );
  }

  if (isChangingApprovedStatus && !reason) {
    return NextResponse.json(
      { error: "Informe o motivo para alterar ou cancelar uma aprovação." },
      { status: 400 }
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
    payloadToSave.tentativasNotificacao = 0;
    payloadToSave.ultimoLembreteEm = null;
    if (payloadToSave.dataPagamento === undefined) {
      const nextDay = new Date();
      nextDay.setDate(nextDay.getDate() + 1);
      payloadToSave.dataPagamento = nextDay.toISOString();
    }
  }

  if (payloadToSave.status === "RECUSADO") {
    payloadToSave.processada = true;
    payloadToSave.statusProcessamento = "ERRO";
  }

  if (payloadToSave.status === "DADOS_INCONSISTENTES") {
    payloadToSave.processada = true;
    payloadToSave.statusProcessamento = "ERRO";
  }

  if (payloadToSave.status === "EXPIRADA") {
    payloadToSave.processada = true;
    payloadToSave.statusProcessamento = "ERRO";
  }

  if ((payloadToSave.status === "RECUSADO" || payloadToSave.status === "DADOS_INCONSISTENTES" || isChangingApprovedStatus) && reason && payloadToSave.observacaoValidacao === undefined) {
    payloadToSave.observacaoValidacao = reason;
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
          : new Date(payloadToSave.dataLancamentoDelphi),
    dataPagamento:
      payloadToSave.dataPagamento === undefined
        ? undefined
        : payloadToSave.dataPagamento === null
          ? null
          : new Date(payloadToSave.dataPagamento)
  };


  if (payloadToSave.status === "APROVADO" || payloadToSave.status === "RECUSADO" || payloadToSave.status === "DADOS_INCONSISTENTES" || payloadToSave.status === "EXPIRADA") {
    dataToUpdate.responsavelValidacao = manager?.nome ?? "Integração Delphi";
    dataToUpdate.dataValidacao = new Date();
  }

  if (isChangingApprovedStatus && payloadToSave.status === "AGUARDANDO_APROVACAO") {
    dataToUpdate.responsavelValidacao = null;
    dataToUpdate.dataValidacao = null;
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
  const actorName = manager?.nome ?? "Integração Delphi";
  const actionDescription =
    isChangingApprovedStatus && updated.status === "AGUARDANDO_APROVACAO"
      ? `${actorName} cancelou a aprovação da nota`
      : isChangingApprovedStatus
        ? `${actorName} alterou uma nota aprovada para ${updated.status.replaceAll("_", " ")}`
        : updated.status === "APROVADO"
          ? `${actorName} aprovou a nota e registrou a avaliação do serviço`
          : updated.status === "RECUSADO"
            ? `${actorName} recusou a nota`
            : existing.status !== updated.status
              ? `${actorName} alterou o status da nota`
              : `${actorName} atualizou os dados da nota`;

  await createInvoiceAuditLog({ invoiceId: updated.id, actorId: manager?.id, actorName: manager?.nome ?? "Integração Delphi", actorEmail: manager?.email ?? "integracao@delphi.local", actionType, actionDescription, previousStatus: existing.status, newStatus: updated.status, reason, comment: serviceEvaluation ? `Avaliação ${serviceEvaluation.rating}/5 | Risco ${serviceEvaluation.riskLevel} | Qualifica: ${serviceEvaluation.qualifica === "SIM" ? "Sim" : "Não"}` : undefined, beforeData: existing as unknown as any, afterData: updated as unknown as any });


  if (reapprovedFromError) {
    const invoiceWithContacts = await prisma.invoice.findUnique({
      where: { id: updated.id },
      include: {
        fornecedor: {
          include: {
            notificationConfig: true,
            managerSuppliers: {
              include: {
                manager: { select: { email: true } }
              }
            }
          }
        }
      }
    });

    if (invoiceWithContacts) {
      const recipients = Array.from(
        new Set([
          ...invoiceWithContacts.fornecedor.managerSuppliers.map((ms) => ms.manager.email),
          ...(invoiceWithContacts.fornecedor.notificationConfig?.emailsExtras ?? [])
        ].filter(Boolean))
      );

      if (recipients.length) {
        await sendApprovalRequestEmail({
          invoiceNumber: invoiceWithContacts.numeroNota,
          codigoIdentificador: invoiceWithContacts.codigoIdentificador,
          supplierName: invoiceWithContacts.fornecedor.nome,
          recipients,
          invoiceId: invoiceWithContacts.id,
          extraMessage: "Nota reprovada por erro de processamento e reenviada para aprovação."
        });
      }
    }
  }

  if (includeXml) {
    return NextResponse.json(updated);
  }

  return NextResponse.json(serializeInvoiceResponse(updated, includeXml));
}
