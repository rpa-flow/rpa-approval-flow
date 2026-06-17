import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionManager } from "@/lib/auth";
import { getPaginationMetadata, getPaginationParams, shouldUsePaginatedResponse } from "@/lib/pagination";
import { supplierCategorySchema } from "@/lib/validations";

async function validateAdmin() {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode gerenciar categorias." }, { status: 403 });
  return null;
}

function buildCategoryWhere(searchParams: URLSearchParams) {
  const search = searchParams.get("search")?.trim();
  const status = searchParams.get("status");
  const filters: Prisma.SupplierCategoryWhereInput[] = [];

  if (status === "ATIVAS") filters.push({ ativo: true });
  if (status === "INATIVAS") filters.push({ ativo: false });

  if (search) {
    filters.push({
      OR: [
        { nome: { contains: search, mode: "insensitive" } },
        { descricao: { contains: search, mode: "insensitive" } }
      ]
    });
  }

  return filters.length ? { AND: filters } : {};
}

export async function GET(request: NextRequest) {
  const where = buildCategoryWhere(request.nextUrl.searchParams);
  const paginated = shouldUsePaginatedResponse(request.nextUrl.searchParams);
  const { page: requestedPage, pageSize } = getPaginationParams(request.nextUrl.searchParams);
  const total = paginated ? await prisma.supplierCategory.count({ where }) : 0;
  const pagination = paginated ? getPaginationMetadata(total, requestedPage, pageSize) : null;

  const categories = await prisma.supplierCategory.findMany({
    where,
    orderBy: { nome: "asc" },
    ...(pagination ? { skip: (pagination.page - 1) * pageSize, take: pageSize } : {})
  });

  if (!pagination) return NextResponse.json(categories);

  return NextResponse.json({ items: categories, pagination });
}

export async function POST(request: NextRequest) {
  const unauthorized = await validateAdmin();
  if (unauthorized) return unauthorized;
  const payload = await request.json();
  const parsed = supplierCategorySchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });

  const created = await prisma.supplierCategory.create({ data: { nome: parsed.data.nome, descricao: parsed.data.descricao ?? null, ativo: parsed.data.ativo ?? true } });
  return NextResponse.json(created, { status: 201 });
}
