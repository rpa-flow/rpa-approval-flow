import { NextRequest, NextResponse } from "next/server";
import { InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { groupExtrasByFieldName, parseNFSeXml, simplifyExtrasByFieldName } from "@/lib/nfse-parser";
import { getPaginationMetadata, getPaginationParams, shouldUsePaginatedResponse } from "@/lib/pagination";
import { createInvoiceFromRequest } from "./create-invoice";

const ALLOWED_STATUSES = Object.values(InvoiceStatus);

function shouldIncludeXml(request: NextRequest) {
  return request.nextUrl.searchParams.get("includeXml") === "true";
}

function shouldIncludeExtras(request: NextRequest) {
  return request.nextUrl.searchParams.get("includeExtras") === "true";
}

function serializeInvoiceResponse<T extends { xmlOriginal?: string | null }>(invoice: T, includeXml: boolean) {
  if (includeXml) return invoice;
  const { xmlOriginal, ...rest } = invoice;
  return rest;
}

export async function GET(request: NextRequest) {
  const statusParam = request.nextUrl.searchParams.get("status");
  const includeXml = shouldIncludeXml(request);

  if (statusParam && !ALLOWED_STATUSES.includes(statusParam as InvoiceStatus)) {
    return NextResponse.json(
      {
        error: "Status inválido.",
        allowed: ALLOWED_STATUSES
      },
      { status: 400 }
    );
  }

  const includeExtras = shouldIncludeExtras(request);
  const paginated = shouldUsePaginatedResponse(request.nextUrl.searchParams);
  const { page: requestedPage, pageSize } = getPaginationParams(request.nextUrl.searchParams);
  const where = statusParam ? { status: statusParam as InvoiceStatus } : undefined;
  const total = paginated ? await prisma.invoice.count({ where }) : 0;
  const pagination = paginated ? getPaginationMetadata(total, requestedPage, pageSize) : null;
  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      fornecedor: {
        include: {
          managerSuppliers: {
            include: {
              manager: {
                select: { id: true, nome: true, email: true }
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
    ...(pagination ? { skip: (pagination.page - 1) * pageSize, take: pageSize } : {})
  });

  const response = invoices.map((invoice) => {
    const base = serializeInvoiceResponse(invoice, includeXml);

    if (!includeExtras || !invoice.xmlOriginal) {
      return base;
    }

    try {
      const parsed = parseNFSeXml(invoice.xmlOriginal);
      return {
        ...base,
        serie: parsed.serie ?? null,
        extras: parsed.extras,
        extrasByFieldName: groupExtrasByFieldName(parsed.extras),
        extrasSimple: simplifyExtrasByFieldName(parsed.extras)
      };
    } catch {
      return {
        ...base,
        serie: null,
        extras: {},
        extrasByFieldName: {},
        extrasSimple: {},
        extrasError: "Não foi possível extrair extras do XML armazenado."
      };
    }
  });

  if (!pagination) return NextResponse.json(response);

  return NextResponse.json({ items: response, pagination });
}

export async function POST(request: NextRequest) {
  return createInvoiceFromRequest(request);
}

