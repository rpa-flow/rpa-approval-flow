import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSessionManager } from "@/lib/auth";
import { getPaginationMetadata, getPaginationParams } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { companySchema } from "@/lib/validations";
import { getCompanySummariesMap } from "@/lib/nfse-nsu";

async function validateAdmin() {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode gerenciar empresas." }, { status: 403 });
  return null;
}

function buildCompanyWhere(searchParams: URLSearchParams): Prisma.CompanyWhereInput {
  const search = searchParams.get("search")?.replace(/\D/g, "") || searchParams.get("search")?.trim();
  const rawSearch = searchParams.get("search")?.trim();
  const status = searchParams.get("status");
  const filters: Prisma.CompanyWhereInput[] = [];

  if (status === "ATIVAS") filters.push({ active: true });
  if (status === "INATIVAS") filters.push({ active: false });

  if (rawSearch) {
    filters.push({
      OR: [
        { cnpj: { contains: search, mode: "insensitive" } },
        { displayName: { contains: rawSearch, mode: "insensitive" } }
      ]
    });
  }

  return filters.length ? { AND: filters } : {};
}

export async function GET(request: NextRequest) {
  const unauthorized = await validateAdmin();
  if (unauthorized) return unauthorized;

  const where = buildCompanyWhere(request.nextUrl.searchParams);
  const { page: requestedPage, pageSize } = getPaginationParams(request.nextUrl.searchParams);
  const total = await prisma.company.count({ where });
  const pagination = getPaginationMetadata(total, requestedPage, pageSize);

  const companies = await prisma.company.findMany({
    where,
    orderBy: { displayName: "asc" },
    skip: (pagination.page - 1) * pageSize,
    take: pageSize
  });

  if (request.nextUrl.searchParams.get("includeNfseSummary") === "true") {
    const summaries = await getCompanySummariesMap(companies.map((company) => company.id));
    return NextResponse.json({ items: companies.map((company) => ({ ...company, nfseNsuSummary: summaries.get(company.id) ?? null })), pagination });
  }

  return NextResponse.json({ items: companies, pagination });
}

export async function POST(request: NextRequest) {
  const unauthorized = await validateAdmin();
  if (unauthorized) return unauthorized;

  const payload = await request.json();
  const parsed = companySchema.safeParse({
    ...payload,
    cnpj: typeof payload?.cnpj === "string" ? payload.cnpj.replace(/\D/g, "") : payload?.cnpj
  });
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });

  try {
    const created = await prisma.company.create({
      data: {
        cnpj: parsed.data.cnpj,
        displayName: parsed.data.displayName,
        active: parsed.data.active ?? true
      }
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Já existe empresa cadastrada com este CNPJ." }, { status: 409 });
    }
    throw error;
  }
}
