import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashActivationToken, hashPassword } from "@/lib/auth";
import { activateAccountSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const parsed = activateAccountSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });
  }

  const tokenHash = hashActivationToken(parsed.data.token);
  const activation = await prisma.accountActivationToken.findUnique({
    where: { tokenHash },
    include: { manager: true }
  });

  if (!activation || activation.usedAt || activation.expiresAt < new Date()) {
    return NextResponse.json({ error: "Link de ativação inválido ou expirado." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.manager.update({
      where: { id: activation.managerId },
      data: { ativo: true, senhaHash: hashPassword(parsed.data.password) }
    }),
    prisma.accountActivationToken.update({
      where: { id: activation.id },
      data: { usedAt: new Date() }
    })
  ]);

  return NextResponse.json({ success: true, message: "Conta ativada com sucesso." });
}
