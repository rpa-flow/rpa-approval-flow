import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { supplierSchema } from "@/lib/validations";
import { getSessionManager, hashPassword } from "@/lib/auth";
import { getPaginationMetadata, getPaginationParams, shouldUsePaginatedResponse } from "@/lib/pagination";

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

const supplierInclude = {
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
} satisfies Prisma.SupplierInclude;

type SupplierWithRelations = Prisma.SupplierGetPayload<{ include: typeof supplierInclude }>;

function serializeSupplier(supplier: SupplierWithRelations) {
  return {
    id: supplier.id,
    nome: supplier.nome,
    cnpj: supplier.cnpj,
    codigoExterno: supplier.codigoExterno,
    managers: supplier.managerSuppliers.map((ms) => ms.manager),
    categories: supplier.categoryLinks.map((cl) => cl.category)
  };
}

function buildSupplierWhere(searchParams: URLSearchParams) {
  const search = searchParams.get("search")?.trim();
  const categoryId = searchParams.get("categoryId");
  const filters: Prisma.SupplierWhereInput[] = [];

  if (categoryId && categoryId !== "TODAS") {
    filters.push({ categoryLinks: { some: { categoryId } } });
  }

  if (search) {
    filters.push({
      OR: [
        { nome: { contains: search, mode: "insensitive" } },
        { cnpj: { contains: search } },
        { codigoExterno: { contains: search, mode: "insensitive" } },
        { managerSuppliers: { some: { manager: { nome: { contains: search, mode: "insensitive" } } } } }
      ]
    });
  }

  return filters.length ? { AND: filters } : {};
}

export async function GET(request: NextRequest) {
  const unauthorized = await validateAdmin();
  if (unauthorized) return unauthorized;

  const where = buildSupplierWhere(request.nextUrl.searchParams);
  const paginated = shouldUsePaginatedResponse(request.nextUrl.searchParams);
  const { page: requestedPage, pageSize } = getPaginationParams(request.nextUrl.searchParams);
  const total = paginated ? await prisma.supplier.count({ where }) : 0;
  const pagination = paginated ? getPaginationMetadata(total, requestedPage, pageSize) : null;
  const suppliers = await prisma.supplier.findMany({
    where,
    include: supplierInclude,
    orderBy: {
      nome: "asc"
    },
    ...(pagination ? { skip: (pagination.page - 1) * pageSize, take: pageSize } : {})
  });

  const items = suppliers.map(serializeSupplier);
  if (!pagination) return NextResponse.json(items);

  return NextResponse.json({ items, pagination });
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
      cnpj: parsed.data.cnpj,
      codigoExterno: parsed.data.codigoExterno
    }
  });

  if (parsed.data.categoryIds?.length) {
    await prisma.supplierCategoryLink.createMany({ data: parsed.data.categoryIds.map((categoryId) => ({ supplierId: supplier.id, categoryId })), skipDuplicates: true });
  }

  for (const m of parsed.data.managers) {
    const existingManager = await prisma.manager.findUnique({ where: { email: m.email } });

    const manager = existingManager
      ? existingManager
      : await prisma.manager.create({
          data: {
            nome: m.nome,
            email: m.email,
            senhaHash: hashPassword(m.senha),
            role: "FORNECEDOR"
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
    include: supplierInclude
  });

  return NextResponse.json(
    fullSupplier ? serializeSupplier(fullSupplier) : null,
    { status: 201 }
  );
}
