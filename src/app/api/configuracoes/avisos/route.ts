import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notificationRuleSchema } from "@/lib/validations";
import { getSessionManager } from "@/lib/auth";

export async function GET() {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const rule = await prisma.notificationRule.findFirst({
    orderBy: {
      createdAt: "desc"
    }
  });

  return NextResponse.json(
    rule ?? {
      diasLembrete: 2,
      ativo: true,
      destinatarioAdicional: null
    }
  );
}

export async function PUT(request: NextRequest) {
  const manager = await getSessionManager();
  if (!manager) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const payload = await request.json();
  const parsed = notificationRuleSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.notificationRule.findFirst({
    orderBy: {
      createdAt: "desc"
    }
  });

  const rule = existing
    ? await prisma.notificationRule.update({
        where: { id: existing.id },
        data: parsed.data
      })
    : await prisma.notificationRule.create({ data: parsed.data });

  return NextResponse.json(rule);
}
