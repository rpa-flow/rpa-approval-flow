import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionManager } from "@/lib/auth";

export async function GET() {
  const manager = await getSessionManager();
  if (!manager) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (manager.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas administradores podem listar gestores." }, { status: 403 });
  }

  const managers = await prisma.manager.findMany({
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      ativo: true
    },
    orderBy: {
      nome: "asc"
    }
  });

  return NextResponse.json(managers);
}
