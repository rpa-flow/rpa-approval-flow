import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSessionManager } from "@/lib/auth";
import { buildInvoiceWhere } from "@/lib/invoice-query";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function formatDate(value: Date | null) {
  return value ? value.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "";
}

function formatDateTime(value: Date | null) {
  return value ? value.toLocaleString("pt-BR", { timeZone: "UTC" }) : "";
}

export async function GET(request: NextRequest) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const invoices = await prisma.invoice.findMany({
    where: buildInvoiceWhere(manager, request.nextUrl.searchParams),
    include: {
      fornecedor: { select: { nome: true, cnpj: true, codigoExterno: true } },
      serviceEvaluation: { select: { rating: true, riskLevel: true, qualifica: true } }
    },
    orderBy: [{ dataAtualizacao: "desc" }, { dataEmissao: "desc" }]
  });

  const companyCnpjs = [...new Set(invoices.map((invoice) => invoice.tomadorCnpj).filter((cnpj): cnpj is string => Boolean(cnpj)))];
  const companies = companyCnpjs.length ? await prisma.company.findMany({ where: { cnpj: { in: companyCnpjs }, active: true }, select: { cnpj: true, displayName: true } }) : [];
  const companiesByCnpj = new Map(companies.map((company) => [company.cnpj, company.displayName]));

  const rows = invoices.map((invoice) => ({
    "Número da nota": invoice.numeroNota,
    "Chave de acesso": invoice.codigoIdentificador,
    Status: invoice.status.replaceAll("_", " "),
    Fornecedor: invoice.fornecedor.nome,
    "CNPJ do fornecedor": invoice.fornecedor.cnpj ?? "",
    "Código externo do fornecedor": invoice.fornecedor.codigoExterno ?? "",
    Empresa: invoice.tomadorCnpj ? companiesByCnpj.get(invoice.tomadorCnpj) ?? "Empresa não cadastrada" : "",
    "CNPJ do tomador": invoice.tomadorCnpj ?? "",
    Tomador: invoice.tomadorNome ?? "",
    "Data de emissão": formatDate(invoice.dataEmissao),
    "Data de competência": formatDate(invoice.dataCompetencia),
    "Valor do serviço": Number(invoice.valorServico ?? 0),
    "Valor líquido": Number(invoice.valorLiquido ?? 0),
    "Data de pagamento": formatDate(invoice.dataPagamento),
    "Ordem de compra": invoice.ordemCompra ?? "",
    "OC/Contrato": invoice.ocContrato ?? "",
    "Código Delphi": invoice.codigoDelphi ?? "",
    "Status integração Delphi": invoice.statusIntegracaoDelphi,
    Responsável: invoice.responsavelValidacao ?? "",
    "Data de validação": formatDateTime(invoice.dataValidacao),
    Avaliação: invoice.serviceEvaluation?.rating ?? "",
    Risco: invoice.serviceEvaluation?.riskLevel ?? "",
    Qualifica: invoice.serviceEvaluation?.qualifica === null || invoice.serviceEvaluation?.qualifica === undefined ? "" : invoice.serviceEvaluation.qualifica ? "Sim" : "Não",
    "Última atualização": formatDateTime(invoice.dataAtualizacao)
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = Object.keys(rows[0] ?? { "Nenhuma nota encontrada": "" }).map((header) => ({ wch: Math.min(Math.max(header.length + 2, 14), 38) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Notas fiscais");
  const content = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const filename = `notas-fiscais-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}
