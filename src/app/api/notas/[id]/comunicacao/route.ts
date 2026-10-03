import { NextRequest, NextResponse } from "next/server";
import { InvoiceStatus } from "@prisma/client";
import { createInvoiceAuditLog } from "@/lib/audit";
import { getSessionManager } from "@/lib/auth";
import { sendInvoiceStatusEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Params = { params: { id: string } };

export async function POST(request: NextRequest, { params }: Params) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente administradores podem enviar esta comunicação." }, { status: 403 });

  const formData = await request.formData();
  const newStatus = String(formData.get("status") ?? "") as InvoiceStatus;
  const reason = String(formData.get("reason") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const recipients = Array.from(new Set(String(formData.get("recipients") ?? "").split(/[;,\n]/).map((email) => email.trim().toLowerCase()).filter(Boolean)));
  const imageValue = formData.get("image");
  const image = imageValue instanceof File && imageValue.size > 0 ? imageValue : null;

  if (!Object.values(InvoiceStatus).includes(newStatus)) return NextResponse.json({ error: "Selecione um status válido." }, { status: 400 });
  if (!reason || reason.length > 500) return NextResponse.json({ error: "Informe um motivo de até 500 caracteres." }, { status: 400 });
  if (!recipients.length || recipients.some((email) => !EMAIL_PATTERN.test(email))) return NextResponse.json({ error: "Informe ao menos um destinatário válido." }, { status: 400 });
  if (message.length > 2000) return NextResponse.json({ error: "A mensagem deve ter no máximo 2.000 caracteres." }, { status: 400 });
  if (image && (!ALLOWED_IMAGE_TYPES.has(image.type) || image.size > MAX_IMAGE_SIZE)) return NextResponse.json({ error: "A imagem deve ser JPG, PNG, GIF ou WebP e ter no máximo 5 MB." }, { status: 400 });

  const existing = await prisma.invoice.findUnique({ where: { id: params.id }, include: { fornecedor: true } });
  if (!existing) return NextResponse.json({ error: "Nota não encontrada." }, { status: 404 });
  if (existing.status === newStatus) return NextResponse.json({ error: "Escolha um status diferente do atual." }, { status: 400 });

  const processing = newStatus === "PROCESSADO"
    ? { processada: true, statusProcessamento: "CONCLUIDO" as const, dataLancamentoDelphi: new Date() }
    : newStatus === "AGUARDANDO_APROVACAO"
      ? { processada: false, statusProcessamento: "PENDENTE" as const }
      : newStatus === "APROVADO"
        ? { processada: false, statusProcessamento: "PROCESSANDO" as const }
        : { processada: true, statusProcessamento: "ERRO" as const };

  const updated = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.update({
      where: { id: existing.id },
      data: {
        status: newStatus,
        observacaoValidacao: reason,
        responsavelValidacao: manager.nome,
        dataValidacao: new Date(),
        ...processing
      }
    });
    await tx.noteStatusHistory.create({ data: { invoiceId: invoice.id, actorId: manager.id, actorName: manager.nome, actorEmail: manager.email, previousStatus: existing.status, newStatus, reason } });
    return invoice;
  });

  let emailResult;
  try {
    emailResult = await sendInvoiceStatusEmail({
      recipients,
      invoiceId: updated.id,
      invoiceNumber: updated.numeroNota,
      codigoIdentificador: updated.codigoIdentificador,
      supplierName: existing.fornecedor.nome,
      supplierCnpj: existing.fornecedor.cnpj,
      invoiceValue: updated.valorServico === null ? null : Number(updated.valorServico).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      issueDate: updated.dataEmissao?.toLocaleDateString("pt-BR", { timeZone: "UTC" }),
      previousStatus: existing.status,
      newStatus,
      reason,
      message,
      image: image ? { name: image.name, contentType: image.type, contentBytes: Buffer.from(await image.arrayBuffer()).toString("base64") } : undefined
    });
  } catch (error) {
    await createInvoiceAuditLog({ invoiceId: updated.id, actorId: manager.id, actorName: manager.nome, actorEmail: manager.email, actionType: "STATUS_CHANGED_EMAIL_FAILED", actionDescription: `${manager.nome} alterou o status, mas o envio da comunicação falhou`, previousStatus: existing.status, newStatus, reason, comment: error instanceof Error ? error.message : "Falha desconhecida no envio", beforeData: existing as never, afterData: updated as never });
    return NextResponse.json({ error: "O status foi alterado, mas não foi possível enviar o e-mail. Consulte o histórico antes de tentar novamente.", statusChanged: true }, { status: 502 });
  }

  await createInvoiceAuditLog({ invoiceId: updated.id, actorId: manager.id, actorName: manager.nome, actorEmail: manager.email, actionType: "STATUS_CHANGED_AND_EMAIL_SENT", actionDescription: `${manager.nome} alterou o status e enviou uma comunicação para ${recipients.length} destinatário(s)`, previousStatus: existing.status, newStatus, reason, comment: message || undefined, beforeData: existing as never, afterData: updated as never });

  return NextResponse.json({ invoice: updated, email: emailResult });
}
