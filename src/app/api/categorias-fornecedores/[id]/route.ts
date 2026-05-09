import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionManager } from "@/lib/auth";
import { supplierCategorySchema } from "@/lib/validations";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode gerenciar categorias." }, { status: 403 });

  const payload = await request.json();
  const parsed = supplierCategorySchema.partial().safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.supplierCategory.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(updated);
}
