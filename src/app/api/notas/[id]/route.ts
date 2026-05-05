import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateInvoiceSchema } from "@/lib/validations";
import { getAllowedSupplierIds, getSessionManager } from "@/lib/auth";

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

  if (payloadToSave.status === "EXPIRADA") {
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

  const updated = await prisma.invoice.update({
    where: { id: params.id },
    data: dataToUpdate
  });

  if (includeXml) {
    return NextResponse.json(updated);
  }

  const { xmlOriginal, ...rest } = updated;
  return NextResponse.json(rest);
}
