import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionManager, hashPassword } from "@/lib/auth";
import { managerSchema } from "@/lib/validations";
import { getPaginationMetadata, getPaginationParams, shouldUsePaginatedResponse } from "@/lib/pagination";

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
} satisfies Prisma.ManagerSelect;

type ManagerWithRelations = Prisma.ManagerGetPayload<{ select: typeof managerSelect }>;

const roleSearchLabels: Record<UserRole, string> = {
  ADMIN: "administrador admin",
  GESTOR: "gestor aprovador",
  FORNECEDOR: "portal fornecedor"
};

function serializeManager(manager: ManagerWithRelations) {
  return {
    id: manager.id,
    nome: manager.nome,
    email: manager.email,
    role: manager.role,
    ativo: manager.ativo,
    suppliers: manager.managerSuppliers.map((link) => link.supplier)
  };
}

function buildManagerWhere(searchParams: URLSearchParams) {
  const search = searchParams.get("search")?.trim();
  if (!search) return {};

  const normalizedSearch = search.toLowerCase();
  const matchingRoles = Object.entries(roleSearchLabels)
    .filter(([, label]) => label.includes(normalizedSearch))
    .map(([role]) => role as UserRole);

  const filters: Prisma.ManagerWhereInput[] = [
    { nome: { contains: search, mode: "insensitive" } },
    { email: { contains: search, mode: "insensitive" } },
    { managerSuppliers: { some: { supplier: { nome: { contains: search, mode: "insensitive" } } } } }
  ];

  if (matchingRoles.length) filters.push({ role: { in: matchingRoles } });

  return { OR: filters };
}

export async function GET(request: NextRequest) {
  const unauthorized = await validateAdmin();
  if (unauthorized) return unauthorized;

  const where = buildManagerWhere(request.nextUrl.searchParams);
  const paginated = shouldUsePaginatedResponse(request.nextUrl.searchParams);
  const { page: requestedPage, pageSize } = getPaginationParams(request.nextUrl.searchParams);
  const total = paginated ? await prisma.manager.count({ where }) : 0;
  const pagination = paginated ? getPaginationMetadata(total, requestedPage, pageSize) : null;
  const managers = await prisma.manager.findMany({
    where,
    select: managerSelect,
    orderBy: {
      nome: "asc"
    },
    ...(pagination ? { skip: (pagination.page - 1) * pageSize, take: pageSize } : {})
  });

  const items = managers.map(serializeManager);
  if (!pagination) return NextResponse.json(items);

  return NextResponse.json({ items, pagination });
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
      serializeManager(manager),
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Não foi possível cadastrar gestor.", details: (error as Error).message },
      { status: 409 }
    );
  }
}
