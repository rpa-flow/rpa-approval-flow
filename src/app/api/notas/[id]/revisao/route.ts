import { NextRequest, NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendApprovalRequestEmail } from "@/lib/email";
import { invoiceAdminReviewDecisionSchema } from "@/lib/validations";

type Params = { params: { id: string } };

export async function POST(request: NextRequest, { params }: Params) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode validar notas." }, { status: 403 });

  const parsed = invoiceAdminReviewDecisionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });
  }

  const review = await prisma.invoiceAdminReview.findUnique({
    where: { invoiceId: params.id },
    include: {
      invoice: {
        include: {
          fornecedor: {
            include: {
              managerSuppliers: { include: { manager: { select: { email: true } } } },
              notificationConfig: { select: { emailsExtras: true } }
            }
          }
        }
      }
    }
  });
  if (!review) return NextResponse.json({ error: "Revisão não encontrada." }, { status: 404 });
  if (review.status !== "PENDENTE" || review.versao !== parsed.data.versao) {
    return NextResponse.json({ error: "A revisão mudou desde que foi carregada. Atualize a fila." }, { status: 409 });
  }
  const ignoring = parsed.data.ignorar === true;
  if (ignoring && !parsed.data.justificativa?.trim()) {
    return NextResponse.json({ error: "Informe a justificativa para ignorar esta nota." }, { status: 400 });
  }
  if (!ignoring && (["RECUSADO", "PROCESSADO", "EXPIRADA"].includes(review.invoice.status) || review.invoice.processada)) {
    return NextResponse.json({ error: "Esta nota não pode ser liberada para aprovação." }, { status: 409 });
  }

  const needsValue = review.motivos.includes("VALOR_ZERADO");
  const needsEmissionConfirmation = review.motivos.includes("EMISSAO_ANTERIOR");
  let confirmedValue = review.valorConfirmado?.toString() ?? null;
  if (!ignoring && needsValue) {
    if (!parsed.data.valorConfirmado) return NextResponse.json({ error: "Informe o valor para aprovação." }, { status: 400 });
    const normalized = parsed.data.valorConfirmado.replace(",", ".");
    if (Number(normalized) <= 0) return NextResponse.json({ error: "O valor confirmado deve ser maior que zero." }, { status: 400 });
    confirmedValue = Number(normalized).toFixed(2);
  } else if (!ignoring && parsed.data.valorConfirmado) {
    return NextResponse.json({ error: "Esta revisão não permite alterar valor." }, { status: 400 });
  }

  if (!ignoring && needsEmissionConfirmation && (!parsed.data.confirmarEmissaoAnterior || !parsed.data.justificativa?.trim())) {
    return NextResponse.json({ error: "Confirme a emissão anterior e informe a justificativa." }, { status: 400 });
  }
  if (!ignoring && needsValue && review.valorSugerido?.toString() !== confirmedValue && !parsed.data.justificativa?.trim()) {
    return NextResponse.json({ error: "Informe a justificativa para alterar o valor sugerido." }, { status: 400 });
  }

  const emissionConfirmed = ignoring
    ? review.emissaoConfirmada
    : needsEmissionConfirmation
    ? parsed.data.confirmarEmissaoAnterior === true || review.emissaoConfirmada
    : review.emissaoConfirmada;
  const allReasonsResolved = (!needsValue || Boolean(confirmedValue)) && (!needsEmissionConfirmation || emissionConfirmed);
  const nextStatus = ignoring ? "IGNORADA" : allReasonsResolved ? "LIBERADA" : "PENDENTE";
  const changed = await prisma.$transaction(async (tx) => {
    const result = await tx.invoiceAdminReview.updateMany({
      where: { id: review.id, status: "PENDENTE", versao: parsed.data.versao },
      data: {
        valorConfirmado: confirmedValue,
        emissaoConfirmada: emissionConfirmed,
        responsavelId: manager.id,
        responsavelNome: manager.nome,
        responsavelEmail: manager.email,
        justificativa: parsed.data.justificativa?.trim() || review.justificativa,
        observacao: parsed.data.observacao?.trim() || review.observacao,
        revisadoEm: new Date(),
        status: nextStatus,
        versao: { increment: 1 }
      }
    });
    if (result.count) {
      await tx.noteAuditLog.create({
        data: {
          invoiceId: review.invoiceId,
          actorId: manager.id,
          actorName: manager.nome,
          actorEmail: manager.email,
          actionType: nextStatus === "IGNORADA" ? "ADMIN_REVIEW_IGNORED" : nextStatus === "LIBERADA" ? "ADMIN_REVIEW_RELEASED" : "ADMIN_REVIEW_UPDATED",
          actionDescription: nextStatus === "IGNORADA"
            ? "Administrador ignorou a nota e impediu sua exibição no dashboard"
            : nextStatus === "LIBERADA"
              ? "Administrador validou a nota e liberou para aprovação do gestor"
              : "Administrador atualizou a revisão pendente",
          reason: parsed.data.justificativa?.trim() || null,
          comment: parsed.data.observacao?.trim() || null,
          afterData: { reviewId: review.id, reasons: review.motivos, confirmedValue, status: nextStatus }
        }
      });
    }
    return result;
  });
  if (!changed.count) return NextResponse.json({ error: "A revisão mudou desde que foi carregada. Atualize a fila." }, { status: 409 });

  if (nextStatus === "LIBERADA") {
    const recipients = Array.from(new Set([
      ...review.invoice.fornecedor.managerSuppliers.map((item) => item.manager.email),
      ...(review.invoice.fornecedor.notificationConfig?.emailsExtras ?? [])
    ].filter(Boolean)));
    if (recipients.length) {
      try {
        await sendApprovalRequestEmail({
          invoiceNumber: review.invoice.numeroNota,
          codigoIdentificador: review.invoice.codigoIdentificador,
          supplierName: review.invoice.fornecedor.nome,
          recipients,
          invoiceId: review.invoiceId,
          invoiceValue: confirmedValue ?? review.invoice.valorServico?.toString() ?? review.invoice.valorLiquido?.toString(),
          issueDate: review.invoice.dataEmissao?.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          extraMessage: "A validação administrativa foi concluída. A nota está disponível para sua aprovação."
        });
      } catch (error) {
        console.error("[notas:revisao] Falha ao notificar gestores após liberação", { invoiceId: review.invoiceId, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  const updated = await prisma.invoiceAdminReview.findUnique({ where: { id: review.id } });
  return NextResponse.json(updated);
}
