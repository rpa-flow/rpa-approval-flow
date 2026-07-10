import { NextRequest, NextResponse } from "next/server";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { getAllowedSupplierIds, getSessionManager } from "@/lib/auth";
import { getPaginationMetadata, getPaginationParams } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

function shouldIncludeXml(request: NextRequest) {
  return request.nextUrl.searchParams.get("includeXml") === "true";
}

function parseDay(value: string | null, endOfDay = false) {
  if (!value) return null;

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest) {
  const manager = await getSessionManager();

  if (!manager) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const allowedSupplierIds = getAllowedSupplierIds(manager);
  const includeXml = shouldIncludeXml(request);
  const { page: requestedPage, pageSize } = getPaginationParams(request.nextUrl.searchParams);
  const statusParam = request.nextUrl.searchParams.get("status");
  const supplierId = request.nextUrl.searchParams.get("supplierId");
  const taker = request.nextUrl.searchParams.get("taker")?.trim();
  const updatedFrom = parseDay(request.nextUrl.searchParams.get("updatedFrom"));
  const updatedTo = parseDay(request.nextUrl.searchParams.get("updatedTo"), true);
  const issueFrom = parseDay(request.nextUrl.searchParams.get("issueFrom"));
  const issueTo = parseDay(request.nextUrl.searchParams.get("issueTo"), true);
  const competenceFrom = parseDay(request.nextUrl.searchParams.get("competenceFrom"));
  const competenceTo = parseDay(request.nextUrl.searchParams.get("competenceTo"), true);

  const scopeWhere: Prisma.InvoiceWhereInput =
    manager.role === "ADMIN"
      ? {}
      : manager.role === "FORNECEDOR"
        ? { criadoPorId: manager.id }
        : { fornecedorId: { in: allowedSupplierIds } };

  const filters: Prisma.InvoiceWhereInput[] = [scopeWhere];

  if (statusParam === "LANCADAS") {
    filters.push({
      OR: [{ status: InvoiceStatus.PROCESSADO }, { dataLancamentoDelphi: { not: null } }]
    });
  } else if (statusParam && Object.values(InvoiceStatus).includes(statusParam as InvoiceStatus)) {
    filters.push({ status: statusParam as InvoiceStatus });
  }

  if (supplierId && supplierId !== "TODOS") filters.push({ fornecedorId: supplierId });
  if (taker) filters.push({ tomadorNome: { contains: taker, mode: "insensitive" } });

  if (updatedFrom || updatedTo) {
    filters.push({
      dataAtualizacao: {
        ...(updatedFrom ? { gte: updatedFrom } : {}),
        ...(updatedTo ? { lte: updatedTo } : {})
      }
    });
  }

  if (issueFrom || issueTo) {
    filters.push({
      dataEmissao: {
        ...(issueFrom ? { gte: issueFrom } : {}),
        ...(issueTo ? { lte: issueTo } : {})
      }
    });
  }

  if (competenceFrom || competenceTo) {
    filters.push({
      dataCompetencia: {
        ...(competenceFrom ? { gte: competenceFrom } : {}),
        ...(competenceTo ? { lte: competenceTo } : {})
      }
    });
  }

  const where: Prisma.InvoiceWhereInput = { AND: filters };
  const supplierWhere: Prisma.SupplierWhereInput =
    manager.role === "ADMIN"
      ? {}
      : manager.role === "FORNECEDOR"
        ? { invoices: { some: { criadoPorId: manager.id } } }
        : { id: { in: allowedSupplierIds } };

  const [total, supplierOptions] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.supplier.findMany({
      where: supplierWhere,
      select: { id: true, nome: true },
      orderBy: { nome: "asc" }
    })
  ]);

  const pagination = getPaginationMetadata(total, requestedPage, pageSize);
  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      fornecedor: {
        select: {
          id: true,
          nome: true,
          cnpj: true,
          codigoExterno: true,
          managerSuppliers: {
            select: {
              manager: {
                select: { nome: true }
              }
            }
          }
        }
      }
    },
    orderBy: [
      { dataAtualizacao: "desc" },
      { dataEmissao: "desc" }
    ],
    skip: (pagination.page - 1) * pageSize,
    take: pageSize
  });

  const companyCnpjs = Array.from(new Set(invoices.map((invoice) => invoice.tomadorCnpj).filter((cnpj): cnpj is string => Boolean(cnpj))));
  const companies = companyCnpjs.length
    ? await prisma.company.findMany({
      where: { cnpj: { in: companyCnpjs }, active: true },
      select: { cnpj: true, displayName: true }
    })
    : [];
  const companiesByCnpj = new Map(companies.map((company) => [company.cnpj, company]));

  return NextResponse.json(
    {
      items: invoices.map((invoice) => {
        const company = invoice.tomadorCnpj ? companiesByCnpj.get(invoice.tomadorCnpj) : undefined;
        const invoiceWithCompany = {
          ...invoice,
          empresa: {
            cnpj: invoice.tomadorCnpj,
            nomeExibicao: company?.displayName ?? null
          }
        };

        if (includeXml) return invoiceWithCompany;
        const { xmlOriginal, ...rest } = invoiceWithCompany;
        return rest;
      }),
      pagination,
      supplierOptions
    }
  );
}
