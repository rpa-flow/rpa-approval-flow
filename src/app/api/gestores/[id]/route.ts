import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionManager, hashPassword } from "@/lib/auth";
import { updateManagerSchema } from "@/lib/validations";

async function validateAdmin() {
  const manager = await getSessionManager();
  if (!manager) {
    return { response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }

  if (manager.role !== "ADMIN") {
    return { response: NextResponse.json({ error: "Apenas administradores podem editar gestores." }, { status: 403 }) };
  }

  return { manager };
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

async function hasAnotherActiveAdmin(managerId: string) {
  const count = await prisma.manager.count({
    where: {
      id: { not: managerId },
      role: "ADMIN",
      ativo: true
    }
  });

  return count > 0;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await validateAdmin();
  if (auth.response) return auth.response;

  const payload = await request.json();
  const parsed = updateManagerSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.manager.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Gestor não encontrado." }, { status: 404 });
  }

  const wouldRemoveLastAdmin = existing.role === "ADMIN" && (!parsed.data.ativo || parsed.data.role !== "ADMIN");
  if (wouldRemoveLastAdmin && !(await hasAnotherActiveAdmin(params.id))) {
    return NextResponse.json(
      { error: "Mantenha ao menos um administrador ativo na plataforma." },
      { status: 400 }
    );
  }

  const { supplierIds, senha, ...managerData } = parsed.data;

  try {
    const manager = await prisma.$transaction(async (tx) => {
      await tx.managerSupplier.deleteMany({ where: { managerId: params.id } });

      await tx.manager.update({
        where: { id: params.id },
        data: {
          ...managerData,
          ...(senha ? { senhaHash: hashPassword(senha) } : {})
        }
      });

      if (supplierIds.length) {
        await tx.managerSupplier.createMany({
          data: supplierIds.map((supplierId) => ({ managerId: params.id, supplierId })),
          skipDuplicates: true
        });
      }

      return tx.manager.findUnique({
        where: { id: params.id },
        select: managerSelect
      });
    });

    return NextResponse.json({
      id: manager?.id,
      nome: manager?.nome,
      email: manager?.email,
      role: manager?.role,
      ativo: manager?.ativo,
      suppliers: manager?.managerSuppliers.map((link) => link.supplier) ?? []
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Não foi possível atualizar gestor.", details: (error as Error).message },
      { status: 409 }
    );
  }
}
