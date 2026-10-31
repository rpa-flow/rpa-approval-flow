import { NextRequest, NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseNFSeXml } from "@/lib/nfse-parser";

export async function GET(request: NextRequest) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode acessar a fila de revisão." }, { status: 403 });

  const status = request.nextUrl.searchParams.get("status") === "IGNORADA" ? "IGNORADA" : "PENDENTE";
  const reviews = await prisma.invoiceAdminReview.findMany({
    where: { status },
    include: {
      invoice: {
        include: { fornecedor: { select: { id: true, nome: true, cnpj: true } } }
      }
    },
    orderBy: { createdAt: "asc" },
    take: 100
  });

  return NextResponse.json(reviews.map(({ invoice, ...review }) => {
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
