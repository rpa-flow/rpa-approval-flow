import { NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const manager = await getSessionManager();

  if (!manager) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const invoices = await prisma.invoice.findMany({
    where: manager.role === "ADMIN" ? {} : { fornecedorId: manager.supplierId },
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

  return NextResponse.json(invoices);
}
