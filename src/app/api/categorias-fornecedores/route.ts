import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionManager } from "@/lib/auth";
import { supplierCategorySchema } from "@/lib/validations";

async function validateAdmin() {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode gerenciar categorias." }, { status: 403 });
  return null;
}

export async function GET() {
  const categories = await prisma.supplierCategory.findMany({ orderBy: { nome: "asc" } });
  return NextResponse.json(categories);
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
