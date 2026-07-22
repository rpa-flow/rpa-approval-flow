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
    select: {
      codigoIdentificador: true,
      numeroNota: true,
      nDfse: true,
      status: true,
      createdAt: true,
      localEmissao: true,
      localPrestacao: true,
      municipioIncidencia: true,
      itemTributacaoNac: true,
      itemTributacaoMun: true,
      nbsDescricao: true,
      dataEmissao: true,
      dataCompetencia: true,
      dataPagamento: true,
      ordemCompra: true,
      ocContrato: true,
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
      codigoDelphi: true,
      responsavelValidacao: true,
      fornecedor: {
        select: {
          managerSuppliers: {
            select: { manager: { select: { nome: true } } }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const accessKeys = invoices.map((invoice) => invoice.codigoIdentificador);
  const nsuControls = accessKeys.length
    ? await prisma.nfseNsuControl.findMany({
        where: { accessKey: { in: accessKeys } },
        select: { accessKey: true, nsu: true },
        orderBy: { nsu: "desc" }
      })
    : [];
  const nsuByAccessKey = new Map<string, string>();
  for (const control of nsuControls) {
    if (control.accessKey && !nsuByAccessKey.has(control.accessKey)) {
      nsuByAccessKey.set(control.accessKey, control.nsu.toString());
    }
  }

  const rows = invoices.map((invoice) => {
    const managerNames = invoice.fornecedor.managerSuppliers
      .map((link) => link.manager.nome)
      .filter(Boolean)
      .join(", ");

    return {
      codigoIdentificador: invoice.codigoIdentificador,
      numeroNota: invoice.numeroNota,
      nDfse: invoice.nDfse ?? "",
      Status: invoice.status.replaceAll("_", " "),
      responsavel: invoice.responsavelValidacao || managerNames || "",
      createdAt: formatDateTime(invoice.createdAt),
      localEmissao: invoice.localEmissao ?? "",
      localPrestacao: invoice.localPrestacao ?? "",
      municipioIncidencia: invoice.municipioIncidencia ?? "",
      itemTributacaoNac: invoice.itemTributacaoNac ?? "",
      itemTributacaoMun: invoice.itemTributacaoMun ?? "",
      nbsDescricao: invoice.nbsDescricao ?? "",
      dataEmissao: formatDate(invoice.dataEmissao),
      dataCompetencia: formatDate(invoice.dataCompetencia),
      prestadorCnpj: invoice.prestadorCnpj ?? "",
      prestadorNome: invoice.prestadorNome ?? "",
      prestadorEmail: invoice.prestadorEmail ?? "",
      tomadorCnpj: invoice.tomadorCnpj ?? "",
      tomadorNome: invoice.tomadorNome ?? "",
      tomadorEmail: invoice.tomadorEmail ?? "",
      valorBaseCalculo: Number(invoice.valorBaseCalculo ?? 0),
      valorIssqn: Number(invoice.valorIssqn ?? 0),
      valorTotalRetido: Number(invoice.valorTotalRetido ?? 0),
      valorLiquido: Number(invoice.valorLiquido ?? 0),
      valorServico: Number(invoice.valorServico ?? 0),
      aliquota: Number(invoice.aliquota ?? 0),
      codigoDelphi: invoice.codigoDelphi ?? "",
      ocContrato: invoice.ocContrato ?? "",
      dataPagamento: formatDate(invoice.dataPagamento),
      ordemCompra: invoice.ordemCompra ?? "",
      nsu: nsuByAccessKey.get(invoice.codigoIdentificador) ?? ""
    };
  });
  rows.sort((a, b) => {
    const nsuA = nsuByAccessKey.get(a.codigoIdentificador);
    const nsuB = nsuByAccessKey.get(b.codigoIdentificador);
    if (nsuA && nsuB) return BigInt(nsuB) > BigInt(nsuA) ? 1 : BigInt(nsuB) < BigInt(nsuA) ? -1 : 0;
    if (nsuA) return -1;
    if (nsuB) return 1;
    return 0;
  });
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
