import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendApprovalRequestEmail } from "@/lib/email";
import { createInvoiceAuditLog } from "@/lib/audit";

async function buildDueReminders() {
  const invoices = await prisma.invoice.findMany({
    where: {
      status: "AGUARDANDO_APROVACAO"
    },
    include: {
      fornecedor: {
        include: {
          notificationConfig: true,
          managerSuppliers: {
            include: {
              manager: {
                select: {
                  email: true,
                  nome: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: {
      dataAtualizacao: "asc"
    }
  });

  const now = new Date();

  return invoices
    .map((invoice) => {
      const config = invoice.fornecedor.notificationConfig;
      const recorrenciaDias = config?.recorrenciaDias ?? 2;
      const maxTentativas = config?.maxTentativas ?? 2;
      const ativo = config?.ativo ?? true;
      const neverNotified = invoice.tentativasNotificacao === 0 && !invoice.ultimoLembreteEm;
      const lastReferenceDate = invoice.ultimoLembreteEm ?? invoice.dataAtualizacao;
      const diffMs = now.getTime() - new Date(lastReferenceDate).getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const due = ativo && (neverNotified || diffDays >= recorrenciaDias);

      return {
        invoiceId: invoice.id,
        numeroNota: invoice.numeroNota,
        codigoIdentificador: invoice.codigoIdentificador,
        status: invoice.status,
        fornecedor: {
          id: invoice.fornecedor.id,
          nome: invoice.fornecedor.nome,
          cnpj: invoice.fornecedor.cnpj
        },
        recorrenciaDias,
        maxTentativas,
        tentativasAtuais: invoice.tentativasNotificacao,
        diasDesdeUltimoEnvioOuAtualizacao: diffDays,
        primeiroEnvioPendente: neverNotified,
        due,
        emailsGestores: invoice.fornecedor.managerSuppliers.map((ms) => ms.manager.email),
        emailsExtras: config?.emailsExtras ?? []
      };
    })
    .filter((item) => item.due);
}

async function processDueReminders(
  reminders: Awaited<ReturnType<typeof buildDueReminders>>,
  options?: { sendEmails?: boolean }
) {
  const now = new Date();
  const processed = [];
  const sendEmails = options?.sendEmails ?? false;

  for (const reminder of reminders) {
    const nextTentativa = reminder.tentativasAtuais + 1;
    const shouldExpire = false;

    const recipients = Array.from(new Set([...reminder.emailsGestores, ...reminder.emailsExtras].filter(Boolean)));
    let emailSent = false;
    let emailError: string | null = null;

    if (sendEmails && recipients.length) {
      try {
        await sendApprovalRequestEmail({
          invoiceNumber: reminder.numeroNota,
          codigoIdentificador: reminder.codigoIdentificador,
          supplierName: reminder.fornecedor.nome,
          recipients
        });
        emailSent = true;
      } catch (error) {
        emailError = (error as Error).message;
      }
    }

    const updated = await prisma.invoice.update({
      where: { id: reminder.invoiceId },
      data: {
        tentativasNotificacao: nextTentativa,
        ultimoLembreteEm: now,
        status: "AGUARDANDO_APROVACAO",
        statusProcessamento: "PENDENTE",
        processada: false
      }
    });

    if (true) {
      await prisma.supplierNotificationConfig.updateMany({
        where: { supplierId: reminder.fornecedor.id },
        data: {
          ultimoEnvioEm: now,
          proximoEnvioEm: new Date(now.getTime() + reminder.recorrenciaDias * 24 * 60 * 60 * 1000)
        }
      });
    }

    await prisma.noteNotification.create({ data: { invoiceId: updated.id, recipients, success: emailSent, error: emailError } });
    await createInvoiceAuditLog({ invoiceId: updated.id, actionType: "NOTIFICATION_RESENT", actionDescription: "Sistema enviou um lembrete de aprovação ao gestor responsável", newStatus: updated.status, comment: "Lembrete recorrente enviado" });

    processed.push({
      invoiceId: updated.id,
      tentativasNotificacao: updated.tentativasNotificacao,
      status: updated.status,
      emailSent,
      emailError,
      recipients
    });
  }

  return processed;
}

function validateReminderApiKey(request: NextRequest) {
  const apiKey = process.env.REMINDER_API_KEY;
  if (!apiKey) return null;

  const keyFromRequest = request.headers.get("x-api-key");
  if (keyFromRequest !== apiKey) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  return null;
}

export async function GET(request: NextRequest) {
  const unauthorized = validateReminderApiKey(request);
  if (unauthorized) return unauthorized;

  const reminders = await buildDueReminders();
  const contabilizar = request.nextUrl.searchParams.get("contabilizar") === "true";
  const enviarEmail = request.nextUrl.searchParams.get("enviarEmail") !== "false";

  if (contabilizar) {
    const processed = await processDueReminders(reminders, { sendEmails: enviarEmail });

    return NextResponse.json({
      count: processed.length,
      contabilizado: true,
      emailsEnviados: processed.filter((p) => p.emailSent).length,
      processed
    });
  }

  return NextResponse.json({
    count: reminders.length,
    reminders,
    contabilizado: false
  });
}

export async function POST(request: NextRequest) {
  const unauthorized = validateReminderApiKey(request);
  if (unauthorized) return unauthorized;

  const reminders = await buildDueReminders();
  const processed = await processDueReminders(reminders, { sendEmails: true });

  return NextResponse.json({
    count: processed.length,
    emailsEnviados: processed.filter((p) => p.emailSent).length,
    processed
  });
}
