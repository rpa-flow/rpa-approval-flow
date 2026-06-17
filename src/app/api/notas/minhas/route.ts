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
          codigoExterno: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    skip: (pagination.page - 1) * pageSize,
    take: pageSize
  });

  return NextResponse.json(
    {
      items: invoices.map((invoice) => {
        if (includeXml) return invoice;
        const { xmlOriginal, ...rest } = invoice;
        return rest;
      }),
      pagination,
      supplierOptions
    }
  );
}
