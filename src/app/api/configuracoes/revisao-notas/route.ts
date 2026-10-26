import { NextRequest, NextResponse } from "next/server";
import { getSessionManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceAdminReviewConfigSchema } from "@/lib/validations";

export async function GET() {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode acessar esta configuração." }, { status: 403 });

  const config = await prisma.invoiceAdminReviewConfig.findUnique({ where: { id: "default" } });
  return NextResponse.json({ email: config?.email ?? "", ativo: config?.ativo ?? false });
}

export async function PUT(request: NextRequest) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN") return NextResponse.json({ error: "Somente ADMIN pode alterar esta configuração." }, { status: 403 });

  const parsed = invoiceAdminReviewConfigSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });
  }

  const config = await prisma.invoiceAdminReviewConfig.upsert({
    where: { id: "default" },
    create: { id: "default", email: parsed.data.email, ativo: true },
    update: { email: parsed.data.email, ativo: true }
  });
  return NextResponse.json({ email: config.email, ativo: config.ativo });
}
