import { NextResponse } from "next/server";
import { getAllowedSupplierIds, getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function GET(_: Request, { params }: Params) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!invoice) return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });

  const allowedSupplierIds = getAllowedSupplierIds(manager);
  if (manager.role !== "ADMIN" && !allowedSupplierIds.includes(invoice.fornecedorId) && invoice.criadoPorId !== manager.id) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const logs = await prisma.noteAuditLog.findMany({ where: { invoiceId: params.id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json(logs);
}
