import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supplierSchema } from "@/lib/validations";
import { getSessionManager, hashPassword } from "@/lib/auth";

async function validateAdmin() {
  const manager = await getSessionManager();
  if (!manager) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (manager.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas administradores podem gerenciar fornecedores." }, { status: 403 });
  }

  return null;
}

export async function GET() {
  const unauthorized = await validateAdmin();
  if (unauthorized) return unauthorized;

  const suppliers = await prisma.supplier.findMany({
    include: {
      managerSuppliers: {
        include: {
          manager: {
            select: {
              id: true,
              nome: true,
              email: true,
              role: true,
              ativo: true
            }
          }
        }
      }
    },
    orderBy: {
      nome: "asc"
    }
  });

  return NextResponse.json(
    suppliers.map((s) => ({
      id: s.id,
      nome: s.nome,
      cnpj: s.cnpj,
      managers: s.managerSuppliers.map((ms) => ms.manager)
    }))
  );
}

export async function POST(request: NextRequest) {
  const unauthorized = await validateAdmin();
  if (unauthorized) return unauthorized;

  const payload = await request.json();
  const parsed = supplierSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supplier = await prisma.supplier.create({
    data: {
      nome: parsed.data.nome,
      cnpj: parsed.data.cnpj
    }
  });

  for (const m of parsed.data.managers) {
    const existingManager = await prisma.manager.findUnique({ where: { email: m.email } });

    const manager = existingManager
      ? existingManager
      : await prisma.manager.create({
          data: {
            nome: m.nome,
            email: m.email,
            senhaHash: hashPassword(m.senha)
          }
        });

    await prisma.managerSupplier.upsert({
      where: {
        managerId_supplierId: {
          managerId: manager.id,
          supplierId: supplier.id
        }
      },
      update: {},
      create: {
        managerId: manager.id,
        supplierId: supplier.id
      }
    });
  }

  const fullSupplier = await prisma.supplier.findUnique({
    where: { id: supplier.id },
    include: {
      managerSuppliers: {
        include: {
          manager: {
            select: {
              id: true,
              nome: true,
              email: true,
              role: true,
              ativo: true
            }
          }
        }
      }
    }
  });

  return NextResponse.json(
    {
      id: fullSupplier?.id,
      nome: fullSupplier?.nome,
      cnpj: fullSupplier?.cnpj,
      managers: fullSupplier?.managerSuppliers.map((ms) => ms.manager) ?? []
    },
    { status: 201 }
  );
}
