import { NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const manager = await getSessionManager();

  if (!manager) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const suppliers = manager.role === "ADMIN"
    ? await prisma.supplier.findMany({
        select: { id: true, nome: true },
        orderBy: { nome: "asc" }
      })
    : manager.managerSuppliers
        .map((ms) => ({
          id: ms.supplierId,
          nome: ms.supplier.nome
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return NextResponse.json({
    authenticated: true,
    manager: {
      id: manager.id,
      nome: manager.nome,
      email: manager.email,
      role: manager.role,
      suppliers: suppliers.map((supplier) => ({
        supplierId: supplier.id,
        supplierName: supplier.nome
      }))
    }
  });
}
