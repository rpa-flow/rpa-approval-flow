import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { companySchema } from "@/lib/validations";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode gerenciar empresas." }, { status: 403 });

  const payload = await request.json();
  const normalizedPayload = {
    ...payload,
    cnpj: typeof payload?.cnpj === "string" ? payload.cnpj.replace(/\D/g, "") : payload?.cnpj
  };
  const parsed = companySchema.partial().refine((data) => Object.keys(data).length > 0, { message: "Informe ao menos um campo para atualizar." }).safeParse(normalizedPayload);
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });

  try {
    const updated = await prisma.company.update({ where: { id: params.id }, data: parsed.data });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Já existe empresa cadastrada com este CNPJ." }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }
    throw error;
  }
}
