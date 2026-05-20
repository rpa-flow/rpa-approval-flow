import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { approvalNotificationSchema } from "@/lib/validations";
import { sendApprovalRequestEmail } from "@/lib/email";
import { getAllowedSupplierIds, getSessionManager } from "@/lib/auth";

function formatCurrency(value: unknown) {
  if (value === null || value === undefined) return undefined;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return undefined;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numeric);
}

function formatDate(value: Date | null | undefined) {
  if (!value) return undefined;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(value);
}

export async function POST(request: NextRequest) {
  const manager = await getSessionManager();

  if (!manager) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const payload = await request.json();
  const parsed = approvalNotificationSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const invoice = await prisma.invoice.findFirst({
    where: parsed.data.invoiceId
      ? { id: parsed.data.invoiceId }
      : { codigoIdentificador: parsed.data.codigoIdentificador! },
    include: {
      fornecedor: {
        include: {
          managerSuppliers: {
            include: {
              manager: true
            }
          },
          notificationConfig: true
        }
      }
    }
  });

  if (!invoice) {
    return NextResponse.json({ error: "Nota fiscal não encontrada." }, { status: 404 });
  }

  const allowedSupplierIds = getAllowedSupplierIds(manager);
  if (manager.role !== "ADMIN" && !allowedSupplierIds.includes(invoice.fornecedorId)) {
    return NextResponse.json({ error: "Acesso negado para esta nota." }, { status: 403 });
  }

  const managerEmails = invoice.fornecedor.managerSuppliers.map((m) => m.manager.email);
  const extraEmails = invoice.fornecedor.notificationConfig?.emailsExtras ?? [];
  const globalRule = await prisma.notificationRule.findFirst({ orderBy: { createdAt: "desc" } });

  const recipients = ["lipemiranda159@gmail.com"]// [...new Set([...managerEmails, ...extraEmails, globalRule?.destinatarioAdicional ?? ""].filter(Boolean))];

  if (!recipients.length) {
    return NextResponse.json(
      { error: "Fornecedor sem gestores e sem e-mails configurados para envio." },
      { status: 400 }
    );
  }

  await sendApprovalRequestEmail({
    invoiceNumber: invoice.numeroNota,
    codigoIdentificador: invoice.codigoIdentificador,
    supplierName: invoice.fornecedor.nome,
    recipients,
    invoiceValue: formatCurrency(invoice.valorServico ?? invoice.valorLiquido ?? invoice.valorBaseCalculo),
    issueDate: formatDate(invoice.dataEmissao),
    competenceDate: formatDate(invoice.dataCompetencia),
    prestadorCnpj: invoice.prestadorCnpj ?? undefined,
    extraMessage: parsed.data.extraMessage
  });

  const config = invoice.fornecedor.notificationConfig;
  if (config) {
    const now = new Date();
    const next = new Date(now);
    next.setDate(next.getDate() + config.recorrenciaDias);
    await prisma.supplierNotificationConfig.update({
      where: { id: config.id },
      data: {
        ultimoEnvioEm: now,
        proximoEnvioEm: next
      }
    });
  }

  return NextResponse.json({
    success: true,
    recipients,
    recorrenciaDias: invoice.fornecedor.notificationConfig?.recorrenciaDias ?? null,
    message: "E-mail de aprovação enviado com sucesso."
  });
}
