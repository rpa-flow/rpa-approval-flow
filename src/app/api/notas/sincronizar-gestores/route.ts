import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionManager } from "@/lib/auth";
import { invoicesAvailableForApproval } from "@/lib/invoice-admin-review-access";
import { sendApprovalRequestEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

const inputSchema = z.object({ cursor: z.string().min(1).optional() }).strict();
const BATCH_SIZE = 10;

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export async function POST(request: NextRequest) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Apenas administradores podem sincronizar gestores." }, { status: 403 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido.", details: parsed.error.flatten() }, { status: 400 });

  const invoices = await prisma.invoice.findMany({
    where: {
      AND: [
        invoicesAvailableForApproval(),
        { status: "AGUARDANDO_APROVACAO", processada: false, statusProcessamento: "PENDENTE" },
        ...(parsed.data.cursor ? [{ id: { gt: parsed.data.cursor } }] : [])
      ]
    },
    orderBy: { id: "asc" },
    take: BATCH_SIZE + 1,
    select: {
      id: true,
      numeroNota: true,
      codigoIdentificador: true,
      status: true,
      gestoresSincronizadosIds: true,
      fornecedor: {
        select: {
          id: true,
          nome: true,
          managerSuppliers: {
            where: { manager: { role: "GESTOR" } },
            select: { manager: { select: { id: true, email: true } } }
          }
        }
      }
    }
  });

  const hasMore = invoices.length > BATCH_SIZE;
  const batch = invoices.slice(0, BATCH_SIZE);
  const supplierResults = new Map<string, { supplierId: string; supplierName: string; notesFound: number; changed: number; emailsSent: number; failures: number; skippedNoRecipients: number; unchanged: number }>();
  let emailsSent = 0;
  let failures = 0;
  let skippedNoRecipients = 0;
  let changed = 0;
  let unchanged = 0;

  for (const invoice of batch) {
    const supplierResult = supplierResults.get(invoice.fornecedor.id) ?? {
      supplierId: invoice.fornecedor.id,
      supplierName: invoice.fornecedor.nome,
      notesFound: 0,
      changed: 0,
      emailsSent: 0,
      failures: 0,
      skippedNoRecipients: 0,
      unchanged: 0
    };
    supplierResult.notesFound += 1;

    const currentManagerIds = invoice.fornecedor.managerSuppliers.map((link) => link.manager.id).sort();
    const previousManagerIds = [...invoice.gestoresSincronizadosIds].sort();
    if (sameIds(previousManagerIds, currentManagerIds)) {
      unchanged += 1;
      supplierResult.unchanged += 1;
      supplierResults.set(invoice.fornecedor.id, supplierResult);
      continue;
    }

    changed += 1;
    supplierResult.changed += 1;
    const recipients = Array.from(new Set(invoice.fornecedor.managerSuppliers.map((link) => link.manager.email).filter(Boolean)));

    if (recipients.length === 0) {
      await prisma.$transaction([
        prisma.invoice.update({ where: { id: invoice.id }, data: { gestoresSincronizadosIds: currentManagerIds } }),
        prisma.noteNotification.create({ data: { invoiceId: invoice.id, recipients: [], success: false, error: "Nenhum gestor vinculado ao fornecedor." } }),
        prisma.noteAuditLog.create({
          data: {
            invoiceId: invoice.id,
            actorId: manager.id,
            actorName: manager.nome,
            actorEmail: manager.email,
            actionType: "MANAGERS_SYNCED",
            actionDescription: "Gestores da nota sincronizados; nenhum gestor está vinculado ao fornecedor.",
            afterData: { managerIds: currentManagerIds }
          }
        })
      ]);
      skippedNoRecipients += 1;
      supplierResult.skippedNoRecipients += 1;
      supplierResults.set(invoice.fornecedor.id, supplierResult);
      continue;
    }

    try {
      await sendApprovalRequestEmail({
        invoiceNumber: invoice.numeroNota,
        codigoIdentificador: invoice.codigoIdentificador,
        supplierName: invoice.fornecedor.nome,
        recipients,
        invoiceId: invoice.id,
        extraMessage: "Os gestores responsáveis por este fornecedor foram sincronizados com a nota pendente."
      });
      await prisma.$transaction([
        prisma.invoice.update({ where: { id: invoice.id }, data: { gestoresSincronizadosIds: currentManagerIds } }),
        prisma.noteNotification.create({ data: { invoiceId: invoice.id, recipients, success: true } }),
        prisma.noteAuditLog.create({
          data: {
            invoiceId: invoice.id,
            actorId: manager.id,
            actorName: manager.nome,
            actorEmail: manager.email,
            actionType: "MANAGERS_SYNCED",
            actionDescription: "Gestores da nota sincronizados e notificados.",
            afterData: { managerIds: currentManagerIds, recipients }
          }
        })
      ]);
      emailsSent += 1;
      supplierResult.emailsSent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao enviar e-mail.";
      await prisma.$transaction([
        prisma.noteNotification.create({ data: { invoiceId: invoice.id, recipients, success: false, error: message } }),
        prisma.noteAuditLog.create({
          data: {
            invoiceId: invoice.id,
            actorId: manager.id,
            actorName: manager.nome,
            actorEmail: manager.email,
            actionType: "MANAGERS_SYNC_EMAIL_FAILED",
            actionDescription: "Falha ao notificar os gestores após sincronização.",
            comment: message,
            afterData: { managerIds: currentManagerIds, recipients }
          }
        })
      ]);
      failures += 1;
      supplierResult.failures += 1;
    }

    supplierResults.set(invoice.fornecedor.id, supplierResult);
  }

  return NextResponse.json({
    count: batch.length,
    hasMore,
    nextCursor: hasMore ? batch[batch.length - 1]?.id ?? null : null,
    changed,
    unchanged,
    emailsSent,
    failures,
    skippedNoRecipients,
    suppliers: Array.from(supplierResults.values())
  });
}
