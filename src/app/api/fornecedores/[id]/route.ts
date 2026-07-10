import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionManager, hashPassword } from "@/lib/auth";
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
        cnpj: parsed.data.cnpj ?? null,
        codigoExterno: parsed.data.codigoExterno ?? null
      }
    });

    if (parsed.data.categoryIds) {
      await prisma.supplierCategoryLink.deleteMany({ where: { supplierId: params.id } });
      if (parsed.data.categoryIds.length) {
        await prisma.supplierCategoryLink.createMany({ data: parsed.data.categoryIds.map((categoryId) => ({ supplierId: params.id, categoryId })), skipDuplicates: true });
      }
    }

    let managerIds = parsed.data.managerIds ? Array.from(new Set(parsed.data.managerIds)) : undefined;

    if (parsed.data.addManager) {
      const { id, email, nome, senha } = parsed.data.addManager;

      let manager = id
        ? await prisma.manager.findUnique({ where: { id } })
        : email
          ? await prisma.manager.findUnique({ where: { email } })
          : null;

      if (!manager) {
        if (!email || !nome || !senha) {
          return NextResponse.json(
            { error: "Para criar novo gestor, informe nome, e-mail e senha." },
            { status: 400 }
          );
        }

        manager = await prisma.manager.create({
          data: {
            nome,
            email,
            senhaHash: hashPassword(senha)
          }
        });
      }

      managerIds = Array.from(new Set([...(managerIds ?? []), manager.id]));
    }

    if (managerIds) {
      const existingManagers = managerIds.length
        ? await prisma.manager.findMany({ where: { id: { in: managerIds } }, select: { id: true } })
        : [];
      const existingManagerIds = new Set(existingManagers.map((manager) => manager.id));
      const invalidManagerIds = managerIds.filter((managerId) => !existingManagerIds.has(managerId));

      if (invalidManagerIds.length) {
        return NextResponse.json(
          { error: "Gestor informado não encontrado.", invalidManagerIds },
          { status: 400 }
        );
      }

      await prisma.$transaction([
        prisma.managerSupplier.deleteMany({
          where: managerIds.length
            ? { supplierId: params.id, managerId: { notIn: managerIds } }
            : { supplierId: params.id }
        }),
        ...(managerIds.length
          ? [prisma.managerSupplier.createMany({
              data: managerIds.map((managerId) => ({ managerId, supplierId: params.id })),
              skipDuplicates: true
            })]
          : [])
      ]);
    }

    const fullSupplier = await prisma.supplier.findUnique({
      where: { id: params.id },
      include: {
        categoryLinks: { include: { category: true } },
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

    return NextResponse.json({
      id: fullSupplier?.id,
      nome: fullSupplier?.nome,
      cnpj: fullSupplier?.cnpj,
      codigoExterno: fullSupplier?.codigoExterno,
      managers: fullSupplier?.managerSuppliers.map((ms) => ms.manager) ?? [],
      categories: fullSupplier?.categoryLinks.map((cl) => cl.category) ?? []
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Não foi possível atualizar fornecedor.", details: (error as Error).message },
      { status: 409 }
    );
  }
}
