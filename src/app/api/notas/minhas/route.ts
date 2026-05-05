import { NextRequest, NextResponse } from "next/server";
import { getAllowedSupplierIds, getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function shouldIncludeXml(request: NextRequest) {
  return request.nextUrl.searchParams.get("includeXml") === "true";
}

export async function GET(request: NextRequest) {
  const manager = await getSessionManager();

  if (!manager) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const allowedSupplierIds = getAllowedSupplierIds(manager);
  const includeXml = shouldIncludeXml(request);

  const invoices = await prisma.invoice.findMany({
    where: manager.role === "ADMIN" ? {} : { fornecedorId: { in: allowedSupplierIds } },
    include: {
      fornecedor: {
        select: {
          id: true,
          nome: true,
          cnpj: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return NextResponse.json(
    invoices.map((invoice) => {
      if (includeXml) return invoice;
      const { xmlOriginal, ...rest } = invoice;
      return rest;
    })
  );
}
