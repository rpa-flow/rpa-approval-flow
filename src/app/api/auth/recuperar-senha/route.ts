import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSecureToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { forgotPasswordSchema } from "@/lib/validations";

function appBaseUrl() {
  return (process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }

  const genericResponse = {
    success: true,
    message: "Se o e-mail estiver cadastrado e ativo, enviaremos as instruções para redefinir a senha."
  };

  const manager = await prisma.manager.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, nome: true, email: true, ativo: true }
  });

  if (!manager || !manager.ativo) {
    return NextResponse.json(genericResponse);
  }

  const { token, tokenHash } = createSecureToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

  await prisma.passwordResetToken.create({
    data: { managerId: manager.id, tokenHash, expiresAt }
  });

  await sendPasswordResetEmail({
    recipient: manager.email,
    name: manager.nome,
    resetUrl: `${appBaseUrl()}/redefinir-senha?token=${encodeURIComponent(token)}`,
    expiresAt
  });

  return NextResponse.json(genericResponse);
}
