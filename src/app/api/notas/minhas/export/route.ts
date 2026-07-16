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
    // Select every invoice field except xmlOriginal so the XML is never read or added to the workbook.
    select: {
      id: true,
      codigoIdentificador: true,
      numeroNota: true,
      nDfse: true,
      fornecedorId: true,
      status: true,
      processada: true,
      statusProcessamento: true,
      dataAtualizacao: true,
      createdAt: true,
      tentativasNotificacao: true,
      ultimoLembreteEm: true,
      localEmissao: true,
      localPrestacao: true,
      municipioIncidencia: true,
      itemTributacaoNac: true,
      itemTributacaoMun: true,
      nbsDescricao: true,
      dataProcessamento: true,
      dataEmissao: true,
      dataCompetencia: true,
      dataPagamento: true,
      ordemCompra: true,
      ocContrato: true,
      dataLancamentoDelphi: true,
      codigoDelphi: true,
      statusIntegracaoDelphi: true,
      situacaoNotaFiscal: true,
      responsavelValidacao: true,
      dataValidacao: true,
      observacaoValidacao: true,
      prestadorCnpj: true,
      prestadorNome: true,
      prestadorEmail: true,
      tomadorCnpj: true,
      tomadorNome: true,
      tomadorEmail: true,
      valorBaseCalculo: true,
      valorIssqn: true,
      valorTotalRetido: true,
      valorLiquido: true,
      valorServico: true,
      aliquota: true,
      criadoPorId: true,
      fornecedor: { select: { nome: true, cnpj: true, codigoExterno: true } },
      criadoPor: { select: { nome: true, email: true } },
      serviceEvaluation: { select: { id: true, managerId: true, managerName: true, managerEmail: true, rating: true, comment: true, riskLevel: true, qualifica: true, createdAt: true, updatedAt: true } }
    },
    orderBy: [{ dataAtualizacao: "desc" }, { dataEmissao: "desc" }]
  });

  const companyCnpjs = [...new Set(invoices.map((invoice) => invoice.tomadorCnpj).filter((cnpj): cnpj is string => Boolean(cnpj)))];
  const companies = companyCnpjs.length ? await prisma.company.findMany({ where: { cnpj: { in: companyCnpjs }, active: true }, select: { cnpj: true, displayName: true } }) : [];
  const companiesByCnpj = new Map(companies.map((company) => [company.cnpj, company.displayName]));

  const rows = invoices.map((invoice) => ({
    "ID da nota": invoice.id,
    "Número da nota": invoice.numeroNota,
    "Chave de acesso": invoice.codigoIdentificador,
    nDFSe: invoice.nDfse ?? "",
    "ID do fornecedor": invoice.fornecedorId,
    Status: invoice.status.replaceAll("_", " "),
    Processada: invoice.processada ? "Sim" : "Não",
    "Status de processamento": invoice.statusProcessamento,
    "Situação da nota fiscal": invoice.situacaoNotaFiscal,
    Fornecedor: invoice.fornecedor.nome,
    "CNPJ do fornecedor": invoice.fornecedor.cnpj ?? "",
    "Código externo do fornecedor": invoice.fornecedor.codigoExterno ?? "",
    Empresa: invoice.tomadorCnpj ? companiesByCnpj.get(invoice.tomadorCnpj) ?? "Empresa não cadastrada" : "",
    "CNPJ do tomador": invoice.tomadorCnpj ?? "",
    Tomador: invoice.tomadorNome ?? "",
    "E-mail do tomador": invoice.tomadorEmail ?? "",
    "CNPJ do prestador": invoice.prestadorCnpj ?? "",
    Prestador: invoice.prestadorNome ?? "",
    "E-mail do prestador": invoice.prestadorEmail ?? "",
    "Local de emissão": invoice.localEmissao ?? "",
    "Local de prestação": invoice.localPrestacao ?? "",
    "Município de incidência": invoice.municipioIncidencia ?? "",
    "Item de tributação nacional": invoice.itemTributacaoNac ?? "",
    "Item de tributação municipal": invoice.itemTributacaoMun ?? "",
    "Descrição NBS": invoice.nbsDescricao ?? "",
    "Data de emissão": formatDate(invoice.dataEmissao),
    "Data de competência": formatDate(invoice.dataCompetencia),
    "Data de processamento": formatDateTime(invoice.dataProcessamento),
    "Valor da base de cálculo": Number(invoice.valorBaseCalculo ?? 0),
    "Valor do ISSQN": Number(invoice.valorIssqn ?? 0),
    "Valor total retido": Number(invoice.valorTotalRetido ?? 0),
    "Valor do serviço": Number(invoice.valorServico ?? 0),
    "Valor líquido": Number(invoice.valorLiquido ?? 0),
    "Alíquota (%)": Number(invoice.aliquota ?? 0),
    "Data de pagamento": formatDate(invoice.dataPagamento),
    "Ordem de compra": invoice.ordemCompra ?? "",
    "OC/Contrato": invoice.ocContrato ?? "",
    "Data de lançamento no Delphi": formatDateTime(invoice.dataLancamentoDelphi),
    "Código Delphi": invoice.codigoDelphi ?? "",
    "Status integração Delphi": invoice.statusIntegracaoDelphi,
    Responsável: invoice.responsavelValidacao ?? "",
    "Data de validação": formatDateTime(invoice.dataValidacao),
    "Observação da validação": invoice.observacaoValidacao ?? "",
    "ID de quem criou": invoice.criadoPorId ?? "",
    "Nome de quem criou": invoice.criadoPor?.nome ?? "",
    "E-mail de quem criou": invoice.criadoPor?.email ?? "",
    "Tentativas de notificação": invoice.tentativasNotificacao,
    "Último lembrete em": formatDateTime(invoice.ultimoLembreteEm),
    "ID da avaliação": invoice.serviceEvaluation?.id ?? "",
    "ID do avaliador": invoice.serviceEvaluation?.managerId ?? "",
    Avaliador: invoice.serviceEvaluation?.managerName ?? "",
    "E-mail do avaliador": invoice.serviceEvaluation?.managerEmail ?? "",
    Avaliação: invoice.serviceEvaluation?.rating ?? "",
    "Comentário da avaliação": invoice.serviceEvaluation?.comment ?? "",
    Risco: invoice.serviceEvaluation?.riskLevel ?? "",
    Qualifica: invoice.serviceEvaluation?.qualifica === null || invoice.serviceEvaluation?.qualifica === undefined ? "" : invoice.serviceEvaluation.qualifica ? "Sim" : "Não",
    "Avaliação criada em": formatDateTime(invoice.serviceEvaluation?.createdAt ?? null),
    "Avaliação atualizada em": formatDateTime(invoice.serviceEvaluation?.updatedAt ?? null),
    "Nota criada em": formatDateTime(invoice.createdAt),
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
