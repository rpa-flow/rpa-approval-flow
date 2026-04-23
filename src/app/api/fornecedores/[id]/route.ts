import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionManager } from "@/lib/auth";
import { updateSupplierSchema } from "@/lib/validations";

async function validateAdmin() {
  const manager = await getSessionManager();
  if (!manager) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (manager.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas administradores podem editar fornecedores." }, { status: 403 });
  }

  return null;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const unauthorized = await validateAdmin();
  if (unauthorized) return unauthorized;

  const payload = await request.json();
  const parsed = updateSupplierSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.supplier.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 });
  }

  try {
    const supplier = await prisma.supplier.update({
      where: { id: params.id },
      data: {
        nome: parsed.data.nome,
        cnpj: parsed.data.cnpj ?? null
      }
    });

    return NextResponse.json(supplier);
  } catch (error) {
    return NextResponse.json(
      { error: "Não foi possível atualizar fornecedor.", details: (error as Error).message },
      { status: 409 }
    );
  }
}
