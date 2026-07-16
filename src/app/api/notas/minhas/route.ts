import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAllowedSupplierIds, getSessionManager } from "@/lib/auth";
import { buildInvoiceWhere } from "@/lib/invoice-query";
import { getPaginationMetadata, getPaginationParams } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

function shouldIncludeXml(request: NextRequest) {
  return request.nextUrl.searchParams.get("includeXml") === "true";
}

export async function GET(request: NextRequest) {
  const manager = await getSessionManager();

  if (!manager) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const includeXml = shouldIncludeXml(request);
  const { page: requestedPage, pageSize } = getPaginationParams(request.nextUrl.searchParams);
  const where = buildInvoiceWhere(manager, request.nextUrl.searchParams);
  const supplierWhere: Prisma.SupplierWhereInput =
    manager.role === "ADMIN"
      ? {}
      : manager.role === "FORNECEDOR"
        ? { invoices: { some: { criadoPorId: manager.id } } }
        : { id: { in: getAllowedSupplierIds(manager) } };

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
