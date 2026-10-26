import { NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseNFSeXml } from "@/lib/nfse-parser";
import { sendInvoiceAdminReviewEmail } from "@/lib/email";

type Params = { params: { id: string } };

export async function POST(_: Request, { params }: Params) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode reenviar o aviso." }, { status: 403 });

  const review = await prisma.invoiceAdminReview.findUnique({
    where: { invoiceId: params.id },
    include: { invoice: { include: { fornecedor: { select: { nome: true } } } } }
  });
  if (!review || review.status !== "PENDENTE") return NextResponse.json({ error: "Revisão pendente não encontrada." }, { status: 404 });

  const config = await prisma.invoiceAdminReviewConfig.findUnique({ where: { id: "default" } });
  if (!config?.ativo || !config.email) return NextResponse.json({ error: "Configure um e-mail administrativo válido antes de reenviar." }, { status: 400 });

  let description: string | null = review.invoice.nbsDescricao;
  if (review.invoice.xmlOriginal) {
    try {
      description = parseNFSeXml(review.invoice.xmlOriginal).descricaoServico ?? description;
    } catch {
      // O aviso segue com as informações persistidas quando o XML legado falhar.
    }
  }

  try {
    await sendInvoiceAdminReviewEmail({
      recipient: config.email,
      invoiceNumber: review.invoice.numeroNota,
      supplierName: review.invoice.fornecedor.nome,
      invoiceId: review.invoiceId,
      reasons: review.motivos,
      issueDate: review.invoice.dataEmissao?.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) ?? null,
      suggestedValue: review.valorSugerido?.toString() ?? null,
      evidence: review.evidenciaValor ?? (description ? "Descrição disponível para análise na tela de revisão." : null)
    });
    await prisma.invoiceAdminReview.update({
      where: { id: review.id },
      data: { emailDestinatario: config.email, emailEnviadoEm: new Date(), erroEmail: null, tentativasEmail: { increment: 1 } }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.invoiceAdminReview.update({
      where: { id: review.id },
      data: { emailDestinatario: config.email, erroEmail: message, tentativasEmail: { increment: 1 } }
    });
    return NextResponse.json({ error: "Não foi possível enviar o aviso.", details: message }, { status: 502 });
  }
}
