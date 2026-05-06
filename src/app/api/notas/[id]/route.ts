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

export async function PATCH(request: NextRequest, { params }: Params) {
  const includeXml = request.nextUrl.searchParams.get("includeXml") === "true";
  const manager = await getSessionManager();

  if (!manager) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (manager.role === "FORNECEDOR") {
    return NextResponse.json({ error: "Perfil FORNECEDOR não pode atualizar notas." }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = updateInvoiceSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.invoice.findUnique({ where: { id: params.id } });

  if (!existing) {
    return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });
  }

  const allowedSupplierIds = getAllowedSupplierIds(manager);

  if (manager.role !== "ADMIN" && !allowedSupplierIds.includes(existing.fornecedorId)) {
    return NextResponse.json({ error: "Acesso negado para esta nota." }, { status: 403 });
  }

  const payloadToSave = { ...parsed.data };

  if (manager.role !== "ADMIN" && (payloadToSave.tentativasNotificacao !== undefined || payloadToSave.ultimoLembreteEm !== undefined)) {
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
    payloadToSave.processada = false;
    payloadToSave.statusProcessamento = "PROCESSANDO";
  }

  if (payloadToSave.status === "RECUSADO") {
    payloadToSave.processada = true;
    payloadToSave.statusProcessamento = "ERRO";
  }

  const dataToUpdate = {
    ...payloadToSave,
    ultimoLembreteEm:
      payloadToSave.ultimoLembreteEm === undefined
        ? undefined
        : payloadToSave.ultimoLembreteEm === null
          ? null
          : new Date(payloadToSave.ultimoLembreteEm)
  };

  const reason = typeof payload?.reason === "string" ? payload.reason : null;
  const updated = await prisma.invoice.update({
    where: { id: params.id },
    data: dataToUpdate
  });

  await prisma.noteStatusHistory.create({ data: { invoiceId: updated.id, actorId: manager.id, actorName: manager.nome, actorEmail: manager.email, previousStatus: existing.status, newStatus: updated.status, reason } });
  await createInvoiceAuditLog({ invoiceId: updated.id, actorId: manager.id, actorName: manager.nome, actorEmail: manager.email, actionType: existing.status !== updated.status ? "STATUS_CHANGED" : "NOTE_UPDATED", previousStatus: existing.status, newStatus: updated.status, reason, beforeData: existing as unknown as any, afterData: updated as unknown as any });

  if (includeXml) {
    return NextResponse.json(updated);
  }

  const { xmlOriginal, ...rest } = updated;
  return NextResponse.json(rest);
}
