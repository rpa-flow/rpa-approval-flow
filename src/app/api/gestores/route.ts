import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionManager, hashPassword } from "@/lib/auth";
import { managerSchema } from "@/lib/validations";

async function validateAdmin() {
  const manager = await getSessionManager();
  if (!manager) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (manager.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas administradores podem gerenciar gestores." }, { status: 403 });
  }

  return null;
}

const managerSelect = {
  id: true,
  nome: true,
  email: true,
  role: true,
  ativo: true,
  managerSuppliers: {
    include: {
      supplier: {
        select: {
          id: true,
          nome: true,
          cnpj: true,
          codigoExterno: true
        }
      }
    },
    orderBy: {
      supplier: {
        nome: "asc" as const
      }
    }
  }
};

export async function GET() {
  const unauthorized = await validateAdmin();
  if (unauthorized) return unauthorized;

  const managers = await prisma.manager.findMany({
    select: managerSelect,
    orderBy: {
      nome: "asc"
    }
  });

  return NextResponse.json(
    managers.map((manager) => ({
      id: manager.id,
      nome: manager.nome,
      email: manager.email,
      role: manager.role,
      ativo: manager.ativo,
      suppliers: manager.managerSuppliers.map((link) => link.supplier)
    }))
  );
}

export async function POST(request: NextRequest) {
  const unauthorized = await validateAdmin();
  if (unauthorized) return unauthorized;

  const payload = await request.json();
  const parsed = managerSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { supplierIds, senha, ativo, ...managerData } = parsed.data;

  try {
    const manager = await prisma.manager.create({
      data: {
        ...managerData,
        senhaHash: hashPassword(senha),
        ativo: ativo ?? true,
        managerSuppliers: {
          create: supplierIds.map((supplierId) => ({ supplierId }))
        }
      },
      select: managerSelect
    });

    return NextResponse.json(
      {
        id: manager.id,
        nome: manager.nome,
        email: manager.email,
        role: manager.role,
        ativo: manager.ativo,
        suppliers: manager.managerSuppliers.map((link) => link.supplier)
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Não foi possível cadastrar gestor.", details: (error as Error).message },
      { status: 409 }
    );
  }
}
