import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, hashPasswordResetToken } from "@/lib/auth";
import { resetPasswordSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });
  }

  const tokenHash = hashPasswordResetToken(parsed.data.token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { manager: true }
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date() || !resetToken.manager.ativo) {
    return NextResponse.json({ error: "Link de recuperação inválido ou expirado." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.manager.update({
      where: { id: resetToken.managerId },
      data: { senhaHash: hashPassword(parsed.data.password) }
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() }
    })
  ]);

  return NextResponse.json({ success: true, message: "Senha redefinida com sucesso." });
}
