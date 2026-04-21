import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supplierNotificationConfigSchema } from "@/lib/validations";
import { getSessionManager } from "@/lib/auth";

type Params = {
  params: {
    supplierId: string;
  };
};

export async function GET(_request: NextRequest, { params }: Params) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN" && manager.supplierId !== params.supplierId) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }
  const supplier = await prisma.supplier.findUnique({
    where: { id: params.supplierId },
    include: {
      managers: true,
      notificationConfig: true
    }
  });

  if (!supplier) {
    return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    supplierId: supplier.id,
    supplierName: supplier.nome,
    managerEmails: supplier.managers.map((m) => m.email),
    config: supplier.notificationConfig ?? {
      ativo: true,
      recorrenciaDias: 2,
      emailsExtras: []
    }
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (manager.role !== "ADMIN" && manager.supplierId !== params.supplierId) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }
  const supplier = await prisma.supplier.findUnique({ where: { id: params.supplierId } });

  if (!supplier) {
    return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 });
  }

  const payload = await request.json();
  const parsed = supplierNotificationConfigSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const now = new Date();
  const next = new Date(now);
  next.setDate(next.getDate() + parsed.data.recorrenciaDias);

  const config = await prisma.supplierNotificationConfig.upsert({
    where: { supplierId: params.supplierId },
    create: {
      supplierId: params.supplierId,
      ...parsed.data,
      proximoEnvioEm: next
    },
    update: {
      ...parsed.data,
      proximoEnvioEm: next
    }
  });

  return NextResponse.json(config);
}
