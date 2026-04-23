import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  return NextResponse.json({
    count: reminders.length,
    reminders
  });
}

export async function POST(request: NextRequest) {
  const unauthorized = validateReminderApiKey(request);
  if (unauthorized) return unauthorized;

  const reminders = await buildDueReminders();
  const now = new Date();

  const processed = [];

  for (const reminder of reminders) {
    const nextTentativa = reminder.tentativasAtuais + 1;
    const shouldExpire = nextTentativa >= reminder.maxTentativas;

    const updated = await prisma.invoice.update({
      where: { id: reminder.invoiceId },
      data: {
        tentativasNotificacao: nextTentativa,
        ultimoLembreteEm: now,
        status: shouldExpire ? "EXPIRADA" : "AGUARDANDO_APROVACAO",
        statusProcessamento: shouldExpire ? "ERRO" : "PENDENTE",
        processada: shouldExpire
      }
    });

    if (!shouldExpire) {
      await prisma.supplierNotificationConfig.updateMany({
        where: { supplierId: reminder.fornecedor.id },
        data: {
          ultimoEnvioEm: now,
          proximoEnvioEm: new Date(now.getTime() + reminder.recorrenciaDias * 24 * 60 * 60 * 1000)
        }
      });
    }

    processed.push({
      invoiceId: updated.id,
      tentativasNotificacao: updated.tentativasNotificacao,
      status: updated.status
    });
  }

  return NextResponse.json({
    count: processed.length,
    processed
  });
}
