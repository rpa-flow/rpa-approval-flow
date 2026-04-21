import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const apiKey = process.env.REMINDER_API_KEY;
  if (apiKey) {
    const keyFromRequest = request.headers.get("x-api-key");
    if (keyFromRequest !== apiKey) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
  }

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

  const reminders = invoices
    .map((invoice) => {
      const config = invoice.fornecedor.notificationConfig;
      const recorrenciaDias = config?.recorrenciaDias ?? 2;
      const ativo = config?.ativo ?? true;
      const lastReferenceDate = config?.ultimoEnvioEm ?? invoice.dataAtualizacao;
      const diffMs = now.getTime() - new Date(lastReferenceDate).getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const due = ativo && diffDays >= recorrenciaDias;

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
        diasDesdeUltimoEnvioOuAtualizacao: diffDays,
        due,
        emailsGestores: invoice.fornecedor.managerSuppliers.map((ms) => ms.manager.email),
        emailsExtras: config?.emailsExtras ?? []
      };
    })
    .filter((item) => item.due);

  return NextResponse.json({
    count: reminders.length,
    reminders
  });
}
