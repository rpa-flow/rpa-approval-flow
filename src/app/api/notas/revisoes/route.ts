import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseNFSeXml } from "@/lib/nfse-parser";
import { legacyInvoiceTypes, invoicesAvailableForApproval } from "@/lib/invoice-admin-review-access";

export async function GET(request: NextRequest) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode acessar a fila de revisão." }, { status: 403 });

  const status = request.nextUrl.searchParams.get("status") === "IGNORADA" ? "IGNORADA" : "PENDENTE";
  const fornecedor = (request.nextUrl.searchParams.get("fornecedor") ?? "").trim().slice(0, 100);
  const cnpj = fornecedor.replace(/\D/g, "");
  const supplier: Prisma.InvoiceWhereInput = fornecedor ? { fornecedor: { OR: [
      { nome: { contains: fornecedor, mode: "insensitive" } },
      { cnpj: { contains: fornecedor, mode: "insensitive" } },
      ...(cnpj ? [{ cnpj: { contains: cnpj } }] : [])
  ] } } : {};
  const includeSupplier = { fornecedor: { select: { id: true, nome: true, cnpj: true } } } as const;
  const [reviews, deferred] = await Promise.all([
    prisma.invoiceAdminReview.findMany({
      where: { status, invoice: supplier },
      include: { invoice: { include: includeSupplier } },
      orderBy: { createdAt: "asc" },
      take: 100
    }),
    status === "PENDENTE" ? prisma.fiscalDocumentVersion.findMany({
      where: { state: "CANDIDATE", invoice: { AND: [supplier, legacyInvoiceTypes, invoicesAvailableForApproval(), {
        OR: [{ statusProcessamento: "PROCESSANDO" }, { status: "APROVADO", statusProcessamento: "ERRO" }]
      }] } },
      distinct: ["invoiceId"],
      select: { id: true, invoiceId: true, createdAt: true, invoice: { include: includeSupplier } },
      orderBy: { createdAt: "asc" },
      take: 100
    }) : []
  ]);
  const pendingExternalResults = deferred.map(candidate => ({
    ...candidate, status: "PENDENTE", motivos: ["CONFLITO_XML"], versao: 0,
    aguardandoResultadoExterno: true, valorSugerido: null, valorConfirmado: null, evidenciaValor: null,
    emissaoConfirmada: false, erroEmail: null, justificativa: null, observacao: null, responsavelNome: null,
    responsavelEmail: null, revisadoEm: null, emailEnviadoEm: null, tentativasEmail: 0
  }));
  const queue = [...reviews, ...pendingExternalResults]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, 100);

  return NextResponse.json(queue.map(({ invoice, ...review }) => {
    let descricaoServico: string | null = invoice.nbsDescricao;
    if (invoice.xmlOriginal) {
      try {
        descricaoServico = parseNFSeXml(invoice.xmlOriginal).descricaoServico ?? descricaoServico;
      } catch {
        // Mantém a descrição persistida quando um XML legado não puder ser interpretado.
      }
    }
    const { xmlOriginal: _xmlOriginal, ...safeInvoice } = invoice;
    return { ...review, invoice: { ...safeInvoice, descricaoServico } };
  }));
}
