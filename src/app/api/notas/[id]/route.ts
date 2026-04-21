import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateInvoiceSchema } from "@/lib/validations";
import { getAllowedSupplierIds, getSessionManager } from "@/lib/auth";

type Params = {
  params: {
    id: string;
  };
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const manager = await getSessionManager();

  if (!manager) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = updateInvoiceSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.invoice.findUnique({ where: { id: params.id } });

  if (!existing) {
    return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });
  }

  const allowedSupplierIds = getAllowedSupplierIds(manager);

  if (manager.role !== "ADMIN" && !allowedSupplierIds.includes(existing.fornecedorId)) {
    return NextResponse.json({ error: "Acesso negado para esta nota." }, { status: 403 });
  }

  const updated = await prisma.invoice.update({
    where: { id: params.id },
    data: parsed.data
  });

  return NextResponse.json(updated);
}
